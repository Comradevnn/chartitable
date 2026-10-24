import { describe, expect, it } from "vitest";
import { NARRATIVE_JSON_SCHEMA, buildPrompt } from "./prompt";
import type { DonorFacts } from "./types";

const facts: DonorFacts = {
  charityName: "Juniper Street Pantry",
  donorFirstName: "Priya",
  donations: [{ amountDollars: 25, dateLabel: "Mon, Oct 5" }],
  totalGivenDollars: 25,
  records: [
    { logId: "l1", kind: "meals", count: 80, unit: "meals", dateLabel: "Thu, Oct 8", note: null, hasPhoto: false },
    { logId: "l2", kind: "meals", count: 60, unit: "meals", dateLabel: "Tue, Oct 20", note: null, hasPhoto: true },
  ],
  estimates: [{ kind: "meals", unit: "meals", approxQuantity: 12, marker: "about" }],
  sinceLastVisit: null,
  thinData: false,
};

describe("buildPrompt", () => {
  const { system, user } = buildPrompt(facts);

  it("puts the facts JSON in the user message", () => {
    expect(user).toContain(JSON.stringify(facts));
  });

  it("system prompt requires 'about' and forbids invented names/numbers", () => {
    expect(system).toContain('"about"');
    expect(system).toMatch(/never invent people, places, organizations, numbers/i);
    expect(system).toMatch(/only names you may use/i);
    expect(system).toMatch(/pooled/);
    expect(system).toMatch(/never use guilt, urgency, or pressure/i);
  });

  it("does not include the facts in the system prompt", () => {
    expect(system).not.toContain("Juniper");
  });
});

describe("NARRATIVE_JSON_SCHEMA", () => {
  it("is strict and lists the next-step kinds", () => {
    const s = NARRATIVE_JSON_SCHEMA as any;
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toEqual(["story", "nextStep"]);
    expect(s.properties.nextStep.additionalProperties).toBe(false);
    expect(s.properties.nextStep.properties.kind.enum.sort()).toEqual(
      ["give_again", "give_monthly", "share", "volunteer"],
    );
  });
});
