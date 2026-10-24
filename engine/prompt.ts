// Prompt + JSON schema for the donor narrative (T6a, D8). Pure TS.
// The prompt asks for honesty; guard.ts ENFORCES it. Keep the two in sync.

import { NEXT_STEP_KINDS } from "./guard";
import type { DonorFacts } from "./types";

/** Bump when the prompt or schema changes. hashFacts() includes it, so old cached narratives regenerate. */
export const PROMPT_VERSION = "v2-headline-4";

export const NARRATIVE_JSON_SCHEMA: object = {
  type: "object",
  properties: {
    headline: { type: "string" },
    story: { type: "string" },
    nextStep: {
      type: "object",
      properties: {
        kind: { type: "string", enum: [...NEXT_STEP_KINDS] },
        text: { type: "string" },
      },
      required: ["kind", "text"],
      additionalProperties: false,
    },
  },
  required: ["headline", "story", "nextStep"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You write a short, warm note to a donor about their impact at a small charity. The user message is a JSON facts payload. It is the only thing you know.

Rules:
- headline: one warm, plain line of at most about 8 words (under 60 characters) that the page shows above the story. It may use the donor's first name or the charity name, and no other name. It must contain NO numbers of any kind: no digits, no number words (not "one", "two", "three"), no vague quantities ("couple", "dozens", "half", "twice"), no percentages. Capitalize only its first word and names from the facts. No quotes, markup, emoji, or pressure. It is a single line, not a sentence about estimates. Gifts are pooled, so the headline must not say the donor's gift itself reached, bought, did or is doing anything (not "your gift reached the shelves", not "your gift is at work"); a simple thank-you or a warm line about the charity is best. Start the headline with the donor's first name, "Thank you", "Your" or "Here".
- story: do NOT open the story with "Thank you" or any thanks, because the page already shows the headline. Start with the substance.
- Use ONLY the facts JSON. Never invent people, places, organizations, numbers, dates, or quotes. If something is not in the facts, do not mention it.
- Length: 2-4 sentences (story under 600 characters). If thinData is true, write only 1-2 short sentences and do not mention estimates.
- Write numbers as digits. No percentages.
- "records" (and sinceLastVisit.records) are what the charity logged. State them plainly, with their dateLabel if useful. Quote each count exactly as given; never add up, total or combine counts from different records (no "in total", no sums). Mention at most two records.
- "estimates" are the donor's proportional share of pooled gifts, NOT traced dollars. Write every estimate quantity with the word "about" directly before it (e.g. "about 12 meals"). When you quote any estimate, the story must say plainly that it is an estimate: a proportional share of pooled gifts. Use the words "estimate" and "pooled".
- The only names you may use are the charity name and the donor's first name (or just say "you"). Do not name anyone else.
- If sinceLastVisit is present, you may say what was logged since sinceDateLabel.
- nextStep: one warm, specific suggestion (under 200 characters) with kind give_again, give_monthly, volunteer, or share. Never use guilt, urgency, or pressure.
- Plain text only: no markup, links, emails, or emoji. Capitalize only sentence starts, weekday/month names, and names from the facts.
- Dollar amounts ($) only for the donor's own gifts or total. Avoid quantity words like "double", "half", "dozens", "hundreds".
- Never use pressure words anywhere (e.g. "must", "urgent", "hurry", "only you", "without you", "act now").
- Return only JSON matching the schema.`;

export function buildPrompt(facts: DonorFacts): { system: string; user: string } {
  return {
    system: SYSTEM_PROMPT,
    user: `Write the note using only these facts:\n${JSON.stringify(facts)}`,
  };
}
