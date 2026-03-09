import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { mcpHandler } from "./mcpServer";

const http = httpRouter();

auth.addHttpRoutes(http);

// ── MCP Protocol Endpoint ────────────────────────────────────
// Streamable HTTP transport for Model Context Protocol
http.route({
    path: "/mcp",
    method: "POST",
    handler: mcpHandler,
});

// MCP OPTIONS for CORS preflight
http.route({
    path: "/mcp",
    method: "OPTIONS",
    handler: mcpHandler,
});

// ── Crypto Payment Webhook ───────────────────────────────────
http.route({
    path: "/api/crypto/webhook",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        const body = await request.text();

        try {
            const event = JSON.parse(body);
            console.log(`[Crypto Webhook] Received event type: ${event.type ?? event.event_type}`);

            // Coinbase Commerce webhook events
            const eventType = event.type ?? event.event_type;
            const chargeData = event.data ?? event;

            if (eventType === "charge:confirmed" || eventType === "charge:resolved") {
                const externalId = chargeData.metadata?.externalId ?? chargeData.id;
                const txHash = chargeData.payments?.[0]?.transaction_id;
                const currency = chargeData.payments?.[0]?.network;

                await ctx.runMutation(internal.cryptoPayments.confirmPayment, {
                    externalId,
                    txHash,
                    currency,
                });

                console.log(`[Crypto Webhook] Payment confirmed: ${externalId}`);
            }

            if (eventType === "charge:failed") {
                const externalId = chargeData.metadata?.externalId ?? chargeData.id;
                await ctx.runMutation(internal.cryptoPayments.failPayment, {
                    externalId,
                    reason: "Payment failed",
                });
            }

            return new Response("OK", { status: 200 });
        } catch (err) {
            console.error("[Crypto Webhook] Error:", err);
            return new Response("Webhook error", { status: 400 });
        }
    }),
});

// ── Stripe Webhook (kept from template) ──────────────────────
// Stripe webhooks are not used by AgentVoice's primary flow
// but kept for potential future admin billing features.

// ── Health Check ─────────────────────────────────────────────
http.route({
    path: "/health",
    method: "GET",
    handler: httpAction(async () => {
        return new Response(
            JSON.stringify({
                status: "ok",
                service: "AgentVoice MCP Server",
                version: "1.0.0",
                timestamp: new Date().toISOString(),
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
        );
    }),
});

export default http;
