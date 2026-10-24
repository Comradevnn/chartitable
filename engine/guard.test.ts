import { describe, expect, it } from "vitest";
import { extractNumbers, findDisallowedNames, guard, hasPercentage } from "./guard";
import type { DonorFacts } from "./types";

const facts: DonorFacts = {
  charityName: "Juniper Street Pantry",
  donorFirstName: "Priya",
  donations: [{ amountDollars: 25, dateLabel: "Mon, Oct 5" }],
  totalGivenDollars: 25,
  records: [
    { logId: "l1", kind: "meals", count: 80, unit: "meals", dateLabel: "Thu, Oct 8", note: "Packed boxes with the Thursday crew", hasPhoto: true },
    { logId: "l2", kind: "produce", count: 200, unit: "pounds of produce", dateLabel: "Thu, Oct 15", note: null, hasPhoto: false },
  ],
  estimates: [
    { kind: "meals", unit: "meals", approxQuantity: 12, marker: "about" },
    { kind: "produce", unit: "pounds of produce", approxQuantity: 35, marker: "about" },
  ],
  sinceLastVisit: null,
  thinData: false,
};

const goodNext = { kind: "give_again", text: "If you would like to, a future gift to Juniper Street Pantry helps the next update." };
const good = {
  story:
    "Thank you, Priya. Your $25 gift to Juniper Street Pantry joined other gifts, and on Thu, Oct 8 the pantry logged 80 meals. " +
    "Your estimate is a proportional share of those pooled gifts: about 12 meals.",
  nextStep: goodNext,
};
const withStory = (story: string, nextStep: unknown = goodNext) => ({ story, nextStep });
const reasonsOf = (r: ReturnType<typeof guard>) => (r.ok ? [] : r.reasons);

describe("guard accepts", () => {
  it("a faithful hand-written story", () => {
    expect(guard(good, facts)).toEqual({ ok: true });
  });

  it("number words and digit forms that are in the facts", () => {
    const r = guard(withStory("Thank you, Priya. On Thu, Oct 8, Juniper Street Pantry logged eighty meals, and 200 pounds of produce on Oct 15."), facts);
    expect(r).toEqual({ ok: true });
  });

  it("'one' and 'a' are not checked", () => {
    expect(guard(withStory("Thank you, Priya, for being one of a caring group at Juniper Street Pantry."), facts)).toEqual({ ok: true });
  });
});

describe("guard rejects invented content", () => {
  it("an invented number", () => {
    const r = guard(withStory("Thank you, Priya. You helped serve 95 meals at Juniper Street Pantry."), facts);
    expect(r.ok).toBe(false);
    expect(reasonsOf(r).join("|")).toContain("invented number: 95");
  });

  it("an invented number word", () => {
    const r = guard(withStory("Thank you, Priya. You helped feed forty families."), facts);
    expect(reasonsOf(r).join("|")).toContain("invented number: forty");
    expect(reasonsOf(guard(withStory("Thank you, Priya. Hundreds of neighbors came by."), facts)).join("|")).toContain("Hundreds");
  });

  it("number inside next step", () => {
    const r = guard(withStory(good.story, { kind: "give_again", text: "Consider giving $50 again." }), facts);
    expect(reasonsOf(r).join("|")).toContain("invented number: $50");
  });

  it("an invented name", () => {
    const r = guard(withStory("Maria from Oakland thanks you for supporting Juniper Street Pantry."), facts);
    expect(r.ok).toBe(false);
    const reasons = reasonsOf(r).join("|");
    expect(reasons).toContain("unknown name: Maria");
    expect(reasons).toContain("unknown name: Oakland");
  });

  it("an invented name mid-sentence, possessive, and accented", () => {
    expect(reasonsOf(guard(withStory("Thank you, Priya. Dana's team at Juniper Street Pantry says hi."), facts)).join("|")).toContain("Dana");
    expect(reasonsOf(guard(withStory("Thank you, Priya. Zoë helped."), facts)).join("|")).toContain("Zoë");
  });

  it("a starter word is only forgiven at the start of a sentence", () => {
    expect(reasonsOf(guard(withStory("Thank you, Priya. We Volunteer a lot."), facts)).join("|")).toContain("unknown name: Volunteer");
    expect(guard(withStory("Thank you, Priya. Volunteer shifts help too."), facts).ok).toBe(true);
  });

  it("a name that only appears in a note is allowed (verbatim fact)", () => {
    expect(guard(withStory("Thank you, Priya. The Thursday crew packed boxes on Thu, Oct 8."), facts)).toEqual({ ok: true });
  });

  it("links and addresses", () => {
    expect(guard(withStory("Thank you, Priya. See www.example.com for more."), facts).ok).toBe(false);
  });

  it("non-ASCII numerals", () => {
    expect(guard(withStory("Thank you, Priya. You gave ２５ dollars."), facts).ok).toBe(false);
  });
});

describe("guard rejects dishonest estimates", () => {
  it("an unlabeled estimate", () => {
    const r = guard(withStory("Thank you, Priya. Your gift provided 12 meals at Juniper Street Pantry."), facts);
    expect(r.ok).toBe(false);
    expect(reasonsOf(r).join("|")).toContain("unlabeled estimate: 12");
  });

  it("an unlabeled estimate written as a word", () => {
    expect(reasonsOf(guard(withStory("Thank you, Priya. Your gift provided twelve meals."), facts)).join("|")).toContain("unlabeled estimate: twelve");
  });

  it("an 'about' that is too far away does not count", () => {
    const r = guard(withStory("Thank you, Priya. We heard about the work and the great team, then your 12 meals arrived."), facts);
    expect(reasonsOf(r).join("|")).toContain("unlabeled estimate: 12");
  });

  it("estimate or roughly nearby counts as a label", () => {
    expect(
      guard(withStory("Thank you, Priya. Your estimated share is 12 meals from pooled gifts."), facts),
    ).toEqual({ ok: true });
  });

  // Sole donor: their estimate equals the record count, so the number alone can't tell them apart.
  const soleDonor: DonorFacts = {
    ...facts,
    estimates: [{ kind: "meals", unit: "meals", approxQuantity: 80, marker: "about" }],
  };

  it("an unlabeled estimate credited to the donor even when it equals a record", () => {
    const r = guard(withStory("Thank you, Priya. Your gift provided 80 meals at Juniper Street Pantry."), soleDonor);
    expect(reasonsOf(r).join("|")).toContain("unlabeled estimate credited to donor: 80");
  });

  it("a record that equals an estimate is fine when stated as the pantry's log", () => {
    const r = guard(withStory("Thank you, Priya. On Thu, Oct 8 the pantry logged 80 meals."), soleDonor);
    expect(r).toEqual({ ok: true });
  });

  it("an invented dollar amount, even if the number exists elsewhere in facts", () => {
    const r = guard(withStory("Thank you, Priya. Your $12 went far at Juniper Street Pantry."), facts);
    expect(reasonsOf(r).join("|")).toContain("invented amount: $12");
  });

  it("a quoted estimate without the proportional-share explanation", () => {
    const r = guard(withStory("Thank you, Priya. Your gift made about 12 meals."), facts);
    expect(reasonsOf(r).join("|")).toContain("without explaining");
  });
});

describe("guard rejects percentages and pressure", () => {
  it("percent sign and word", () => {
    expect(reasonsOf(guard(withStory("Thank you, Priya. You gave 25% of the effort."), facts)).join("|")).toContain("percentage");
    expect(reasonsOf(guard(withStory("Thank you, Priya. A big percent of boxes were yours."), facts)).join("|")).toContain("percentage");
  });

  it("guilt-laden next step", () => {
    for (const text of [
      "Without you, families will go hungry.",
      "Don’t let them down; this is urgent.",
      "We need you now, this is your last chance.",
      "You must give again.",
      "Only you can help before it's too late.",
      "Skip the guilt and give.",
    ]) {
      const r = guard(withStory(good.story, { kind: "give_again", text }), facts);
      expect(r.ok, text).toBe(false);
    }
    const r = guard(withStory(good.story, { kind: "give_again", text: "Without you, families will go hungry." }), facts);
    expect(reasonsOf(r).join("|")).toContain("pressure language: without you");
  });

  it("pressure in the story", () => {
    expect(guard(withStory("Thank you, Priya. This is urgent."), facts).ok).toBe(false);
  });
});

describe("guard rejects malformed shapes", () => {
  it.each([
    ["null", null],
    ["string", "just a string"],
    ["array", [good]],
    ["undefined", undefined],
    ["missing nextStep", { story: good.story }],
    ["missing story", { nextStep: goodNext }],
    ["extra top-level key", { ...good, extra: 1 }],
    ["extra nextStep key", { ...good, nextStep: { ...goodNext, link: "x" } }],
    ["wrong kind", { ...good, nextStep: { kind: "donate_now", text: "Hi" } }],
    ["non-string story", { ...good, story: 42 }],
    ["empty story", { ...good, story: "   " }],
    ["empty next step text", { ...good, nextStep: { kind: "share", text: "" } }],
    ["nextStep not an object", { ...good, nextStep: "share" }],
    ["story too long", { ...good, story: "Thank you ".repeat(80) }],
    ["next step too long", { ...good, nextStep: { kind: "share", text: "Share it. ".repeat(30) } }],
  ])("%s", (_name, value) => {
    const r = guard(value, facts);
    expect(r.ok).toBe(false);
    expect(reasonsOf(r).length).toBeGreaterThan(0);
  });

  it("collects all reasons, not just the first", () => {
    const r = guard(withStory("Maria served 95 meals, 40%.", { kind: "share", text: "You must." }), facts);
    expect(reasonsOf(r).length).toBeGreaterThanOrEqual(4);
  });
});

describe("helpers", () => {
  it("extractNumbers handles digits, commas, decimals, dollars, percent, words", () => {
    const vals = extractNumbers("1,200 meals, 12.5 lbs, $25, 25%, twenty-five, a dozen and three").map((m) => m.value);
    expect(vals).toEqual([1200, 12.5, 25, 25, 25, 12, 3]);
    expect(extractNumbers("one family and a neighbor")).toEqual([]);
    expect(extractNumbers("It cost 80, then 90.")).toHaveLength(2);
  });

  it("hasPercentage", () => {
    expect(hasPercentage("25%")).toBe(true);
    expect(hasPercentage("ten per cent")).toBe(true);
    expect(hasPercentage("80 meals")).toBe(false);
  });

  it("findDisallowedNames lets calendar words, the charity, and the donor through", () => {
    expect(findDisallowedNames("Thank you, Priya. On Tuesday, Oct 20, Juniper Street Pantry reopened. I agree.", facts)).toEqual([]);
  });
});

describe("guard rejects markup", () => {
  it("HTML tags in the story", () => {
    const r = guard(withStory("<b>Thank you</b>, Priya."), facts);
    expect(reasonsOf(r).join("|")).toContain("story: contains markup");
  });
});

describe("guard audit fixes (H5)", () => {
  // $25 gift and an estimate of 25 meals: the number alone can't tell them apart.
  const collide: DonorFacts = {
    ...facts,
    estimates: [{ kind: "meals", unit: "meals", approxQuantity: 25, marker: "about" }],
  };

  it("rejects an unlabeled estimate credited to the donor with no attribution verb", () => {
    const r = guard(withStory("Thank you, Priya. Your generosity fed 25 meals."), collide);
    expect(reasonsOf(r).join("|")).toContain("unlabeled estimate credited to donor: 25");
  });

  it("still accepts the gift amount itself", () => {
    expect(guard(withStory("Thank you, Priya, for your $25 gift to Juniper Street Pantry."), collide)).toEqual({ ok: true });
  });

  it("rejects estimates in a thin-data story", () => {
    const thin: DonorFacts = { ...facts, thinData: true };
    const r = guard(
      withStory("Thank you, Priya. Your estimate is a proportional share of pooled gifts: about 12 meals."),
      thin,
    );
    expect(reasonsOf(r).join("|")).toContain("thin data");
  });

  it("rejects newly listed pressure phrases", () => {
    for (const p of ["We need to hear from you.", "Supplies are running out.", "The deadline is close."]) {
      expect(reasonsOf(guard(withStory(`Thank you, Priya. ${p}`), facts)).join("|")).toContain("pressure language");
    }
  });
});

describe("guard quantity-unit binding (R1, R2, R3)", () => {
  const why = (story: string, f: DonorFacts = facts, nextStep: unknown = goodNext) =>
    reasonsOf(guard(withStory(story, nextStep), f)).join("|");

  it("rejects a gift amount used as a meal count", () => {
    const r = guard(withStory("Thank you, Priya. Your gift provided 25 meals."), facts);
    expect(r.ok).toBe(false);
    expect(reasonsOf(r).join("|")).toContain("quantity not in facts for meals: 25");
  });

  it("rejects a date digit used as a meal count", () => {
    expect(why("Thank you, Priya. Your gift provided 5 meals.")).toContain("quantity not in facts for meals: 5");
  });

  it("rejects crediting the donor with the whole pooled record", () => {
    expect(why("Thank you, Priya. Your $25 gift paid for 80 meals.")).toContain("record credited to donor: 80");
    expect(why("Thank you, Priya. You provided 80 meals.")).toContain("record credited to donor: 80");
    expect(why("Thank you. Priya provided 80 meals.")).toContain("record credited to donor: 80");
  });

  it("rejects a people/food-count noun that no note backs", () => {
    const withNote: DonorFacts = {
      ...facts,
      records: [
        { logId: "l1", kind: "meals", count: 80, unit: "meals", dateLabel: "Thu, Oct 8", note: "Packed 40 boxes with the crew", hasPhoto: false },
      ],
    };
    // 40 is a real number in a note, but it counted boxes, not families.
    expect(why("Thank you, Priya. The crew fed 40 families.", withNote)).toContain("unsupported quantity: 40 families");
    // and with no note at all, the number is simply invented
    expect(why("Thank you, Priya. The pantry fed 40 families.")).toContain("invented number: 40");
  });

  it("rejects vague small quantities like 'a couple of meals'", () => {
    const r = guard(withStory("Thank you, Priya. Your share was a couple of meals."), facts);
    expect(r.ok).toBe(false);
    expect(reasonsOf(r).join("|")).toContain("invented number: couple");
    expect(why("Thank you, Priya. A pair of volunteers helped.")).toContain("invented number: pair");
  });

  it("rejects dollars that are not a gift", () => {
    const f: DonorFacts = {
      ...facts,
      donations: [{ amountDollars: 20, dateLabel: "Mon, Oct 5" }],
      totalGivenDollars: 20,
      records: [{ logId: "l1", kind: "meals", count: 25, unit: "meals", dateLabel: "Thu, Oct 8", note: null, hasPhoto: false }],
    };
    expect(why("Thank you, Priya. You gave 25 dollars to Juniper Street Pantry.", f)).toContain("invented amount: 25 dollars");
    expect(guard(withStory("Thank you, Priya. You gave 20 dollars to Juniper Street Pantry."), f)).toEqual({ ok: true });
  });

  it("still accepts the faithful story", () => {
    expect(guard(good, facts)).toEqual({ ok: true });
  });

  it("accepts a people/food-count noun echoed from a record note", () => {
    const f: DonorFacts = {
      ...facts,
      records: [
        { logId: "l1", kind: "meals", count: 80, unit: "meals", dateLabel: "Thu, Oct 8", note: "Packed 40 boxes with the crew", hasPhoto: false },
      ],
    };
    expect(guard(withStory("Thank you, Priya. The crew packed 40 boxes on Thu, Oct 8."), f)).toEqual({ ok: true });
  });

  it("accepts a labeled estimate even when the donor is the agent", () => {
    const r = guard(
      withStory("Thank you, Priya. Your gift provided about 12 meals as a proportional share of pooled gifts, an estimate."),
      facts,
    );
    expect(r).toEqual({ ok: true });
  });

  it("accepts record counts in a non-donor sentence", () => {
    expect(guard(withStory("Thank you, Priya. Juniper Street Pantry logged 200 pounds of produce on Thu, Oct 15."), facts)).toEqual({ ok: true });
  });

  it("accepts since-last-visit record counts", () => {
    const f: DonorFacts = {
      ...facts,
      sinceLastVisit: {
        sinceDateLabel: "Fri, Oct 9",
        records: [{ logId: "l3", kind: "volunteer_shifts", count: 14, unit: "volunteer shifts", dateLabel: "Sat, Oct 17", note: null, hasPhoto: false }],
        estimates: [],
      },
    };
    expect(guard(withStory("Thank you, Priya. Since Fri, Oct 9, Juniper Street Pantry logged 14 volunteer shifts on Sat, Oct 17."), f)).toEqual({ ok: true });
    expect(why("Thank you, Priya. Since Fri, Oct 9, Juniper Street Pantry logged 15 volunteer shifts.", f)).toContain(
      "quantity not in facts for volunteer_shifts: 15",
    );
  });
});
