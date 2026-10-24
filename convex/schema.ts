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
    hideFromTopDonors: v.optional(v.boolean()), // "Don't list me publicly"
    thankedAt: v.optional(v.union(v.number(), v.null())), // dashboard thank-you queue
    smoke: v.optional(v.boolean()), // e2e smoke-test row; removed by seed:cleanSmoke
  })
    .index("by_key", ["key"])
    .index("by_smoke", ["smoke"]),

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
    smoke: v.optional(v.boolean()), // e2e smoke-test row; removed by seed:cleanSmoke
    requestId: v.optional(v.string()), // staff page retry id: the same id never logs twice
  })
    .index("by_key", ["key"])
    .index("by_charity_loggedAt", ["charityId", "loggedAt"])
    .index("by_charity_requestId", ["charityId", "requestId"])
    .index("by_smoke", ["smoke"]),

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
    // Donor state shown on this visit (contract v2); set best-effort after the view is built.
    state: v.optional(
      v.union(
        v.literal("just_gave"),
        v.literal("news"),
        v.literal("first_impact"),
        v.literal("repeat"),
        v.literal("lapsed"),
        v.literal("returning"),
      ),
    ),
  }).index("by_donor_charity_at", ["donorId", "charityId", "at"]),

  narratives: defineTable({
    donorId: v.string(),
    charityId,
    factsHash: v.string(),
    json: v.string(),
    source: v.union(v.literal("claude"), v.literal("template")),
    guardReasons: v.array(v.string()), // why Claude output was rejected (no PII); [] if accepted
    createdAt: v.number(),
  })
    .index("by_donor_charity_hash", ["donorId", "charityId", "factsHash"])
    .index("by_donor_charity_createdAt", ["donorId", "charityId", "createdAt"]),

  // One row per Claude call attempt, for the call caps (§4). Ids and outcomes only — no text.
  narrativeCalls: defineTable({
    donorId: v.string(),
    charityId,
    at: v.number(),
    outcome: v.union(
      v.literal("claude"), // accepted by the guard
      v.literal("rejected"), // guard rejected → template
      v.literal("error"), // API error / timeout / refusal → template
    ),
    latencyMs: v.number(),
  })
    .index("by_at", ["at"])
    .index("by_donor_charity_at", ["donorId", "charityId", "at"]),

  // One row per (donor, charity, thresholdId) once it fires; status records what happened.
  milestoneEmails: defineTable({
    donorId: v.string(),
    charityId,
    kind: impactKind,
    threshold: v.number(),
    thresholdId: v.string(), // e.g. "meals:25"
    status: v.union(
      v.literal("sent"),
      v.literal("skipped_not_allowlisted"),
      v.literal("skipped_no_email"),
      v.literal("skipped_rate_limited"), // another email went out within 7 days
      v.literal("failed"),
    ),
    sentAt: v.number(), // attempt time
  })
    .index("by_donor_charity", ["donorId", "charityId"])
    .index("by_donor_charity_threshold", ["donorId", "charityId", "thresholdId"]),

  // Last few milestone-check runs, for the hidden staff health page (T23). Counts only.
  opsRuns: defineTable({
    kind: v.literal("milestones"),
    at: v.number(),
    configured: v.boolean(),
    smokeSkipped: v.boolean(), // run was skipped because smoke-test data existed
    checked: v.number(),
    sent: v.number(),
    skipped: v.number(),
    failed: v.number(),
  }).index("by_kind_at", ["kind", "at"]),

  // Demo control panel (T33): wrong-PIN attempts for demo:* (lockout window), no PIN values stored.
  pinFailures: defineTable({
    scope: v.literal("demo"),
    at: v.number(),
  }).index("by_scope_at", ["scope", "at"]),

  // Demo preflight: last live Claude probe (cached PROBE_TTL_MS). Outcome only, no text.
  demoProbes: defineTable({
    at: v.number(),
    source: v.union(v.literal("claude"), v.literal("template")),
    outcome: v.string(), // runNarrative outcome: claude | rejected | error | capped | no_key
    latencyMs: v.number(),
    guardReasons: v.optional(v.array(v.string())), // guard reason codes only (no PII), for debugging
  }).index("by_at", ["at"]),

  // Dashboard (T19)
  expenses: defineTable({
    key: v.string(),
    charityId,
    date: v.number(),
    amountCents: v.number(),
    category: v.union(
      v.literal("food"),
      v.literal("transport"),
      v.literal("facility"),
      v.literal("supplies"),
      v.literal("staff"),
      v.literal("other"),
    ),
    note: v.union(v.string(), v.null()),
    receiptStorageId: v.union(v.id("_storage"), v.null()),
    createdAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_charity_date", ["charityId", "date"]),
});
