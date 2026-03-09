import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ── Configuration ────────────────────────────────────────────

// Credit packages available for purchase
export const CREDIT_PACKAGES = [
    { id: "starter", credits: 100, priceUsd: 5, label: "Starter (100 credits)" },
    { id: "standard", credits: 500, priceUsd: 20, label: "Standard (500 credits)" },
    { id: "pro", credits: 2000, priceUsd: 70, label: "Pro (2,000 credits)" },
    { id: "enterprise", credits: 10000, priceUsd: 300, label: "Enterprise (10,000 credits)" },
] as const;

// ── Internal Queries ─────────────────────────────────────────

export const getPaymentByExternalId = internalQuery({
    args: { externalId: v.string() },
    handler: async (ctx, { externalId }) => {
        return await ctx.db
            .query("cryptoPayments")
            .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
            .first();
    },
});

export const getPaymentsByUserId = internalQuery({
    args: { userId: v.string(), limit: v.optional(v.number()) },
    handler: async (ctx, { userId, limit }) => {
        return await ctx.db
            .query("cryptoPayments")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .order("desc")
            .take(limit ?? 20);
    },
});

// ── Internal Mutations ───────────────────────────────────────

/**
 * Create a pending crypto payment.
 * In production, this would call Coinbase Commerce or similar to create
 * a payment charge. For now, we create the record and return payment details.
 */
export const createPayment = internalMutation({
    args: {
        userId: v.string(),
        packageId: v.string(),
    },
    handler: async (ctx, { userId, packageId }) => {
        const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
        if (!pkg) throw new Error(`Invalid package: ${packageId}. Available: ${CREDIT_PACKAGES.map((p) => p.id).join(", ")}`);

        // Generate a unique external ID for this payment
        const externalId = `av_pay_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

        // In production: call Coinbase Commerce API to create a charge
        // const charge = await coinbaseCommerce.createCharge({
        //     name: pkg.label,
        //     description: `${pkg.credits} credits for AgentVoice`,
        //     pricing_type: "fixed_price",
        //     local_price: { amount: pkg.priceUsd.toString(), currency: "USD" },
        //     metadata: { userId, packageId, externalId },
        // });

        const paymentUrl = `https://commerce.coinbase.com/charges/${externalId}`;

        const paymentId = await ctx.db.insert("cryptoPayments", {
            userId,
            provider: "coinbase_commerce",
            externalId,
            status: "pending",
            amountUsd: pkg.priceUsd,
            creditsToAdd: pkg.credits,
            paymentUrl,
            expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour expiry
            createdAt: Date.now(),
        });

        return {
            paymentId,
            externalId,
            paymentUrl,
            amountUsd: pkg.priceUsd,
            credits: pkg.credits,
            expiresAt: Date.now() + 60 * 60 * 1000,
        };
    },
});

/**
 * Confirm a crypto payment (called by webhook).
 * Credits the user's account.
 */
export const confirmPayment = internalMutation({
    args: {
        externalId: v.string(),
        txHash: v.optional(v.string()),
        currency: v.optional(v.string()),
    },
    handler: async (ctx, { externalId, txHash, currency }) => {
        const payment = await ctx.db
            .query("cryptoPayments")
            .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
            .first();

        if (!payment) throw new Error(`Payment not found: ${externalId}`);
        if (payment.status === "confirmed") return { alreadyConfirmed: true };
        if (payment.status !== "pending") throw new Error(`Payment is ${payment.status}, cannot confirm`);

        // Update payment record
        await ctx.db.patch(payment._id, {
            status: "confirmed",
            txHash,
            currency,
            confirmedAt: Date.now(),
        });

        // Credit the user's account
        await ctx.runMutation(internal.credits.addCredits, {
            userId: payment.userId,
            amount: payment.creditsToAdd,
            description: `Purchased ${payment.creditsToAdd} credits ($${payment.amountUsd} USD)`,
            metadata: JSON.stringify({
                paymentId: payment._id,
                externalId,
                txHash,
                currency,
            }),
        });

        // Audit log
        await ctx.db.insert("auditLogs", {
            action: "billing.crypto_payment_confirmed",
            category: "billing",
            userId: payment.userId,
            details: JSON.stringify({
                credits: payment.creditsToAdd,
                amountUsd: payment.amountUsd,
                txHash,
                currency,
            }),
            timestamp: Date.now(),
        });

        return { confirmed: true, credits: payment.creditsToAdd };
    },
});

/**
 * Mark a payment as failed.
 */
export const failPayment = internalMutation({
    args: {
        externalId: v.string(),
        reason: v.optional(v.string()),
    },
    handler: async (ctx, { externalId, reason }) => {
        const payment = await ctx.db
            .query("cryptoPayments")
            .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
            .first();

        if (!payment) throw new Error(`Payment not found: ${externalId}`);
        if (payment.status !== "pending") return;

        await ctx.db.patch(payment._id, { status: "failed" });
    },
});

/**
 * Expire overdue pending payments.
 * Should be called periodically via cron.
 */
export const expireOverduePayments = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();
        const pendingPayments = await ctx.db
            .query("cryptoPayments")
            .withIndex("by_status", (q) => q.eq("status", "pending"))
            .collect();

        let expired = 0;
        for (const payment of pendingPayments) {
            if (payment.expiresAt && payment.expiresAt < now) {
                await ctx.db.patch(payment._id, { status: "expired" });
                expired++;
            }
        }

        return { expired };
    },
});
