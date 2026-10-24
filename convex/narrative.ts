// Donor narrative: cache + call caps + guarded Claude call (T6b). Thin Convex wrapper around
// engine/narrative-run.ts. Logs nothing; stores ids/outcomes only in narrativeCalls.
import Anthropic from "@anthropic-ai/sdk";
import { v } from "convex/values";
import { NARRATIVE_MAX_PER_HOUR, NARRATIVE_MIN_INTERVAL_MS, NARRATIVE_MODEL } from "../engine/config";
import { buildFacts, hashFacts } from "../engine/facts";
import { ModelError, runNarrative } from "../engine/narrative-run";
import type { CallModel } from "../engine/narrative-run";
import type { NarrativeOutput, NarrativeResult } from "../engine/types";
import { internal, internalAction, internalMutation, internalQuery } from "./lib/builders";
import { intEnv } from "./lib/env";
import { vCharityId } from "./lib/validators";

const HOUR_MS = 60 * 60 * 1000;

const vSource = v.union(v.literal("claude"), v.literal("template"));

export const cached = internalQuery({
  args: { donorId: v.string(), charityId: vCharityId, factsHash: v.string() },
  handler: async (ctx, args): Promise<NarrativeResult | null> => {
    const row = await ctx.db
      .query("narratives")
      .withIndex("by_donor_charity_hash", (q) =>
        q.eq("donorId", args.donorId).eq("charityId", args.charityId).eq("factsHash", args.factsHash),
      )
      .order("desc")
      .first();
    if (!row) return null;
    try {
      const output = JSON.parse(row.json) as NarrativeOutput;
      return { output, source: row.source, guardReasons: row.guardReasons };
    } catch {
      return null;
    }
  },
});

export const callStats = internalQuery({
  args: { donorId: v.string(), charityId: vCharityId, now: v.number() },
  handler: async (ctx, args): Promise<{ callsInLastHour: number; lastCallAtForDonor: number | null }> => {
    const recent = await ctx.db
      .query("narrativeCalls")
      .withIndex("by_at", (q) => q.gte("at", args.now - HOUR_MS))
      .collect();
    const last = await ctx.db
      .query("narrativeCalls")
      .withIndex("by_donor_charity_at", (q) => q.eq("donorId", args.donorId).eq("charityId", args.charityId))
      .order("desc")
      .first();
    return { callsInLastHour: recent.length, lastCallAtForDonor: last ? last.at : null };
  },
});

export const store = internalMutation({
  args: {
    donorId: v.string(),
    charityId: vCharityId,
    factsHash: v.string(),
    json: v.string(),
    source: vSource,
    guardReasons: v.array(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("narratives", args);
  },
});

export const recordCall = internalMutation({
  args: {
    donorId: v.string(),
    charityId: vCharityId,
    at: v.number(),
    outcome: v.union(v.literal("claude"), v.literal("rejected"), v.literal("error")),
    latencyMs: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("narrativeCalls", args);
  },
});

/** Real model call via the official SDK. Throws ModelError only; never includes response text. */
function makeCallModel(apiKey: string): CallModel {
  return async (req) => {
    try {
      const client = new Anthropic({ apiKey, maxRetries: 0, timeout: req.timeoutMs });
      const res = await client.beta.messages.create({
        model: NARRATIVE_MODEL,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: req.system,
        messages: [{ role: "user", content: req.user }],
        output_config: {
          effort: "low",
          // SDK types the schema as an index-signature object; ours is typed `object`.
          format: { type: "json_schema", schema: req.schema as { [key: string]: unknown } },
        },
      });
      if (res.stop_reason === "refusal") throw new ModelError("refusal");
      if (res.stop_reason === "max_tokens") throw new ModelError("parse");
      const block = res.content.find((b) => b.type === "text");
      if (!block || block.type !== "text") throw new ModelError("parse");
      try {
        return JSON.parse(block.text) as unknown;
      } catch {
        throw new ModelError("parse");
      }
    } catch (e) {
      if (e instanceof ModelError) throw e;
      if (e instanceof Anthropic.APIConnectionTimeoutError) throw new ModelError("timeout");
      throw new ModelError("api"); // Anthropic.APIError and anything else
    }
  };
}

export const getOrGenerate = internalAction({
  args: { donorId: v.string(), charityId: vCharityId },
  handler: async (ctx, args): Promise<NarrativeResult | null> => {
    const now = Date.now();
    const dctx = await ctx.runQuery(internal.context.forDonor, { donorId: args.donorId, charityId: args.charityId, now });
    if (!dctx) return null;

    // Claude never sees since-last-visit: that slot is rendered from structured data, which
    // also keeps factsHash stable across visits.
    const facts = buildFacts({
      charity: dctx.charity,
      donor: dctx.donor,
      donations: dctx.donations,
      logs: dctx.logs,
      allocations: dctx.allocations,
      window: dctx.window,
      lastVisitAt: null,
    });
    const factsHash = await hashFacts(facts);

    const hit: NarrativeResult | null = await ctx.runQuery(internal.narrative.cached, {
      donorId: args.donorId,
      charityId: args.charityId,
      factsHash,
    });
    const stats: { callsInLastHour: number; lastCallAtForDonor: number | null } = await ctx.runQuery(
      internal.narrative.callStats,
      { donorId: args.donorId, charityId: args.charityId, now },
    );

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const out = await runNarrative({
      facts,
      now,
      cached: hit,
      caps: {
        ...stats,
        maxPerHour: intEnv("NARRATIVE_MAX_PER_HOUR", NARRATIVE_MAX_PER_HOUR),
        minIntervalMs: intEnv("NARRATIVE_MIN_INTERVAL_MS", NARRATIVE_MIN_INTERVAL_MS),
      },
      callModel: apiKey ? makeCallModel(apiKey) : null,
    });

    // Store only guard-decided results; no_key/capped/error stay unstored so a later call can upgrade.
    if (out.outcome === "claude" || out.outcome === "rejected") {
      await ctx.runMutation(internal.narrative.store, {
        donorId: args.donorId,
        charityId: args.charityId,
        factsHash,
        json: JSON.stringify(out.result.output),
        source: out.result.source,
        guardReasons: out.result.guardReasons,
        createdAt: now,
      });
    }
    if (out.called && (out.outcome === "claude" || out.outcome === "rejected" || out.outcome === "error")) {
      await ctx.runMutation(internal.narrative.recordCall, {
        donorId: args.donorId,
        charityId: args.charityId,
        at: now,
        outcome: out.outcome,
        latencyMs: out.latencyMs,
      });
    }
    return out.result;
  },
});
