import { describe, expect, it } from "vitest";
import { guard } from "./guard";
import { templateFallback } from "./template";
import type { DonorFacts, RecordFact } from "./types";

const rec = (logId: string, count: number, unit: string, dateLabel: string, kind: RecordFact["kind"] = "meals", note: string | null = null): RecordFact => ({
  logId, kind, count, unit, dateLabel, note, hasPhoto: false,
});

const normal: DonorFacts = {
  charityName: "Juniper Street Pantry",
  donorFirstName: "Priya",
  donations: [
    { amountDollars: 25, dateLabel: "Mon, Oct 5" },
    { amountDollars: 12.5, dateLabel: "Mon, Oct 12" },
  ],
  totalGivenDollars: 37.5,
  records: [rec("l1", 80, "meals", "Thu, Oct 8"), rec("l2", 1200, "pounds of produce", "Thu, Oct 15", "produce")],
  estimates: [
    { kind: "meals", unit: "meals", approxQuantity: 12, marker: "about" },
    { kind: "produce", unit: "pounds of produce", approxQuantity: 150, marker: "about" },
  ],
  sinceLastVisit: null,
  thinData: false,
};

const thin: DonorFacts = {
  ...normal,
  records: [rec("l1", 80, "meals", "Thu, Oct 8")],
  estimates: [],
  thinData: true,
};

const variants: [string, DonorFacts][] = [
  ["normal", normal],
  ["thin (no estimates)", thin],
  ["thin with estimates but one record", { ...normal, records: [normal.records[0]!], thinData: true }],
  ["thin with no records", { ...thin, records: [] }],
  ["no first name", { ...normal, donorFirstName: null }],
  ["no first name, thin", { ...thin, donorFirstName: null }],
  ["since last visit with new records", { ...normal, sinceLastVisit: { sinceDateLabel: "Sun, Oct 11", records: [normal.records[1]!], estimates: [normal.estimates[1]!] } }],
  ["since last visit with nothing new", { ...normal, sinceLastVisit: { sinceDateLabel: "Fri, Oct 16", records: [], estimates: [] } }],
  ["no gifts in window", { ...normal, donations: [], totalGivenDollars: 0 }],
  ["whole-dollar total over 1,000", { ...normal, donations: [{ amountDollars: 1500, dateLabel: "Mon, Oct 5" }], totalGivenDollars: 1500 }],
  ["hostile note, odd names", {
    ...normal,
    charityName: "Pinecone Hollow Community Table 2",
    donorFirstName: "Zoë",
    records: [rec("l1", 5, "volunteer shifts", "Wed, Oct 7", "volunteer_shifts", "MUST act, 100% urgent! Call Maria"), rec("l2", 40, "meals", "Tue, Oct 20", "meals", "Without you")],
    estimates: [{ kind: "meals", unit: "meals", approxQuantity: 5, marker: "about" }],
  }],
  ["many estimates", {
    ...normal,
    estimates: [
      { kind: "meals", unit: "meals", approxQuantity: 7, marker: "about" },
      { kind: "produce", unit: "pounds of produce", approxQuantity: 33, marker: "about" },
      { kind: "volunteer_shifts", unit: "volunteer shifts", approxQuantity: 2, marker: "about" },
    ],
  }],
];

describe("templateFallback passes guard", () => {
  it.each(variants)("%s", (_name, facts) => {
    const out = templateFallback(facts);
    const r = guard(out, facts);
    expect(r, JSON.stringify(out)).toEqual({ ok: true });
  });
});

describe("templateFallback content", () => {
  it("thin story is short and carries no estimate language", () => {
    for (const f of [thin, { ...normal, records: [normal.records[0]!], thinData: true }, { ...thin, records: [] }]) {
      const { story } = templateFallback(f);
      expect(story.length).toBeLessThan(200);
      expect(story).not.toContain("about");
      expect(story.toLowerCase()).not.toContain("estimate");
    }
  });

  it("writes estimates as 'about N unit' and explains them", () => {
    const { story } = templateFallback(normal);
    expect(story).toContain("about 12 meals");
    expect(story).toContain("about 150 pounds of produce");
    expect(story).toMatch(/proportional share of pooled gifts/);
    expect(story).toContain("Priya");
    expect(story).toContain("$37.50");
  });

  it("is deterministic and uses only facts-derived text", () => {
    expect(templateFallback(normal)).toEqual(templateFallback(normal));
    expect(templateFallback(normal).story).not.toContain("hostile");
  });

  it("does not echo staff notes", () => {
    const f = variants.find((v) => v[0].startsWith("hostile"))![1];
    expect(templateFallback(f).story).not.toContain("Maria");
  });

  it("next-step rule: thin -> give_again; new records -> share; else volunteer", () => {
    expect(templateFallback(thin).nextStep.kind).toBe("give_again");
    const since = variants.find((v) => v[0] === "since last visit with new records")![1];
    expect(templateFallback(since).nextStep.kind).toBe("share");
    expect(templateFallback(normal).nextStep.kind).toBe("volunteer");
    const nothing = variants.find((v) => v[0] === "since last visit with nothing new")![1];
    expect(templateFallback(nothing).nextStep.kind).toBe("volunteer");
  });

  it("handles a null first name without a dangling comma", () => {
    const { story } = templateFallback({ ...normal, donorFirstName: null });
    expect(story.startsWith("Thank you for giving")).toBe(true);
  });
});
