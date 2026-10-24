import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Domain tables store the engine's string id in `key` (index by_key); cross-table
// references use those engine keys, not v.id, so engine types map 1:1 to rows.
const charityId = v.union(v.literal("demo-pantry-a"), v.literal("demo-pantry-b"));
const impactKind = v.union(
  v.literal("meals"),
  v.literal("produce"),
  v.literal("volunteer_shifts"),
);

export default defineSchema({
  charities: defineTable({
    key: charityId,
    name: v.string(),
    siteUrl: v.string(),
    fictional: v.literal(true),
  }).index("by_key", ["key"]),

  donors: defineTable({
    key: v.string(),
    firstName: v.union(v.string(), v.null()),
    email: v.union(v.string(), v.null()), // demo inboxes only; never in URLs/APIs
  }).index("by_key", ["key"]),

  donations: defineTable({
    key: v.string(),
    donorId: v.string(),
    charityId,
    amountCents: v.number(),
    createdAt: v.number(),
    testMode: v.literal(true),
  })
    .index("by_key", ["key"])
    .index("by_charity_createdAt", ["charityId", "createdAt"])
    .index("by_donor", ["donorId"]),

  impactLogs: defineTable({
    key: v.string(),
    charityId,
    kind: impactKind,
    count: v.number(),
    unit: v.string(),
    note: v.union(v.string(), v.null()),
    photoStorageId: v.union(v.id("_storage"), v.null()),
    photoPath: v.union(v.string(), v.null()), // seeded placeholder served statically
    loggedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_charity_loggedAt", ["charityId", "loggedAt"]),

  allocations: defineTable({
    donorId: v.string(),
    charityId,
    logId: v.string(),
    kind: impactKind,
    unit: v.string(),
    loggedAt: v.number(),
    share: v.number(),
    estimatedQuantity: v.number(),
    isEstimate: v.literal(true),
  })
    .index("by_donor_charity", ["donorId", "charityId"])
    .index("by_log", ["logId"]),

  visits: defineTable({
    donorId: v.string(),
    charityId,
    at: v.number(),
  }).index("by_donor_charity_at", ["donorId", "charityId", "at"]),

  narratives: defineTable({
    donorId: v.string(),
    charityId,
    factsHash: v.string(),
    json: v.string(),
    source: v.union(v.literal("claude"), v.literal("template")),
    createdAt: v.number(),
  }).index("by_donor_charity_hash", ["donorId", "charityId", "factsHash"]),

  milestoneEmails: defineTable({
    donorId: v.string(),
    charityId,
    threshold: v.string(),
    sentAt: v.number(),
  }).index("by_donor_charity", ["donorId", "charityId"]),
});
