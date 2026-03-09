import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";

// ── Internal Queries (used by MCP server) ────────────────────

export const getActiveTiers = internalQuery({
    args: {},
    handler: async (ctx) => {
        return await ctx.db
            .query("serviceTiers")
            .withIndex("by_isActive", (q) => q.eq("isActive", true))
            .collect();
    },
});

export const getProviderById = internalQuery({
    args: { providerId: v.string() },
    handler: async (ctx, { providerId }) => {
        return await ctx.db.get(providerId as any);
    },
});

// ── Admin Queries ────────────────────────────────────────────

async function requireAdmin(ctx: any) {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId))
        .first();
    if (profile?.role !== "admin") throw new Error("Not authorized: admin only");
    return userId;
}

export const listTiers = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        return await ctx.db.query("serviceTiers").collect();
    },
});

export const listProviders = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        const providers = await ctx.db.query("providerConfigs").collect();
        // Strip credentials for display
        return providers.map((p) => ({
            ...p,
            credentials: "[REDACTED]",
        }));
    },
});

export const getSystemStats = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);

        const totalCalls = (await ctx.db.query("voiceCalls").collect()).length;
        const completedCalls = (await ctx.db.query("voiceCalls")
            .withIndex("by_status", (q) => q.eq("status", "completed"))
            .collect()).length;
        const totalTranscriptions = (await ctx.db.query("transcriptionJobs").collect()).length;
        const totalTtsJobs = (await ctx.db.query("ttsJobs").collect()).length;
        const totalApiKeys = (await ctx.db.query("apiKeys").collect()).length;
        const totalUsers = (await ctx.db.query("userProfiles").collect()).length;
        const pendingPayments = (await ctx.db.query("cryptoPayments")
            .withIndex("by_status", (q) => q.eq("status", "pending"))
            .collect()).length;

        return {
            totalCalls,
            completedCalls,
            totalTranscriptions,
            totalTtsJobs,
            totalApiKeys,
            totalUsers,
            pendingPayments,
        };
    },
});

// ── Admin Mutations ──────────────────────────────────────────

export const upsertTier = mutation({
    args: {
        id: v.optional(v.id("serviceTiers")),
        name: v.string(),
        displayName: v.string(),
        description: v.string(),
        providerId: v.string(),
        costPerMinuteCall: v.number(),
        costPerTranscriptionMinute: v.number(),
        costPerTtsCharacter: v.number(),
        maxCallDurationMinutes: v.number(),
        features: v.array(v.string()),
        isActive: v.boolean(),
        sortOrder: v.number(),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const { id, ...data } = args;
        const tierData = { ...data, updatedAt: Date.now() };

        if (id) {
            await ctx.db.patch(id, tierData);
            return id;
        } else {
            return await ctx.db.insert("serviceTiers", tierData);
        }
    },
});

export const deleteTier = mutation({
    args: { id: v.id("serviceTiers") },
    handler: async (ctx, { id }) => {
        await requireAdmin(ctx);
        await ctx.db.delete(id);
    },
});

export const upsertProvider = mutation({
    args: {
        id: v.optional(v.id("providerConfigs")),
        name: v.string(),
        displayName: v.string(),
        type: v.union(
            v.literal("voice_call"),
            v.literal("transcription"),
            v.literal("tts"),
            v.literal("multi"),
        ),
        credentials: v.string(),
        isActive: v.boolean(),
        config: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const { id, ...data } = args;
        const providerData = {
            ...data,
            healthStatus: "unknown" as const,
            updatedAt: Date.now(),
            createdAt: Date.now(),
        };

        if (id) {
            const { createdAt: _, ...updateData } = providerData;
            await ctx.db.patch(id, updateData);
            return id;
        } else {
            return await ctx.db.insert("providerConfigs", providerData);
        }
    },
});

export const deleteProvider = mutation({
    args: { id: v.id("providerConfigs") },
    handler: async (ctx, { id }) => {
        await requireAdmin(ctx);
        await ctx.db.delete(id);
    },
});

/**
 * Seed default tiers if none exist.
 * Called on first admin login.
 */
export const seedDefaultTiers = mutation({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);

        const existing = await ctx.db.query("serviceTiers").first();
        if (existing) return { seeded: false, message: "Tiers already exist" };

        // Create default providers
        const basicProviderId = await ctx.db.insert("providerConfigs", {
            name: "deepgram",
            displayName: "Deepgram",
            type: "multi",
            credentials: JSON.stringify({ apiKey: "" }),
            isActive: true,
            healthStatus: "unknown",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        const proProviderId = await ctx.db.insert("providerConfigs", {
            name: "openai_realtime",
            displayName: "OpenAI Realtime",
            type: "voice_call",
            credentials: JSON.stringify({ apiKey: "" }),
            isActive: true,
            healthStatus: "unknown",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        const premiumProviderId = await ctx.db.insert("providerConfigs", {
            name: "elevenlabs",
            displayName: "ElevenLabs",
            type: "multi",
            credentials: JSON.stringify({ apiKey: "" }),
            isActive: true,
            healthStatus: "unknown",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        // Create default tiers
        const tiers = [
            {
                name: "basic",
                displayName: "Basic",
                description: "Good quality voice calls and audio processing at an affordable rate.",
                providerId: basicProviderId,
                costPerMinuteCall: 2,
                costPerTranscriptionMinute: 1,
                costPerTtsCharacter: 1,
                maxCallDurationMinutes: 10,
                features: ["call_recording", "transcript"],
                isActive: true,
                sortOrder: 1,
                updatedAt: Date.now(),
            },
            {
                name: "pro",
                displayName: "Pro",
                description: "High-quality AI voice with advanced features and longer calls.",
                providerId: proProviderId,
                costPerMinuteCall: 5,
                costPerTranscriptionMinute: 2,
                costPerTtsCharacter: 3,
                maxCallDurationMinutes: 30,
                features: ["call_recording", "transcript", "summary", "hd_voice"],
                isActive: true,
                sortOrder: 2,
                updatedAt: Date.now(),
            },
            {
                name: "premium",
                displayName: "Premium",
                description: "Best-in-class ElevenLabs voices, custom voice cloning, and unlimited duration.",
                providerId: premiumProviderId,
                costPerMinuteCall: 12,
                costPerTranscriptionMinute: 3,
                costPerTtsCharacter: 5,
                maxCallDurationMinutes: 60,
                features: ["call_recording", "transcript", "summary", "hd_voice", "custom_voice", "priority"],
                isActive: true,
                sortOrder: 3,
                updatedAt: Date.now(),
            },
        ];

        for (const tier of tiers) {
            await ctx.db.insert("serviceTiers", tier);
        }

        return { seeded: true, message: "Default tiers and providers created" };
    },
});
