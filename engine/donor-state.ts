// Deterministic donor classification (T24, contract v2). Pure TS, no Convex imports.
//
// State: the first rule that matches wins (see DONOR_STATES in types.ts). Traits are additive.
// Everything here is a rule, never a model call: Claude writes at most the wording (T30), and the
// guard still checks it.
import { DAY_MS, JUST_GAVE_WITHIN_MS, LAPSED_AFTER_DAYS, REGULAR_VISITS_IN_30_DAYS } from "./config";
import type { Donation, DonorFacts, DonorState, DonorTrait, NextStepKind } from "./types";

export interface ClassifyInput {
  gifts: Donation[]; // this donor, this charity, all-time
  facts: DonorFacts; // narrative facts, with sinceLastVisit filled for the previous visit
  visitsInLast30Days: number;
  photosCount: number;
  now: number;
}

export function classifyDonor(input: ClassifyInput): { state: DonorState; traits: DonorTrait[] } {
  const { gifts, facts, visitsInLast30Days, photosCount, now } = input;
  const newestGiftAt = gifts.reduce<number | null>((m, g) => (m == null || g.createdAt > m ? g.createdAt : m), null);
  const hasEstimate = facts.estimates.some((e) => e.approxQuantity > 0);

  let state: DonorState;
  if (newestGiftAt != null && now - newestGiftAt <= JUST_GAVE_WITHIN_MS && !hasEstimate) {
    state = "just_gave";
  } else if (facts.sinceLastVisit != null && facts.sinceLastVisit.records.length >= 1) {
    state = "news";
  } else if (gifts.length === 1 && hasEstimate) {
    state = "first_impact";
  } else if (gifts.length >= 2) {
    state = "repeat";
  } else if (newestGiftAt == null || now - newestGiftAt > LAPSED_AFTER_DAYS * DAY_MS) {
    state = "lapsed";
  } else {
    state = "returning";
  }

  const traits: DonorTrait[] = [];
  if (facts.donorFirstName != null) traits.push("named");
  if (photosCount > 0) traits.push("has_photos");
  if (visitsInLast30Days >= REGULAR_VISITS_IN_30_DAYS) traits.push("regular");
  return { state, traits };
}

/** Next-step kind by rule. No give_monthly: the product has no monthly mechanics (D19). */
export function nextStepKindFor(state: DonorState): NextStepKind {
  switch (state) {
    case "just_gave":
    case "news":
      return "share";
    case "first_impact":
    case "returning":
      return "volunteer";
    case "repeat":
    case "lapsed":
      return "give_again";
  }
}

/**
 * Short opaque change marker for live updates. Depends ONLY on these three parts, so the Convex
 * /donor-pulse endpoint and buildDonorView agree. FNV-1a 32-bit over the joined parts, base36.
 */
export function computeRev(parts: {
  newestLogId: string | null;
  narrativeAt: number | null;
  newestGiftId: string | null;
}): string {
  const enc = (v: string | number | null): string => (v == null ? "\u0000" : `s${v}`);
  const s = [enc(parts.newestLogId), enc(parts.narrativeAt), enc(parts.newestGiftId)].join("\u0001");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, "0");
}

const MAX_HEADLINE_CHARS = 70;

/** Deterministic, number-free headline. Names only the donor's first name and the charity name. */
export function headlineFor(state: DonorState, firstName: string | null, charityName: string): string {
  const name = firstName ? `, ${firstName}` : "";
  let text: string;
  switch (state) {
    case "just_gave":
      text = `Thank you${name}. Your gift is in.`;
      break;
    case "news":
      text = `New from ${charityName} since your last visit`;
      if (text.length > MAX_HEADLINE_CHARS) text = "New since your last visit";
      break;
    case "first_impact":
      text = "Here is what your gift was part of";
      break;
    case "repeat":
      text = `Thank you for giving again${name}`;
      break;
    case "lapsed":
      text = `Good to see you again${name}`;
      break;
    case "returning":
      text = `Thank you${name}`;
      break;
  }
  // A very long first name must not push the headline past the limit: drop the name.
  if (text.length > MAX_HEADLINE_CHARS) return headlineFor(state, null, charityName);
  return text;
}

/** The story minus a leading "Thank you..." sentence (the headline carries the thanks). Never returns empty. */
export function storyBody(story: string): string {
  const m = /(?<=[.!?])\s+/.exec(story);
  if (!m) return story;
  const first = story.slice(0, m.index);
  if (!/^\s*thank you/i.test(first)) return story;
  const rest = story.slice(m.index + m[0].length).trim();
  return rest === "" ? story : rest;
}
