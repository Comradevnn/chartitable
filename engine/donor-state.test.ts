import { describe, expect, it } from "vitest";
import { DAY_MS, JUST_GAVE_WITHIN_MS, LAPSED_AFTER_DAYS, REGULAR_VISITS_IN_30_DAYS } from "./config";
import { classifyDonor, computeRev, headlineFor, nextStepKindFor, storyBody } from "./donor-state";
import { extractNumbers, findPressureWords } from "./guard";
import { DONOR_STATES } from "./types";
import type { Donation, DonorFacts, DonorState, RecordFact } from "./types";

const NOW = Date.UTC(2026, 9, 24, 18, 0, 0);
const HOUR = 60 * 60 * 1000;

function gift(id: string, ageMs: number): Donation {
  return { id, donorId: "d1", charityId: "demo-pantry-a", amountCents: 2500, createdAt: NOW - ageMs, testMode: true };
}

const rec: RecordFact = {
  logId: "l1", kind: "meals", count: 80, unit: "meals", dateLabel: "Tue, Oct 20", note: null, hasPhoto: false,
};

function mkFacts(over: Partial<DonorFacts> = {}): DonorFacts {
  return {
    charityName: "Cinderwell Pantry",
    donorFirstName: "Mira",
    donations: [],
    totalGivenDollars: 0,
    records: [],
    estimates: [],
    sinceLastVisit: null,
    thinData: true,
    ...over,
  };
}
const est = [{ kind: "meals" as const, unit: "meals", approxQuantity: 26, marker: "about" as const }];
const since = { sinceDateLabel: "Mon, Oct 19", records: [rec], estimates: [] };

function classify(over: {
  gifts?: Donation[]; facts?: DonorFacts; visits?: number; photos?: number;
}) {
  return classifyDonor({
    gifts: over.gifts ?? [],
    facts: over.facts ?? mkFacts(),
    visitsInLast30Days: over.visits ?? 0,
    photosCount: over.photos ?? 0,
    now: NOW,
  });
}

describe("classifyDonor: every state", () => {
  const old = 20 * DAY_MS;
  const cases: { name: string; expected: DonorState; run: () => ReturnType<typeof classify> }[] = [
    { name: "recent gift, no estimates", expected: "just_gave", run: () => classify({ gifts: [gift("a", 2 * HOUR)] }) },
    {
      name: "unseen records, older single gift with estimate",
      expected: "news",
      run: () => classify({ gifts: [gift("a", old)], facts: mkFacts({ estimates: est, sinceLastVisit: since }) }),
    },
    {
      name: "single older gift with estimate",
      expected: "first_impact",
      run: () => classify({ gifts: [gift("a", old)], facts: mkFacts({ estimates: est }) }),
    },
    { name: "two gifts", expected: "repeat", run: () => classify({ gifts: [gift("a", old), gift("b", old + DAY_MS)] }) },
    {
      name: "single old gift beyond lapse threshold, no estimates",
      expected: "lapsed",
      run: () => classify({ gifts: [gift("a", (LAPSED_AFTER_DAYS + 1) * DAY_MS)] }),
    },
    { name: "no gifts at all", expected: "lapsed", run: () => classify({ gifts: [] }) },
    { name: "single mid-age gift, no estimates, nothing new", expected: "returning", run: () => classify({ gifts: [gift("a", old)] }) },
  ];
  for (const c of cases) {
    it(`${c.expected}: ${c.name}`, () => expect(c.run().state).toBe(c.expected));
  }
  it("the table covers every state", () => {
    expect(new Set(cases.map((c) => c.expected))).toEqual(new Set(DONOR_STATES));
  });

  it("just_gave boundary: exactly at the window counts, one ms later does not", () => {
    expect(classify({ gifts: [gift("a", JUST_GAVE_WITHIN_MS)] }).state).toBe("just_gave");
    expect(classify({ gifts: [gift("a", JUST_GAVE_WITHIN_MS + 1)] }).state).toBe("returning");
  });
  it("lapsed boundary: exactly at the threshold is not yet lapsed", () => {
    expect(classify({ gifts: [gift("a", LAPSED_AFTER_DAYS * DAY_MS)] }).state).toBe("returning");
  });
});

describe("classifyDonor: priority order", () => {
  it("just_gave beats news, first_impact beats nothing else when recent without estimates", () => {
    const r = classify({ gifts: [gift("a", HOUR)], facts: mkFacts({ sinceLastVisit: since }) });
    expect(r.state).toBe("just_gave");
  });
  it("a recent gift WITH estimates is not just_gave (news wins if there is news, else first_impact)", () => {
    expect(classify({ gifts: [gift("a", HOUR)], facts: mkFacts({ estimates: est, sinceLastVisit: since }) }).state).toBe("news");
    expect(classify({ gifts: [gift("a", HOUR)], facts: mkFacts({ estimates: est }) }).state).toBe("first_impact");
  });
  it("estimates with approxQuantity 0 do not count", () => {
    const zero = [{ ...est[0]!, approxQuantity: 0 }];
    expect(classify({ gifts: [gift("a", HOUR)], facts: mkFacts({ estimates: zero }) }).state).toBe("just_gave");
  });
  it("news beats first_impact, repeat and lapsed", () => {
    const f = mkFacts({ estimates: est, sinceLastVisit: since });
    expect(classify({ gifts: [gift("a", 10 * DAY_MS)], facts: f }).state).toBe("news");
    expect(classify({ gifts: [gift("a", 10 * DAY_MS), gift("b", 11 * DAY_MS)], facts: f }).state).toBe("news");
    expect(classify({ gifts: [gift("a", 200 * DAY_MS)], facts: f }).state).toBe("news");
  });
  it("empty sinceLastVisit records do not make news", () => {
    const f = mkFacts({ sinceLastVisit: { sinceDateLabel: "x", records: [], estimates: [] } });
    expect(classify({ gifts: [gift("a", 10 * DAY_MS)], facts: f }).state).toBe("returning");
  });
  it("first_impact beats repeat only with exactly one gift; repeat beats lapsed", () => {
    expect(classify({ gifts: [gift("a", 10 * DAY_MS)], facts: mkFacts({ estimates: est }) }).state).toBe("first_impact");
    expect(classify({ gifts: [gift("a", 10 * DAY_MS), gift("b", 12 * DAY_MS)], facts: mkFacts({ estimates: est }) }).state).toBe("repeat");
    expect(classify({ gifts: [gift("a", 200 * DAY_MS), gift("b", 300 * DAY_MS)] }).state).toBe("repeat");
  });
});

describe("classifyDonor: traits", () => {
  it("none by default", () => {
    expect(classify({ facts: mkFacts({ donorFirstName: null }) }).traits).toEqual([]);
  });
  it("named", () => expect(classify({}).traits).toEqual(["named"]));
  it("has_photos", () => {
    expect(classify({ facts: mkFacts({ donorFirstName: null }), photos: 1 }).traits).toEqual(["has_photos"]);
  });
  it("regular at the threshold only", () => {
    const f = mkFacts({ donorFirstName: null });
    expect(classify({ facts: f, visits: REGULAR_VISITS_IN_30_DAYS - 1 }).traits).toEqual([]);
    expect(classify({ facts: f, visits: REGULAR_VISITS_IN_30_DAYS }).traits).toEqual(["regular"]);
  });
  it("all three, in order", () => {
    expect(classify({ photos: 2, visits: 9 }).traits).toEqual(["named", "has_photos", "regular"]);
  });
});

describe("nextStepKindFor", () => {
  it("maps every state and never returns give_monthly", () => {
    expect(DONOR_STATES.map((s) => nextStepKindFor(s))).toEqual([
      "share", "share", "volunteer", "give_again", "give_again", "volunteer",
    ]);
  });
});

describe("computeRev", () => {
  const base = { newestLogId: "log_a001", narrativeAt: 1000, newestGiftId: "don_a001" };
  it("is stable for equal parts", () => {
    expect(computeRev(base)).toBe(computeRev({ ...base }));
    expect(computeRev(base)).toMatch(/^[0-9a-z]+$/);
  });
  it("changes when any one part changes", () => {
    const r = computeRev(base);
    expect(computeRev({ ...base, newestLogId: "log_a002" })).not.toBe(r);
    expect(computeRev({ ...base, narrativeAt: 1001 })).not.toBe(r);
    expect(computeRev({ ...base, newestGiftId: "don_a002" })).not.toBe(r);
  });
  it("distinguishes null from a value and from other positions", () => {
    const r = computeRev(base);
    expect(computeRev({ ...base, newestLogId: null })).not.toBe(r);
    expect(computeRev({ ...base, narrativeAt: null })).not.toBe(r);
    expect(computeRev({ ...base, newestGiftId: null })).not.toBe(r);
    expect(computeRev({ newestLogId: "x", narrativeAt: null, newestGiftId: null })).not.toBe(
      computeRev({ newestLogId: null, narrativeAt: null, newestGiftId: "x" }),
    );
  });
});

describe("headlineFor", () => {
  const NUMBER_WORD = /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|hundred|thousand|million|dozen|twice|half|couple|pair|first|second|third)\b/i;
  for (const state of DONOR_STATES) {
    for (const name of ["Mira", null]) {
      it(`${state} ${name ? "with" : "without"} a name: no numbers, short, no pressure`, () => {
        const h = headlineFor(state, name, "Cinderwell Pantry");
        expect(h).not.toMatch(/\d/);
        expect(h).not.toMatch(NUMBER_WORD);
        expect(extractNumbers(h)).toEqual([]);
        expect(findPressureWords(h)).toEqual([]);
        expect(h.length).toBeGreaterThan(0);
        expect(h.length).toBeLessThanOrEqual(70);
        expect(h.includes("Mira")).toBe(name !== null && state !== "news" && state !== "first_impact");
      });
    }
  }
  it("matches the suggested copy", () => {
    expect(headlineFor("just_gave", "Mira", "X")).toBe("Thank you, Mira. Your gift is in.");
    expect(headlineFor("news", null, "Cinderwell Pantry")).toBe("New from Cinderwell Pantry since your last visit");
    expect(headlineFor("repeat", "Mira", "X")).toBe("Thank you for giving again, Mira");
    expect(headlineFor("lapsed", null, "X")).toBe("Good to see you again");
    expect(headlineFor("returning", "Mira", "X")).toBe("Thank you, Mira");
    expect(headlineFor("first_impact", "Mira", "X")).toBe("Here is what your gift was part of");
  });
  it("stays within 70 chars even with a very long charity or first name", () => {
    expect(headlineFor("news", null, "A".repeat(80)).length).toBeLessThanOrEqual(70);
    expect(headlineFor("repeat", "B".repeat(80), "X").length).toBeLessThanOrEqual(70);
  });
});

describe("storyBody", () => {
  it("drops a leading thank-you sentence", () => {
    expect(storyBody("Thank you, Mira, for giving $25 to X. Rest.")).toBe("Rest.");
    expect(storyBody("THANK YOU for being part of X! On Tue, X logged 80 meals. More.")).toBe("On Tue, X logged 80 meals. More.");
  });
  it("leaves a story without a leading thank-you unchanged", () => {
    const s = "On Tue, X logged 80 meals. Thank you, Mira.";
    expect(storyBody(s)).toBe(s);
  });
  it("returns the original when only the thank-you sentence exists", () => {
    expect(storyBody("Thank you, Mira.")).toBe("Thank you, Mira.");
    expect(storyBody("Thank you, Mira for giving $12.50 to X.")).toBe("Thank you, Mira for giving $12.50 to X.");
  });
  it("does not split on a decimal point in a dollar amount", () => {
    expect(storyBody("Thank you for giving $12.50 to X. Rest of it.")).toBe("Rest of it.");
    expect(storyBody("Gave $12.50 to X. Rest.")).toBe("Gave $12.50 to X. Rest.");
  });
});
