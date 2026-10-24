/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as allocations from "../allocations.js";
import type * as context from "../context.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as demo from "../demo.js";
import type * as donations from "../donations.js";
import type * as email from "../email.js";
import type * as http from "../http.js";
import type * as impact from "../impact.js";
import type * as lib_builders from "../lib/builders.js";
import type * as lib_doc from "../lib/doc.js";
import type * as lib_env from "../lib/env.js";
import type * as lib_mappers from "../lib/mappers.js";
import type * as lib_validators from "../lib/validators.js";
import type * as milestones from "../milestones.js";
import type * as narrative from "../narrative.js";
import type * as ops from "../ops.js";
import type * as seed from "../seed.js";
import type * as tokens from "../tokens.js";
import type * as visits from "../visits.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  allocations: typeof allocations;
  context: typeof context;
  crons: typeof crons;
  dashboard: typeof dashboard;
  demo: typeof demo;
  donations: typeof donations;
  email: typeof email;
  http: typeof http;
  impact: typeof impact;
  "lib/builders": typeof lib_builders;
  "lib/doc": typeof lib_doc;
  "lib/env": typeof lib_env;
  "lib/mappers": typeof lib_mappers;
  "lib/validators": typeof lib_validators;
  milestones: typeof milestones;
  narrative: typeof narrative;
  ops: typeof ops;
  seed: typeof seed;
  tokens: typeof tokens;
  visits: typeof visits;
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
