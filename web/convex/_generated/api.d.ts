/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminServices from "../adminServices.js";
import type * as aiLogs from "../aiLogs.js";
import type * as apiKeys from "../apiKeys.js";
import type * as auditLog from "../auditLog.js";
import type * as auth from "../auth.js";
import type * as credits from "../credits.js";
import type * as cryptoPayments from "../cryptoPayments.js";
import type * as devLogs from "../devLogs.js";
import type * as http from "../http.js";
import type * as mcpServer from "../mcpServer.js";
import type * as modelCosts from "../modelCosts.js";
import type * as modelTests from "../modelTests.js";
import type * as nvidia from "../nvidia.js";
import type * as prompts from "../prompts.js";
import type * as rateLimit from "../rateLimit.js";
import type * as stripe from "../stripe.js";
import type * as stripeAdmin from "../stripeAdmin.js";
import type * as transcription from "../transcription.js";
import type * as tts from "../tts.js";
import type * as usageLimits from "../usageLimits.js";
import type * as users from "../users.js";
import type * as voiceCalls from "../voiceCalls.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminServices: typeof adminServices;
  aiLogs: typeof aiLogs;
  apiKeys: typeof apiKeys;
  auditLog: typeof auditLog;
  auth: typeof auth;
  credits: typeof credits;
  cryptoPayments: typeof cryptoPayments;
  devLogs: typeof devLogs;
  http: typeof http;
  mcpServer: typeof mcpServer;
  modelCosts: typeof modelCosts;
  modelTests: typeof modelTests;
  nvidia: typeof nvidia;
  prompts: typeof prompts;
  rateLimit: typeof rateLimit;
  stripe: typeof stripe;
  stripeAdmin: typeof stripeAdmin;
  transcription: typeof transcription;
  tts: typeof tts;
  usageLimits: typeof usageLimits;
  users: typeof users;
  voiceCalls: typeof voiceCalls;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
