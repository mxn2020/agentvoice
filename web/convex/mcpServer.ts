import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * AgentVoice MCP Server
 *
 * Implements the Model Context Protocol (MCP) over Streamable HTTP transport.
 * AI agents connect to this server to access voice/audio services.
 *
 * Protocol: JSON-RPC 2.0 over HTTP
 * Auth: Bearer token (API key) in Authorization header
 */

// ── Types ────────────────────────────────────────────────────

interface JsonRpcRequest {
    jsonrpc: "2.0";
    id?: string | number;
    method: string;
    params?: Record<string, unknown>;
}

interface JsonRpcResponse {
    jsonrpc: "2.0";
    id: string | number | null;
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
}

interface McpToolDefinition {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: Record<string, unknown>;
        required?: string[];
    };
}

// ── Tool Definitions ─────────────────────────────────────────

const MCP_TOOLS: McpToolDefinition[] = [
    {
        name: "create_account",
        description: "Create a new AgentVoice account. Returns an API key for authentication.",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string", description: "Display name for the account" },
                email: { type: "string", description: "Email address (optional, for notifications)" },
            },
            required: ["name"],
        },
    },
    {
        name: "get_account",
        description: "Get account information including credit balance and usage statistics.",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "buy_credits",
        description: "Purchase credits via crypto payment. Returns a payment URL. Available packages: starter (100 credits, $5), standard (500 credits, $20), pro (2000 credits, $70), enterprise (10000 credits, $300).",
        inputSchema: {
            type: "object",
            properties: {
                package: {
                    type: "string",
                    enum: ["starter", "standard", "pro", "enterprise"],
                    description: "Credit package to purchase",
                },
            },
            required: ["package"],
        },
    },
    {
        name: "check_payment",
        description: "Check the status of a pending credit purchase.",
        inputSchema: {
            type: "object",
            properties: {
                payment_id: { type: "string", description: "The payment external ID returned by buy_credits" },
            },
            required: ["payment_id"],
        },
    },
    {
        name: "list_services",
        description: "List all available services and their credit costs per unit.",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "initiate_call",
        description: "Start a voice call with AI. Returns a call ID to track progress. Requires sufficient credits.",
        inputSchema: {
            type: "object",
            properties: {
                tier: {
                    type: "string",
                    enum: ["basic", "pro", "premium"],
                    description: "Service tier (affects voice quality and cost)",
                },
                scenario: {
                    type: "string",
                    description: "The scenario/system prompt for the AI voice agent",
                },
                voice_id: {
                    type: "string",
                    description: "Voice ID to use (optional, uses tier default)",
                },
                max_duration_minutes: {
                    type: "number",
                    description: "Maximum call duration in minutes (default: 5)",
                },
                phone_number: {
                    type: "string",
                    description: "Target phone number for outbound call (optional)",
                },
            },
            required: ["tier", "scenario"],
        },
    },
    {
        name: "get_call_status",
        description: "Get the current status of a voice call.",
        inputSchema: {
            type: "object",
            properties: {
                call_id: { type: "string", description: "The call ID" },
            },
            required: ["call_id"],
        },
    },
    {
        name: "get_call_transcript",
        description: "Get the full transcript of a completed voice call.",
        inputSchema: {
            type: "object",
            properties: {
                call_id: { type: "string", description: "The call ID" },
            },
            required: ["call_id"],
        },
    },
    {
        name: "get_call_recording",
        description: "Get the recording URL of a completed voice call.",
        inputSchema: {
            type: "object",
            properties: {
                call_id: { type: "string", description: "The call ID" },
            },
            required: ["call_id"],
        },
    },
    {
        name: "get_call_summary",
        description: "Get the AI-generated summary of a completed voice call.",
        inputSchema: {
            type: "object",
            properties: {
                call_id: { type: "string", description: "The call ID" },
            },
            required: ["call_id"],
        },
    },
    {
        name: "transcribe_audio",
        description: "Submit an audio file URL for transcription. Returns a job ID.",
        inputSchema: {
            type: "object",
            properties: {
                audio_url: { type: "string", description: "URL of the audio file to transcribe" },
                tier: {
                    type: "string",
                    enum: ["basic", "pro", "premium"],
                    description: "Service tier (affects accuracy and cost)",
                },
                language: { type: "string", description: "Language code (e.g. 'en', 'de'). Default: auto-detect" },
            },
            required: ["audio_url", "tier"],
        },
    },
    {
        name: "get_transcription",
        description: "Get the result of a transcription job.",
        inputSchema: {
            type: "object",
            properties: {
                job_id: { type: "string", description: "The transcription job ID" },
            },
            required: ["job_id"],
        },
    },
    {
        name: "text_to_speech",
        description: "Convert text to speech audio. Returns a job ID.",
        inputSchema: {
            type: "object",
            properties: {
                text: { type: "string", description: "Text to convert to speech" },
                tier: {
                    type: "string",
                    enum: ["basic", "pro", "premium"],
                    description: "Service tier (affects voice quality and cost)",
                },
                voice_id: { type: "string", description: "Voice ID. Default: tier default voice" },
                format: {
                    type: "string",
                    enum: ["mp3", "wav", "ogg"],
                    description: "Output audio format. Default: mp3",
                },
            },
            required: ["text", "tier"],
        },
    },
    {
        name: "get_tts_result",
        description: "Get the result of a text-to-speech job.",
        inputSchema: {
            type: "object",
            properties: {
                job_id: { type: "string", description: "The TTS job ID" },
            },
            required: ["job_id"],
        },
    },
];

// ── Authentication ───────────────────────────────────────────

async function hashApiKey(key: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

function generateApiKey(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let key = "av_sk_";
    for (let i = 0; i < 48; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
}

// ── MCP Protocol Handler ─────────────────────────────────────

function makeResponse(result: unknown, id: string | number | null): JsonRpcResponse {
    return { jsonrpc: "2.0", id, result };
}

function makeError(code: number, message: string, id: string | number | null, data?: unknown): JsonRpcResponse {
    return { jsonrpc: "2.0", id, error: { code, message, data } };
}

// ── Tool Execution ───────────────────────────────────────────

async function executeTool(
    ctx: any,
    toolName: string,
    args: Record<string, unknown>,
    userId: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    const result = await executeToolInternal(ctx, toolName, args, userId);
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}

async function executeToolInternal(
    ctx: any,
    toolName: string,
    args: Record<string, unknown>,
    userId: string,
): Promise<unknown> {
    switch (toolName) {
        case "get_account": {
            const balance = await ctx.runQuery(internal.credits.getBalanceByUserId, { userId });
            const profile = await ctx.runQuery(internal.users.getProfileByUserId, { userId });
            return {
                name: profile?.name ?? "Agent",
                role: profile?.role ?? "user",
                credits: balance,
            };
        }

        case "buy_credits": {
            const packageId = args.package as string;
            const result = await ctx.runMutation(internal.cryptoPayments.createPayment, {
                userId,
                packageId,
            });
            return {
                message: "Payment created. Complete the payment at the URL below.",
                ...result,
            };
        }

        case "check_payment": {
            const paymentId = args.payment_id as string;
            const payment = await ctx.runQuery(internal.cryptoPayments.getPaymentByExternalId, {
                externalId: paymentId,
            });
            if (!payment) return { error: "Payment not found" };
            return {
                status: payment.status,
                amountUsd: payment.amountUsd,
                credits: payment.creditsToAdd,
                currency: payment.currency,
                txHash: payment.txHash,
                confirmedAt: payment.confirmedAt,
            };
        }

        case "list_services": {
            const tiers = await ctx.runQuery(internal.adminServices.getActiveTiers);
            return {
                services: tiers.map((t: any) => ({
                    tier: t.name,
                    displayName: t.displayName,
                    description: t.description,
                    pricing: {
                        voiceCallPerMinute: t.costPerMinuteCall,
                        transcriptionPerMinute: t.costPerTranscriptionMinute,
                        ttsPerThousandChars: t.costPerTtsCharacter,
                    },
                    features: t.features,
                    maxCallDuration: t.maxCallDurationMinutes,
                })),
            };
        }

        case "initiate_call": {
            const result = await ctx.runMutation(internal.voiceCalls.initiateCall, {
                userId,
                tierName: args.tier as string,
                scenario: args.scenario as string,
                voiceId: args.voice_id as string | undefined,
                maxDurationMinutes: (args.max_duration_minutes as number) ?? 5,
                phoneNumber: args.phone_number as string | undefined,
            });
            return result;
        }

        case "get_call_status": {
            const callId = args.call_id as string;
            const call = await ctx.runQuery(internal.voiceCalls.getCallById, {
                callId,
                userId,
            });
            if (!call) return { error: "Call not found" };
            return {
                id: call._id,
                status: call.status,
                tier: call.tierName,
                duration: call.durationSeconds,
                creditsCharged: call.creditsCharged,
                startedAt: call.startedAt,
                endedAt: call.endedAt,
            };
        }

        case "get_call_transcript": {
            const transcript = await ctx.runQuery(internal.voiceCalls.getTranscript, {
                callId: args.call_id as string,
                userId,
            });
            if (!transcript) return { error: "Transcript not available" };
            return {
                callId: args.call_id,
                transcript: transcript.content,
                wordCount: transcript.wordCount,
                language: transcript.language,
            };
        }

        case "get_call_recording": {
            const recording = await ctx.runQuery(internal.voiceCalls.getRecording, {
                callId: args.call_id as string,
                userId,
            });
            if (!recording) return { error: "Recording not available" };
            return {
                callId: args.call_id,
                url: recording.externalUrl ?? `Storage: ${recording.storageId}`,
                format: recording.format,
                durationSeconds: recording.durationSeconds,
            };
        }

        case "get_call_summary": {
            const summary = await ctx.runQuery(internal.voiceCalls.getSummary, {
                callId: args.call_id as string,
                userId,
            });
            if (!summary) return { error: "Summary not available" };
            return {
                callId: args.call_id,
                summary: summary.summary,
                keyPoints: summary.keyPoints ? JSON.parse(summary.keyPoints) : [],
                sentiment: summary.sentiment,
            };
        }

        case "transcribe_audio": {
            const result = await ctx.runMutation(internal.transcription.createJob, {
                userId,
                tierName: args.tier as string,
                audioUrl: args.audio_url as string,
                language: args.language as string | undefined,
            });
            return result;
        }

        case "get_transcription": {
            const job = await ctx.runQuery(internal.transcription.getJob, {
                jobId: args.job_id as string,
                userId,
            });
            if (!job) return { error: "Transcription job not found" };
            return {
                id: job._id,
                status: job.status,
                transcript: job.transcript,
                language: job.language,
                duration: job.inputDurationSeconds,
                creditsCharged: job.creditsCharged,
            };
        }

        case "text_to_speech": {
            const result = await ctx.runMutation(internal.tts.createJob, {
                userId,
                tierName: args.tier as string,
                text: args.text as string,
                voiceId: args.voice_id as string | undefined,
                format: (args.format as string) ?? "mp3",
            });
            return result;
        }

        case "get_tts_result": {
            const job = await ctx.runQuery(internal.tts.getJob, {
                jobId: args.job_id as string,
                userId,
            });
            if (!job) return { error: "TTS job not found" };
            return {
                id: job._id,
                status: job.status,
                outputUrl: job.outputStorageId ? `Storage: ${job.outputStorageId}` : undefined,
                durationSeconds: job.durationSeconds,
                creditsCharged: job.creditsCharged,
            };
        }

        default:
            throw new Error(`Unknown tool: ${toolName}`);
    }
}

// ── HTTP Action (MCP Endpoint) ───────────────────────────────

/**
 * Main MCP HTTP handler.
 * Supports JSON-RPC 2.0 over Streamable HTTP.
 */
export const mcpHandler = httpAction(async (ctx, request) => {
    // CORS headers for all responses
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
        "Access-Control-Expose-Headers": "Mcp-Session-Id",
    };

    // Handle OPTIONS for CORS
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Parse the JSON-RPC request
    let rpcRequest: JsonRpcRequest;
    try {
        const body = await request.text();
        rpcRequest = JSON.parse(body);
    } catch {
        return new Response(
            JSON.stringify(makeError(-32700, "Parse error", null)),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const { method, params, id } = rpcRequest;

    // ── Protocol methods (no auth required) ──

    if (method === "initialize") {
        const result = {
            protocolVersion: "2025-03-26",
            capabilities: {
                tools: { listChanged: false },
            },
            serverInfo: {
                name: "AgentVoice",
                version: "1.0.0",
            },
        };
        return new Response(
            JSON.stringify(makeResponse(result, id ?? null)),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    if (method === "notifications/initialized") {
        // Acknowledgement, no response needed for notification
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (method === "tools/list") {
        const result = {
            tools: MCP_TOOLS,
        };
        return new Response(
            JSON.stringify(makeResponse(result, id ?? null)),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    // ── create_account (no auth required — creates the account) ──

    if (method === "tools/call" && (params as any)?.name === "create_account") {
        try {
            const toolArgs = (params as any)?.arguments ?? {};
            const rawKey = generateApiKey();
            const keyHash = await hashApiKey(rawKey);
            const keyPrefix = rawKey.substring(0, 14);

            // Create user profile
            const userId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

            await ctx.runMutation(internal.users.ensureProfileInternal, { userId });
            await ctx.runMutation(internal.credits.ensureAccount, { userId });

            // Create API key
            await ctx.runMutation(internal.apiKeys.createKey, {
                userId,
                name: toolArgs.name ?? "Default Key",
                keyHash,
                keyPrefix,
                scopes: ["calls", "transcription", "tts", "credits"],
            });

            const result = {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        message: "Account created successfully! Save your API key — it won't be shown again.",
                        api_key: rawKey,
                        account_id: userId,
                        instructions: "Set this as your Bearer token in the Authorization header for all future requests.",
                    }, null, 2),
                }],
            };

            return new Response(
                JSON.stringify(makeResponse(result, id ?? null)),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        } catch (err: any) {
            return new Response(
                JSON.stringify(makeError(-32603, err.message, id ?? null)),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }
    }

    // ── Authenticated methods ──

    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
            JSON.stringify(makeError(-32001, "Authentication required. Provide API key as Bearer token.", id ?? null)),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const apiKey = authHeader.substring(7);
    const keyHash = await hashApiKey(apiKey);

    const keyRecord = await ctx.runQuery(internal.apiKeys.getKeyByHash, { keyHash });
    if (!keyRecord || keyRecord.revokedAt) {
        return new Response(
            JSON.stringify(makeError(-32001, "Invalid or revoked API key.", id ?? null)),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const userId = keyRecord.userId;

    // Update last used timestamp
    await ctx.runMutation(internal.apiKeys.updateLastUsed, { keyId: keyRecord._id });

    // ── tools/call ──

    if (method === "tools/call") {
        const toolName = (params as any)?.name;
        const toolArgs = (params as any)?.arguments ?? {};

        if (!toolName) {
            return new Response(
                JSON.stringify(makeError(-32602, "Missing tool name", id ?? null)),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        try {
            const result = await executeTool(ctx, toolName, toolArgs, userId);
            return new Response(
                JSON.stringify(makeResponse(result, id ?? null)),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        } catch (err: any) {
            return new Response(
                JSON.stringify(makeError(-32603, err.message, id ?? null)),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }
    }

    // ── Unknown method ──

    return new Response(
        JSON.stringify(makeError(-32601, `Method not found: ${method}`, id ?? null)),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
});
