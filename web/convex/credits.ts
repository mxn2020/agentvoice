import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";

// ── Internal Queries ─────────────────────────────────────────

export const getAccountByUserId = internalQuery({
    args: { userId: v.string() },
    handler: async (ctx, { userId }) => {
        return await ctx.db
            .query("creditAccounts")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();
    },
});

// ── Internal Mutations ───────────────────────────────────────

/**
 * Create a credit account for a new user.
 * Called during account registration.
 */
export const ensureAccount = internalMutation({
    args: { userId: v.string() },
    handler: async (ctx, { userId }) => {
        const existing = await ctx.db
            .query("creditAccounts")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();

        if (!existing) {
            await ctx.db.insert("creditAccounts", {
                userId,
                balance: 0,
                totalPurchased: 0,
                totalUsed: 0,
            });
        }
    },
});

/**
 * Add credits after a confirmed payment.
 * Atomic: updates balance + creates transaction record.
 */
export const addCredits = internalMutation({
    args: {
        userId: v.string(),
        amount: v.number(),
        description: v.string(),
        metadata: v.optional(v.string()),
    },
    handler: async (ctx, { userId, amount, description, metadata }) => {
        const account = await ctx.db
            .query("creditAccounts")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();

        if (!account) throw new Error("Credit account not found");
        if (amount <= 0) throw new Error("Amount must be positive");

        const newBalance = account.balance + amount;

        await ctx.db.patch(account._id, {
            balance: newBalance,
            totalPurchased: account.totalPurchased + amount,
            lastTopUpAt: Date.now(),
        });

        await ctx.db.insert("creditTransactions", {
            userId,
            type: "purchase",
            amount,
            balanceAfter: newBalance,
            description,
            metadata,
            createdAt: Date.now(),
        });

        return { newBalance };
    },
});

/**
 * Debit credits for service usage.
 * Throws if insufficient balance. Atomic check+debit.
 */
export const debitCredits = internalMutation({
    args: {
        userId: v.string(),
        amount: v.number(),
        description: v.string(),
        metadata: v.optional(v.string()),
    },
    handler: async (ctx, { userId, amount, description, metadata }) => {
        const account = await ctx.db
            .query("creditAccounts")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();

        if (!account) throw new Error("Credit account not found");
        if (amount <= 0) throw new Error("Amount must be positive");
        if (account.balance < amount) {
            throw new Error(
                `Insufficient credits. Required: ${amount}, Available: ${account.balance}. ` +
                `Purchase more credits using the buy_credits tool.`
            );
        }

        const newBalance = account.balance - amount;

        await ctx.db.patch(account._id, {
            balance: newBalance,
            totalUsed: account.totalUsed + amount,
        });

        await ctx.db.insert("creditTransactions", {
            userId,
            type: "debit",
            amount: -amount,
            balanceAfter: newBalance,
            description,
            metadata,
            createdAt: Date.now(),
        });

        return { newBalance };
    },
});

// ── Queries (Authenticated) ─────────────────────────────────

export const getBalance = query({
    args: {},
    handler: async (ctx) => {
        const userId = await auth.getUserId(ctx);
        if (!userId) return null;

        const account = await ctx.db
            .query("creditAccounts")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();

        if (!account) return { balance: 0, totalPurchased: 0, totalUsed: 0 };

        return {
            balance: account.balance,
            totalPurchased: account.totalPurchased,
            totalUsed: account.totalUsed,
            lastTopUpAt: account.lastTopUpAt,
        };
    },
});

export const getTransactionHistory = query({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, { limit }) => {
        const userId = await auth.getUserId(ctx);
        if (!userId) return [];

        const txns = await ctx.db
            .query("creditTransactions")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .order("desc")
            .take(limit ?? 50);

        return txns;
    },
});

// ── API Key-based Queries (for MCP tools) ───────────────────

export const getBalanceByUserId = internalQuery({
    args: { userId: v.string() },
    handler: async (ctx, { userId }) => {
        const account = await ctx.db
            .query("creditAccounts")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();

        if (!account) return { balance: 0, totalPurchased: 0, totalUsed: 0 };

        return {
            balance: account.balance,
            totalPurchased: account.totalPurchased,
            totalUsed: account.totalUsed,
            lastTopUpAt: account.lastTopUpAt,
        };
    },
});

export const getTransactionsByUserId = internalQuery({
    args: { userId: v.string(), limit: v.optional(v.number()) },
    handler: async (ctx, { userId, limit }) => {
        return await ctx.db
            .query("creditTransactions")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .order("desc")
            .take(limit ?? 50);
    },
});
