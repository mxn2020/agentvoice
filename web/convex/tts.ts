import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ── Internal Queries ─────────────────────────────────────────

export const getJob = internalQuery({
    args: { jobId: v.string(), userId: v.string() },
    handler: async (ctx, { jobId, userId }) => {
        const job = await ctx.db.get(jobId as any);
        if (!job || job.userId !== userId) return null;
        return job;
    },
});

export const getJobsByUserId = internalQuery({
    args: { userId: v.string(), limit: v.optional(v.number()) },
    handler: async (ctx, { userId, limit }) => {
        return await ctx.db
            .query("ttsJobs")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .order("desc")
            .take(limit ?? 20);
    },
});

// ── Internal Mutations ───────────────────────────────────────

/**
 * Create a TTS job.
 * Cost is based on character count × tier rate.
 */
export const createJob = internalMutation({
    args: {
        userId: v.string(),
        tierName: v.string(),
        text: v.string(),
        voiceId: v.optional(v.string()),
        format: v.string(),
    },
    handler: async (ctx, { userId, tierName, text, voiceId, format }) => {
        // Look up tier
        const tier = await ctx.db
            .query("serviceTiers")
            .withIndex("by_name", (q) => q.eq("name", tierName))
            .first();

        if (!tier) throw new Error(`Unknown service tier: ${tierName}`);
        if (!tier.isActive) throw new Error(`Service tier '${tierName}' is currently unavailable.`);

        // Calculate cost based on character count
        const charCount = text.length;
        const costUnits = Math.ceil(charCount / 1000); // per 1000 chars
        const creditsCost = costUnits * tier.costPerTtsCharacter;

        // Check credits
        const account = await ctx.db
            .query("creditAccounts")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();

        if (!account) throw new Error("Credit account not found");
        if (account.balance < creditsCost) {
            throw new Error(
                `Insufficient credits for TTS. Cost: ${creditsCost} credits (${charCount} chars). ` +
                `Your balance: ${account.balance}. Purchase more credits using buy_credits.`
            );
        }

        // Create job
        const jobId = await ctx.db.insert("ttsJobs", {
            userId,
            tierId: tier._id,
            status: "pending",
            inputText: text,
            voiceId: voiceId ?? "default",
            outputFormat: format,
            creditsCharged: creditsCost,
            characterCount: charCount,
            createdAt: Date.now(),
        });

        // Debit credits immediately for TTS (predictable cost)
        await ctx.runMutation(internal.credits.debitCredits, {
            userId,
            amount: creditsCost,
            description: `TTS (${tier.displayName}, ${charCount} chars)`,
            metadata: JSON.stringify({ jobId }),
        });

        // In production: dispatch to TTS provider
        await ctx.db.patch(jobId, { status: "processing" });

        return {
            job_id: jobId,
            status: "processing",
            tier: tier.displayName,
            characters: charCount,
            credits_charged: creditsCost,
            message: "Text-to-speech processing. Use get_tts_result to check results.",
        };
    },
});

/**
 * Complete a TTS job.
 * Called by provider callback with the audio output.
 */
export const completeJob = internalMutation({
    args: {
        jobId: v.id("ttsJobs"),
        outputStorageId: v.optional(v.id("_storage")),
        durationSeconds: v.optional(v.number()),
        sizeBytes: v.optional(v.number()),
        errorMessage: v.optional(v.string()),
    },
    handler: async (ctx, { jobId, outputStorageId, durationSeconds, sizeBytes, errorMessage }) => {
        const job = await ctx.db.get(jobId);
        if (!job) throw new Error("Job not found");

        const failed = !!errorMessage;

        await ctx.db.patch(jobId, {
            status: failed ? "failed" : "completed",
            outputStorageId: failed ? undefined : outputStorageId,
            durationSeconds,
            sizeBytes,
            completedAt: Date.now(),
            errorMessage,
        });

        // Refund credits on failure
        if (failed && job.creditsCharged > 0) {
            await ctx.runMutation(internal.credits.addCredits, {
                userId: job.userId,
                amount: job.creditsCharged,
                description: `TTS refund (job failed)`,
                metadata: JSON.stringify({ jobId }),
            });
        }

        return { status: failed ? "failed" : "completed" };
    },
});
