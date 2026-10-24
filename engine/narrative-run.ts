// Narrative run (T6b). Pure TS, no Convex imports; the model call is injected.
//
// Policy: cache first, then key/caps, then ONE guarded model call. Every model output goes
// through guard() before it can be returned; any failure falls back to the template.
// This module never throws and never logs (no model text, no names).

import { NARRATIVE_TIMEOUT_MS } from "./config";
import { guard } from "./guard";
import { buildPrompt, NARRATIVE_JSON_SCHEMA } from "./prompt";
import { templateFallback } from "./template";
import type { DonorFacts, NarrativeResult } from "./types";

export interface ModelCall {
  system: string;
  user: string;
  schema: object;
  timeoutMs: number;
}

/** Resolves to the PARSED JSON object Claude returned. Throws ModelError on API error/refusal/parse failure. */
export type CallModel = (req: ModelCall) => Promise<unknown>;

export type ModelErrorCategory = "api" | "refusal" | "parse" | "timeout";

export class ModelError extends Error {
  constructor(public category: ModelErrorCategory) {
    super(`model error: ${category}`);
    this.name = "ModelError";
  }
}

export interface NarrativeCaps {
  callsInLastHour: number;
  lastCallAtForDonor: number | null;
  maxPerHour: number;
  minIntervalMs: number;
}

export type NarrativeOutcome = "cache" | "claude" | "rejected" | "error" | "capped" | "no_key";

export interface RunNarrativeInput {
  facts: DonorFacts;
  now: number;
  cached: NarrativeResult | null; // row for this exact factsHash, if any
  caps: NarrativeCaps;
  callModel: CallModel | null; // null = no API key configured
  timeoutMs?: number; // default NARRATIVE_TIMEOUT_MS
}

export interface RunNarrativeOutput {
  result: NarrativeResult;
  outcome: NarrativeOutcome;
  called: boolean;
  latencyMs: number;
}

function template(facts: DonorFacts, guardReasons: string[]): NarrativeResult {
  return { output: templateFallback(facts), source: "template", guardReasons };
}

function isCapped(caps: NarrativeCaps, now: number): boolean {
  if (caps.callsInLastHour >= caps.maxPerHour) return true;
  return caps.lastCallAtForDonor !== null && now - caps.lastCallAtForDonor < caps.minIntervalMs;
}

function errorCategory(e: unknown): ModelErrorCategory {
  return e instanceof ModelError ? e.category : "api";
}

export async function runNarrative(input: RunNarrativeInput): Promise<RunNarrativeOutput> {
  const { facts, now, cached, caps, callModel } = input;
  try {
    if (cached) return { result: cached, outcome: "cache", called: false, latencyMs: 0 };
    if (!callModel) return { result: template(facts, []), outcome: "no_key", called: false, latencyMs: 0 };
    if (isCapped(caps, now)) return { result: template(facts, []), outcome: "capped", called: false, latencyMs: 0 };

    const timeoutMs = input.timeoutMs ?? NARRATIVE_TIMEOUT_MS;
    const { system, user } = buildPrompt(facts);
    const started = Date.now();
    let raw: unknown;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ModelError("timeout")), timeoutMs);
      });
      raw = await Promise.race([callModel({ system, user, schema: NARRATIVE_JSON_SCHEMA, timeoutMs }), timeout]);
    } catch (e) {
      return {
        result: template(facts, [`model error: ${errorCategory(e)}`]),
        outcome: "error",
        called: true,
        latencyMs: Date.now() - started,
      };
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
    const latencyMs = Date.now() - started;

    const verdict = guard(raw, facts);
    if (verdict.ok) {
      // guard() returned ok, so raw is a valid NarrativeOutput.
      return { result: { output: raw as NarrativeResult["output"], source: "claude", guardReasons: [] }, outcome: "claude", called: true, latencyMs };
    }
    return { result: template(facts, verdict.reasons), outcome: "rejected", called: true, latencyMs };
  } catch {
    // Defensive: nothing above should throw, but a donor must always get a safe result.
    return { result: template(facts, ["model error: api"]), outcome: "error", called: false, latencyMs: 0 };
  }
}
