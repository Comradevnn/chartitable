// Milestone planning + email copy (T9). Pure TS, no Convex imports.
//
// A milestone fires when roundEstimate(sum of a donor's estimated quantity for one kind) reaches a
// threshold, so we never claim a milestone that the displayed "about N" does not reach (D1).
// Each thresholdId fires once per donor+charity; email only ever goes to the demo allowlist (D4).

import { roundEstimate } from "./allocate";
import { MILESTONE_EMAIL_MIN_GAP_MS, MILESTONE_THRESHOLDS } from "./config";
import { guard } from "./guard";
import { templateFallback } from "./template";
import type { Allocation, DonorFacts, ImpactKind, MilestoneHit, NarrativeResult } from "./types";

export const MILESTONE_SUBJECT = "See where your donation has gone";
export const MILESTONE_FOOTER = "Fictional demo — no real payment was made.";
export const MILESTONE_ESTIMATE_NOTE =
  "Estimates are proportional shares of pooled gifts, not a trace of your dollars.";

/** Preferred announcement order when several kinds cross at once. */
const KIND_ORDER: readonly ImpactKind[] = ["meals", "produce", "volunteer_shifts"];

/** Unrounded sums of estimatedQuantity by kind. */
export function estimateTotals(allocations: Allocation[]): Record<ImpactKind, number> {
  const totals: Record<ImpactKind, number> = { meals: 0, produce: 0, volunteer_shifts: 0 };
  for (const a of allocations) totals[a.kind] += a.estimatedQuantity;
  return totals;
}

export function planMilestones(i: {
  totals: Record<ImpactKind, number>;
  fired: Set<string>;
}): { toMark: MilestoneHit[]; announce: MilestoneHit | null } {
  const toMark: MilestoneHit[] = [];
  let announce: MilestoneHit | null = null;
  for (const kind of KIND_ORDER) {
    const shown = roundEstimate(i.totals[kind]);
    let highest: MilestoneHit | null = null;
    for (const threshold of MILESTONE_THRESHOLDS[kind]) {
      const thresholdId = `${kind}:${threshold}`;
      if (shown < threshold || i.fired.has(thresholdId)) continue;
      const hit: MilestoneHit = { kind, threshold, thresholdId };
      toMark.push(hit);
      highest = hit; // thresholds are ascending
    }
    if (announce === null && highest !== null) announce = highest;
  }
  return { toMark, announce };
}

export type RecipientDecision = "send" | "skipped_no_email" | "skipped_not_allowlisted" | "skipped_rate_limited";

export function decideRecipient(i: {
  email: string | null;
  allowlist: Set<string>;
  lastSentAt: number | null;
  now: number;
}): RecipientDecision {
  const email = i.email?.trim().toLowerCase();
  if (!email) return "skipped_no_email";
  if (!i.allowlist.has(email)) return "skipped_not_allowlisted";
  if (i.lastSentAt !== null && i.now - i.lastSentAt < MILESTONE_EMAIL_MIN_GAP_MS) return "skipped_rate_limited";
  return "send";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildMilestoneEmail(i: {
  facts: DonorFacts;
  narrative: NarrativeResult;
  link: string;
  hit: MilestoneHit;
}): { subject: string; text: string; html: string } {
  const { facts, link, hit } = i;
  // Never trust the stored narrative: re-check it against these facts, else use the template.
  const output = guard(i.narrative.output, facts).ok ? i.narrative.output : templateFallback(facts);
  const story = output.story;

  const greeting = facts.donorFirstName ? `Hi ${facts.donorFirstName},` : "Hello,";
  const estimate = facts.estimates.find((e) => e.kind === hit.kind);
  const shareLine = estimate
    ? `Your share so far: about ${estimate.approxQuantity.toLocaleString("en-US")} ${estimate.unit} (estimate)`
    : null;

  const textParts = [greeting, story];
  if (shareLine) textParts.push(shareLine);
  textParts.push(MILESTONE_ESTIMATE_NOTE, `See the full update: ${link}`, MILESTONE_FOOTER);
  const text = textParts.join("\n\n");

  const p = (s: string) => `<p>${escapeHtml(s)}</p>`;
  const htmlParts = [p(greeting), p(story)];
  if (shareLine) htmlParts.push(p(shareLine));
  htmlParts.push(
    p(MILESTONE_ESTIMATE_NOTE),
    `<p><a href="${escapeHtml(link)}">See the full update</a></p>`,
    `<p><small>${escapeHtml(MILESTONE_FOOTER)}</small></p>`,
  );
  const html = htmlParts.join("\n");

  return { subject: MILESTONE_SUBJECT, text, html };
}
