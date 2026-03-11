import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ── Internal Queries ─────────────────────────────────────────

export const getCallById = internalQuery({
    args: { callId: v.string(), userId: v.string() },
    handler: async (ctx, { callId, userId }) => {
        const call = await ctx.db.get(callId as Id<"voiceCalls">);
        if (!call || call.userId !== userId) return null;
        return call;
    },
});

export const getTranscript = internalQuery({
    args: { callId: v.string(), userId: v.string() },
    handler: async (ctx, { callId, userId }) => {
        // Verify ownership
        const call = await ctx.db.get(callId as Id<"voiceCalls">);
        if (!call || call.userId !== userId) return null;

        return await ctx.db
            .query("callTranscripts")
            .withIndex("by_callId", (q) => q.eq("callId", callId as any))
            .first();
    },
});

export const getRecording = internalQuery({
    args: { callId: v.string(), userId: v.string() },
    handler: async (ctx, { callId, userId }) => {
        const call = await ctx.db.get(callId as Id<"voiceCalls">);
        if (!call || call.userId !== userId) return null;

        return await ctx.db
            .query("callRecordings")
            .withIndex("by_callId", (q) => q.eq("callId", callId as any))
            .first();
    },
});

export const getSummary = internalQuery({
    args: { callId: v.string(), userId: v.string() },
    handler: async (ctx, { callId, userId }) => {
        const call = await ctx.db.get(callId as Id<"voiceCalls">);
        if (!call || call.userId !== userId) return null;

        return await ctx.db
            .query("callSummaries")
            .withIndex("by_callId", (q) => q.eq("callId", callId as any))
            .first();
    },
});

export const getCallsByUserId = internalQuery({
    args: { userId: v.string(), limit: v.optional(v.number()) },
    handler: async (ctx, { userId, limit }) => {
        return await ctx.db
            .query("voiceCalls")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .order("desc")
            .take(limit ?? 20);
    },
});

// ── Internal Mutations ───────────────────────────────────────

/**
 * Initiate a new voice call.
 * Validates credit balance, selects provider based on tier, reserves credits.
 */
export const initiateCall = internalMutation({
    args: {
        userId: v.string(),
        tierName: v.string(),
        scenario: v.string(),
        voiceId: v.optional(v.string()),
        maxDurationMinutes: v.number(),
        phoneNumber: v.optional(v.string()),
    },
    handler: async (ctx, { userId, tierName, scenario, voiceId, maxDurationMinutes, phoneNumber }) => {
        // Look up tier
        const tier = await ctx.db
            .query("serviceTiers")
            .withIndex("by_name", (q) => q.eq("name", tierName))
            .first();

        if (!tier) throw new Error(`Unknown service tier: ${tierName}. Use list_services to see available tiers.`);
        if (!tier.isActive) throw new Error(`Service tier '${tierName}' is currently unavailable.`);

        // Enforce max duration
        const effectiveMaxMinutes = Math.min(maxDurationMinutes, tier.maxCallDurationMinutes);

        // Estimate maximum credit cost (will adjust on completion)
        const estimatedCost = effectiveMaxMinutes * tier.costPerMinuteCall;

        // Check / reserve credits
        const account = await ctx.db
            .query("creditAccounts")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();

        if (!account) throw new Error("Credit account not found. Create an account first.");
        if (account.balance < estimatedCost) {
            throw new Error(
                `Insufficient credits. Estimated cost: ${estimatedCost} credits for ${effectiveMaxMinutes} min. ` +
                `Your balance: ${account.balance}. Purchase more credits using buy_credits.`
            );
        }

        // Create call record
        const callId = await ctx.db.insert("voiceCalls", {
            userId,
            tierId: tier._id,
            tierName: tier.displayName,
            status: "initiating",
            voiceId: voiceId ?? undefined,
            scenario,
            phoneNumber,
            creditsCharged: 0,
            providerId: tier.providerId,
            createdAt: Date.now(),
        });

        // In production: initiate actual call with the provider
        // For now, simulate call initiation → mark as in_progress
        await ctx.db.patch(callId, {
            status: "in_progress",
            startedAt: Date.now(),
        });

        return {
            call_id: callId,
            status: "in_progress",
            tier: tier.displayName,
            estimated_max_cost: estimatedCost,
            max_duration_minutes: effectiveMaxMinutes,
            message: `Voice call initiated on ${tier.displayName} tier. Use get_call_status to monitor progress.`,
        };
    },
});

/**
 * Complete a call — finalize cost, store transcript/recording/summary.
 * Called by provider callback or internal process.
 */
export const completeCall = internalMutation({
    args: {
        callId: v.id("voiceCalls"),
        durationSeconds: v.number(),
        transcript: v.optional(v.string()),
        recordingUrl: v.optional(v.string()),
        summary: v.optional(v.string()),
        keyPoints: v.optional(v.array(v.string())),
        errorMessage: v.optional(v.string()),
    },
    handler: async (ctx, { callId, durationSeconds, transcript, recordingUrl, summary, keyPoints, errorMessage }) => {
        const call = await ctx.db.get(callId);
        if (!call) throw new Error("Call not found");

        const tier = await ctx.db.get(call.tierId);
        if (!tier) throw new Error("Service tier not found");

        const failed = !!errorMessage;
        const durationMinutes = Math.ceil(durationSeconds / 60);
        const creditsCost = failed ? 0 : durationMinutes * tier.costPerMinuteCall;

        // Update call record
        await ctx.db.patch(callId, {
            status: failed ? "failed" : "completed",
            endedAt: Date.now(),
            durationSeconds,
            creditsCharged: creditsCost,
            errorMessage,
        });

        // Debit credits (only if call succeeded)
        if (!failed && creditsCost > 0) {
            await ctx.runMutation(internal.credits.debitCredits, {
                userId: call.userId,
                amount: creditsCost,
                description: `Voice call (${tier.displayName}, ${durationMinutes}m)`,
                metadata: JSON.stringify({ callId }),
            });
        }

        // Store transcript
        if (transcript) {
            await ctx.db.insert("callTranscripts", {
                callId,
                userId: call.userId,
                content: transcript,
                wordCount: transcript.split(/\s+/).length,
                createdAt: Date.now(),
            });
        }

        // Store recording
        if (recordingUrl) {
            await ctx.db.insert("callRecordings", {
                callId,
                userId: call.userId,
                externalUrl: recordingUrl,
                format: "mp3",
                durationSeconds,
                createdAt: Date.now(),
            });
        }

        // Store summary
        if (summary) {
            await ctx.db.insert("callSummaries", {
                callId,
                userId: call.userId,
                summary,
                keyPoints: keyPoints ? JSON.stringify(keyPoints) : undefined,
                createdAt: Date.now(),
            });
        }

        return { status: failed ? "failed" : "completed", creditsCost };
    },
});
