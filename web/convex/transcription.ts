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
            .query("transcriptionJobs")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .order("desc")
            .take(limit ?? 20);
    },
});

// ── Internal Mutations ───────────────────────────────────────

/**
 * Create a transcription job.
 * Validates credits and creates the job record.
 */
export const createJob = internalMutation({
    args: {
        userId: v.string(),
        tierName: v.string(),
        audioUrl: v.string(),
        language: v.optional(v.string()),
    },
    handler: async (ctx, { userId, tierName, audioUrl, language }) => {
        // Look up tier
        const tier = await ctx.db
            .query("serviceTiers")
            .withIndex("by_name", (q) => q.eq("name", tierName))
            .first();

        if (!tier) throw new Error(`Unknown service tier: ${tierName}`);
        if (!tier.isActive) throw new Error(`Service tier '${tierName}' is currently unavailable.`);

        // Estimate cost (assume ~1 minute for initial estimate, adjust on completion)
        const estimatedMinutes = 1;
        const estimatedCost = estimatedMinutes * tier.costPerTranscriptionMinute;

        // Check credits
        const account = await ctx.db
            .query("creditAccounts")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();

        if (!account) throw new Error("Credit account not found");
        if (account.balance < estimatedCost) {
            throw new Error(
                `Insufficient credits for transcription. Minimum cost: ${estimatedCost} credits/minute. ` +
                `Your balance: ${account.balance}. Purchase more credits using buy_credits.`
            );
        }

        // Create job
        const jobId = await ctx.db.insert("transcriptionJobs", {
            userId,
            tierId: tier._id,
            status: "pending",
            inputUrl: audioUrl,
            inputFormat: audioUrl.split(".").pop() ?? "unknown",
            creditsCharged: 0,
            createdAt: Date.now(),
        });

        // In production: dispatch to transcription provider
        // For now, mark as processing
        await ctx.db.patch(jobId, {
            status: "processing",
            processingStartedAt: Date.now(),
        });

        return {
            job_id: jobId,
            status: "processing",
            tier: tier.displayName,
            message: "Transcription processing. Use get_transcription to check results.",
        };
    },
});

/**
 * Complete a transcription job.
 * Called by provider callback.
 */
export const completeJob = internalMutation({
    args: {
        jobId: v.id("transcriptionJobs"),
        transcript: v.string(),
        segments: v.optional(v.string()),
        language: v.optional(v.string()),
        durationSeconds: v.number(),
        errorMessage: v.optional(v.string()),
    },
    handler: async (ctx, { jobId, transcript, segments, language, durationSeconds, errorMessage }) => {
        const job = await ctx.db.get(jobId);
        if (!job) throw new Error("Job not found");

        const tier = await ctx.db.get(job.tierId);
        if (!tier) throw new Error("Tier not found");

        const failed = !!errorMessage;
        const durationMinutes = Math.ceil(durationSeconds / 60);
        const creditsCost = failed ? 0 : durationMinutes * tier.costPerTranscriptionMinute;

        await ctx.db.patch(jobId, {
            status: failed ? "failed" : "completed",
            transcript: failed ? undefined : transcript,
            segments,
            language,
            inputDurationSeconds: durationSeconds,
            creditsCharged: creditsCost,
            completedAt: Date.now(),
            errorMessage,
        });

        if (!failed && creditsCost > 0) {
            await ctx.runMutation(internal.credits.debitCredits, {
                userId: job.userId,
                amount: creditsCost,
                description: `Transcription (${tier.displayName}, ${durationMinutes}m)`,
                metadata: JSON.stringify({ jobId }),
            });
        }

        return { status: failed ? "failed" : "completed", creditsCost };
    },
});
