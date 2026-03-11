import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
    ...authTables,

    // ── User Profiles ────────────────────────────────────────────
    userProfiles: defineTable({
        userId: v.string(),
        name: v.optional(v.string()),
        role: v.union(v.literal("user"), v.literal("admin")),
        plan: v.optional(v.string()),
        createdAt: v.optional(v.number()),
        stripeCustomerId: v.optional(v.string()),
        monthlyUsageCount: v.optional(v.number()),
        usageResetAt: v.optional(v.number()),
    }).index("by_userId", ["userId"]),

    // ── API Keys (Agent Authentication) ──────────────────────────
    // Agents authenticate via API keys instead of browser auth.
    // Keys are hashed (SHA-256) for storage. The raw key is shown once.
    apiKeys: defineTable({
        userId: v.string(),
        name: v.string(),                 // e.g. "My Agent Key"
        keyHash: v.string(),              // SHA-256 hash of the raw key
        keyPrefix: v.string(),            // First 8 chars for identification (e.g. "av_sk_ab")
        scopes: v.array(v.string()),      // e.g. ["calls", "transcription", "tts", "credits"]
        lastUsedAt: v.optional(v.number()),
        revokedAt: v.optional(v.number()),
        createdAt: v.number(),
    })
        .index("by_userId", ["userId"])
        .index("by_keyHash", ["keyHash"]),

    // ── Credit Accounts ──────────────────────────────────────────
    // Each user has one credit account. Credits are the universal currency.
    creditAccounts: defineTable({
        userId: v.string(),
        balance: v.number(),              // Current credit balance
        totalPurchased: v.number(),       // Lifetime credits purchased
        totalUsed: v.number(),            // Lifetime credits consumed
        lastTopUpAt: v.optional(v.number()),
    }).index("by_userId", ["userId"]),

    // ── Credit Transactions ──────────────────────────────────────
    // Immutable ledger of all credit movements.
    creditTransactions: defineTable({
        userId: v.string(),
        type: v.union(v.literal("purchase"), v.literal("debit"), v.literal("refund"), v.literal("bonus")),
        amount: v.number(),               // Positive for purchase/refund/bonus, negative for debit
        balanceAfter: v.number(),          // Balance after this transaction
        description: v.string(),           // e.g. "Voice call (Premium tier, 3m 22s)"
        metadata: v.optional(v.string()),  // JSON: { paymentId, callId, jobId, etc. }
        createdAt: v.number(),
    })
        .index("by_userId", ["userId", "createdAt"])
        .index("by_type", ["type", "createdAt"]),

    // ── Crypto Payments ──────────────────────────────────────────
    // Tracks crypto payment intents and confirmations.
    cryptoPayments: defineTable({
        userId: v.string(),
        provider: v.string(),             // e.g. "coinbase_commerce"
        externalId: v.string(),           // Provider's charge/payment ID
        status: v.union(
            v.literal("pending"),
            v.literal("confirmed"),
            v.literal("failed"),
            v.literal("expired"),
        ),
        amountUsd: v.number(),            // USD equivalent
        creditsToAdd: v.number(),         // Credits to add upon confirmation
        currency: v.optional(v.string()), // e.g. "BTC", "ETH", "USDC"
        txHash: v.optional(v.string()),   // On-chain transaction hash
        paymentUrl: v.optional(v.string()), // Hosted checkout URL
        expiresAt: v.optional(v.number()),
        confirmedAt: v.optional(v.number()),
        createdAt: v.number(),
    })
        .index("by_userId", ["userId", "createdAt"])
        .index("by_externalId", ["externalId"])
        .index("by_status", ["status"]),

    // ── Service Tiers ────────────────────────────────────────────
    // Admin-configured tiers that map to providers + pricing.
    // Agents see: Basic, Pro, Premium. Admin configures what's behind each.
    serviceTiers: defineTable({
        name: v.string(),                 // "basic", "pro", "premium"
        displayName: v.string(),          // "Basic", "Pro", "Premium"
        description: v.string(),
        providerId: v.string(),           // Reference to providerConfigs
        // Credit costs per unit
        costPerMinuteCall: v.number(),    // Credits per minute of voice call
        costPerTranscriptionMinute: v.number(), // Credits per minute of audio transcribed
        costPerTtsCharacter: v.number(),  // Credits per 1000 chars of TTS
        // Limits
        maxCallDurationMinutes: v.number(),
        // Feature flags
        features: v.array(v.string()),    // e.g. ["hd_voice", "custom_voice", "call_recording"]
        isActive: v.boolean(),
        sortOrder: v.number(),
        updatedAt: v.number(),
    })
        .index("by_name", ["name"])
        .index("by_isActive", ["isActive", "sortOrder"]),

    // ── Provider Configs ─────────────────────────────────────────
    // Admin-managed third-party provider credentials and settings.
    providerConfigs: defineTable({
        name: v.string(),                 // e.g. "deepgram", "elevenlabs", "openai"
        displayName: v.string(),
        type: v.union(
            v.literal("voice_call"),
            v.literal("transcription"),
            v.literal("tts"),
            v.literal("multi"),           // Provider supports multiple services
        ),
        // Credentials stored as encrypted JSON string
        credentials: v.string(),          // JSON: { apiKey, endpoint, ... }
        isActive: v.boolean(),
        healthStatus: v.union(v.literal("healthy"), v.literal("degraded"), v.literal("down"), v.literal("unknown")),
        lastHealthCheck: v.optional(v.number()),
        config: v.optional(v.string()),   // JSON: provider-specific config
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_name", ["name"])
        .index("by_type", ["type"]),

    // ── Voice Calls ──────────────────────────────────────────────
    // Records of AI voice calls initiated by agents.
    voiceCalls: defineTable({
        userId: v.string(),
        tierId: v.id("serviceTiers"),
        tierName: v.string(),             // Denormalized for fast display
        status: v.union(
            v.literal("initiating"),
            v.literal("ringing"),
            v.literal("in_progress"),
            v.literal("completed"),
            v.literal("failed"),
            v.literal("cancelled"),
        ),
        // Call configuration
        voiceId: v.optional(v.string()),  // Selected voice
        scenario: v.optional(v.string()), // System prompt / call scenario
        phoneNumber: v.optional(v.string()), // Target phone number (if applicable)
        // Timing
        startedAt: v.optional(v.number()),
        endedAt: v.optional(v.number()),
        durationSeconds: v.optional(v.number()),
        // Cost
        creditsCharged: v.number(),
        // Provider tracking
        providerId: v.string(),
        providerCallId: v.optional(v.string()),
        // Error handling
        errorMessage: v.optional(v.string()),
        createdAt: v.number(),
    })
        .index("by_userId", ["userId", "createdAt"])
        .index("by_status", ["status"])
        .index("by_providerCallId", ["providerCallId"]),

    // ── Call Recordings ──────────────────────────────────────────
    callRecordings: defineTable({
        callId: v.id("voiceCalls"),
        userId: v.string(),
        storageId: v.optional(v.id("_storage")), // Convex file storage
        externalUrl: v.optional(v.string()),       // Or external URL
        format: v.string(),               // "mp3", "wav", etc.
        durationSeconds: v.optional(v.number()),
        sizeBytes: v.optional(v.number()),
        createdAt: v.number(),
    }).index("by_callId", ["callId"]),

    // ── Call Transcripts ─────────────────────────────────────────
    callTranscripts: defineTable({
        callId: v.id("voiceCalls"),
        userId: v.string(),
        content: v.string(),              // Full transcript text
        segments: v.optional(v.string()), // JSON: timestamped segments
        wordCount: v.number(),
        language: v.optional(v.string()),
        createdAt: v.number(),
    }).index("by_callId", ["callId"]),

    // ── Call Summaries ───────────────────────────────────────────
    callSummaries: defineTable({
        callId: v.id("voiceCalls"),
        userId: v.string(),
        summary: v.string(),
        keyPoints: v.optional(v.string()), // JSON array of key points
        sentiment: v.optional(v.string()), // "positive", "neutral", "negative"
        createdAt: v.number(),
    }).index("by_callId", ["callId"]),

    // ── Transcription Jobs ───────────────────────────────────────
    // Standalone audio file transcription (not tied to a call).
    transcriptionJobs: defineTable({
        userId: v.string(),
        tierId: v.id("serviceTiers"),
        status: v.union(
            v.literal("pending"),
            v.literal("processing"),
            v.literal("completed"),
            v.literal("failed"),
        ),
        // Input
        inputStorageId: v.optional(v.id("_storage")),
        inputUrl: v.optional(v.string()),
        inputFormat: v.string(),
        inputDurationSeconds: v.optional(v.number()),
        // Output
        transcript: v.optional(v.string()),
        segments: v.optional(v.string()),  // JSON
        language: v.optional(v.string()),
        // Cost
        creditsCharged: v.number(),
        // Timing
        processingStartedAt: v.optional(v.number()),
        completedAt: v.optional(v.number()),
        errorMessage: v.optional(v.string()),
        createdAt: v.number(),
    })
        .index("by_userId", ["userId", "createdAt"])
        .index("by_status", ["status"]),

    // ── TTS Jobs ─────────────────────────────────────────────────
    // Text-to-speech conversion jobs.
    ttsJobs: defineTable({
        userId: v.string(),
        tierId: v.id("serviceTiers"),
        status: v.union(
            v.literal("pending"),
            v.literal("processing"),
            v.literal("completed"),
            v.literal("failed"),
        ),
        // Input
        inputText: v.string(),
        voiceId: v.string(),
        outputFormat: v.string(),         // "mp3", "wav", etc.
        // Output
        outputStorageId: v.optional(v.id("_storage")),
        durationSeconds: v.optional(v.number()),
        sizeBytes: v.optional(v.number()),
        // Cost
        creditsCharged: v.number(),
        characterCount: v.number(),
        // Timing
        completedAt: v.optional(v.number()),
        errorMessage: v.optional(v.string()),
        createdAt: v.number(),
    })
        .index("by_userId", ["userId", "createdAt"])
        .index("by_status", ["status"]),

    // ── AI Prompts (CMS) ─────────────────────────────────────────
    aiPrompts: defineTable({
        promptId: v.string(),
        name: v.string(),
        content: v.string(),
        description: v.string(),
        updatedAt: v.number(),
    }).index("by_prompt_id", ["promptId"]),

    // ── AI Call Logs ─────────────────────────────────────────────
    aiLogs: defineTable({
        requestId: v.string(),
        model: v.string(),
        caller: v.string(),
        timestamp: v.number(),
        durationMs: v.number(),
        systemPrompt: v.string(),
        userPromptText: v.string(),
        hasImage: v.boolean(),
        imageSizeBytes: v.optional(v.number()),
        temperature: v.optional(v.number()),
        maxTokens: v.optional(v.number()),
        requestBodySize: v.number(),
        status: v.union(v.literal("success"), v.literal("error")),
        httpStatus: v.number(),
        responseContent: v.string(),
        responseSize: v.number(),
        finishReason: v.optional(v.string()),
        promptTokens: v.optional(v.number()),
        completionTokens: v.optional(v.number()),
        totalTokens: v.optional(v.number()),
        errorMessage: v.optional(v.string()),
        inputCostUsd: v.optional(v.number()),
        outputCostUsd: v.optional(v.number()),
        totalCostUsd: v.optional(v.number()),
    })
        .index("by_timestamp", ["timestamp"])
        .index("by_model_timestamp", ["model", "timestamp"])
        .index("by_caller", ["caller"])
        .index("by_status", ["status"]),

    // ── Dev Logs ─────────────────────────────────────────────────
    devLogs: defineTable({
        level: v.union(v.literal("debug"), v.literal("info"), v.literal("warn"), v.literal("error")),
        message: v.string(),
        context: v.optional(v.string()),
        component: v.string(),
        userId: v.optional(v.string()),
    })
        .index("by_level", ["level"])
        .index("by_component", ["component"]),

    // ── Audit Logs ───────────────────────────────────────────────
    auditLogs: defineTable({
        action: v.string(),
        category: v.union(v.literal("auth"), v.literal("admin"), v.literal("system"), v.literal("billing")),
        userId: v.optional(v.string()),
        targetId: v.optional(v.string()),
        details: v.string(),
        ipAddress: v.optional(v.string()),
        timestamp: v.number(),
    })
        .index("by_timestamp", ["timestamp"])
        .index("by_category", ["category", "timestamp"])
        .index("by_userId", ["userId", "timestamp"])
        .index("by_action", ["action", "timestamp"]),

    // ── Rate Limiting ────────────────────────────────────────────
    rateLimits: defineTable({
        key: v.string(),
        tokens: v.number(),
        lastRefill: v.number(),
    }).index("by_key", ["key"]),

    // ── Model Costs ──────────────────────────────────────────────
    modelCosts: defineTable({
        model: v.string(),
        displayName: v.optional(v.string()),
        inputCostPer1k: v.number(),
        outputCostPer1k: v.number(),
        updatedAt: v.optional(v.number()),
    }).index("by_model", ["model"]),

    // ── Model Tests ──────────────────────────────────────────────
    modelTests: defineTable({
        testRunId: v.string(),
        model: v.string(),
        mode: v.string(),
        imageSize: v.number(),
        startedAt: v.number(),
        completedAt: v.number(),
        durationMs: v.number(),
        promptTokens: v.number(),
        completionTokens: v.number(),
        totalTokens: v.number(),
        rawResponse: v.string(),
        parsedResult: v.optional(v.string()),
        parseSuccess: v.boolean(),
        hasAllFields: v.boolean(),
        qualityNotes: v.optional(v.string()),
        status: v.string(),
        errorMessage: v.optional(v.string()),
    })
        .index("by_startedAt", ["startedAt"])
        .index("by_testRunId", ["testRunId"]),
});
