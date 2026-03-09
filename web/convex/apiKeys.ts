import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// ── Internal Queries ─────────────────────────────────────────

export const getKeyByHash = internalQuery({
    args: { keyHash: v.string() },
    handler: async (ctx, { keyHash }) => {
        return await ctx.db
            .query("apiKeys")
            .withIndex("by_keyHash", (q) => q.eq("keyHash", keyHash))
            .first();
    },
});

export const getKeysByUserId = internalQuery({
    args: { userId: v.string() },
    handler: async (ctx, { userId }) => {
        return await ctx.db
            .query("apiKeys")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .collect();
    },
});

// ── Internal Mutations ───────────────────────────────────────

export const createKey = internalMutation({
    args: {
        userId: v.string(),
        name: v.string(),
        keyHash: v.string(),
        keyPrefix: v.string(),
        scopes: v.array(v.string()),
    },
    handler: async (ctx, { userId, name, keyHash, keyPrefix, scopes }) => {
        const keyId = await ctx.db.insert("apiKeys", {
            userId,
            name,
            keyHash,
            keyPrefix,
            scopes,
            createdAt: Date.now(),
        });

        await ctx.db.insert("auditLogs", {
            action: "auth.api_key_created",
            category: "auth",
            userId,
            details: JSON.stringify({ keyPrefix, scopes }),
            timestamp: Date.now(),
        });

        return keyId;
    },
});

export const updateLastUsed = internalMutation({
    args: { keyId: v.id("apiKeys") },
    handler: async (ctx, { keyId }) => {
        await ctx.db.patch(keyId, { lastUsedAt: Date.now() });
    },
});

export const revokeKey = internalMutation({
    args: { keyId: v.id("apiKeys"), userId: v.string() },
    handler: async (ctx, { keyId, userId }) => {
        const key = await ctx.db.get(keyId);
        if (!key) throw new Error("API key not found");
        if (key.userId !== userId) throw new Error("Not authorized");

        await ctx.db.patch(keyId, { revokedAt: Date.now() });

        await ctx.db.insert("auditLogs", {
            action: "auth.api_key_revoked",
            category: "auth",
            userId,
            details: JSON.stringify({ keyPrefix: key.keyPrefix }),
            timestamp: Date.now(),
        });
    },
});
