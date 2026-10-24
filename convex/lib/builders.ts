// Typed Convex builders that work before `npx convex dev` has generated convex/_generated/.
// Same types _generated/server.ts would give (DataModel from our schema). After codegen,
// functions may keep importing from here; references go through `api`/`internal` below.
import {
  actionGeneric,
  anyApi,
  httpActionGeneric,
  internalActionGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import type {
  ActionBuilder,
  DataModelFromSchemaDefinition,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  HttpActionBuilder,
  MutationBuilder,
  QueryBuilder,
} from "convex/server";
import type schema from "../schema";

export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
export type QueryCtx = GenericQueryCtx<DataModel>;
export type MutationCtx = GenericMutationCtx<DataModel>;
export type ActionCtx = GenericActionCtx<DataModel>;

export const query = queryGeneric as QueryBuilder<DataModel, "public">;
export const internalQuery = internalQueryGeneric as QueryBuilder<DataModel, "internal">;
export const mutation = mutationGeneric as MutationBuilder<DataModel, "public">;
export const internalMutation = internalMutationGeneric as MutationBuilder<DataModel, "internal">;
export const action = actionGeneric as ActionBuilder<DataModel, "public">;
export const internalAction = internalActionGeneric as ActionBuilder<DataModel, "internal">;
export const httpAction = httpActionGeneric as HttpActionBuilder;

/** Untyped function references, e.g. internal.context.forDonor (module path : export name). */
export const api = anyApi;
export const internal = anyApi;
