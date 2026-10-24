import { describe, expect, it } from "vitest";
import { findPressureWords, guard } from "./guard";
import { nextStepFor } from "./next-step";
import type { DonorFacts, NextStepKind } from "./types";

const KINDS: NextStepKind[] = ["give_again", "give_monthly", "volunteer", "share"];
const LABELS: Record<NextStepKind, string> = {
  give_again: "Give again",
  give_monthly: "Explore monthly giving",
  volunteer: "See volunteer shifts",
  share: "Share the update",
};

const facts: DonorFacts = {
  charityName: "Cinderwell Pantry",
  donorFirstName: "Mira",
  donations: [{ amountDollars: 25, dateLabel: "Tue, Oct 20" }],
  totalGivenDollars: 25,
  records: [
    { logId: "l1", kind: "meals", count: 80, unit: "meals", dateLabel: "Tue, Oct 20", note: null, hasPhoto: false },
    { logId: "l2", kind: "meals", count: 60, unit: "meals", dateLabel: "Wed, Oct 21", note: null, hasPhoto: false },
  ],
  estimates: [{ kind: "meals", unit: "meals", approxQuantity: 26, marker: "about" }],
  sinceLastVisit: null,
  thinData: false,
};

describe("nextStepFor", () => {
  it("uses the fixed label table (4 words or fewer)", () => {
    for (const kind of KINDS) {
      const { label } = nextStepFor(kind, "Cinderwell Pantry");
      expect(label).toBe(LABELS[kind]);
      expect(label.split(/\s+/).length).toBeLessThanOrEqual(4);
    }
  });

  it("texts have no digits and no pressure language, and mention the charity", () => {
    for (const kind of KINDS) {
      const { text } = nextStepFor(kind, "Cinderwell Pantry");
      expect(text).not.toMatch(/\d/);
      expect(findPressureWords(text)).toEqual([]);
      expect(text).toContain("Cinderwell Pantry");
    }
  });

  it("texts pass guard() inside a narrative for a seeded-style donor's facts", () => {
    for (const kind of KINDS) {
      const { text } = nextStepFor(kind, facts.charityName);
      const out = {
        story: "Thank you, Mira, for giving $25 to Cinderwell Pantry. On Tue, Oct 20, Cinderwell Pantry logged 80 meals.",
        nextStep: { kind, text },
      };
      expect(guard(out, facts)).toEqual({ ok: true });
    }
  });
});
