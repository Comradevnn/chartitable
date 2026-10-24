import { describe, expect, it } from "vitest";
import { buildSeed } from "../seed/data";
import { allocate } from "./allocate";
import { windowEnding } from "./config";
import { guard } from "./guard";
import {
  buildMilestoneEmail,
  decideRecipient,
  estimateTotals,
  MILESTONE_SUBJECT,
  planMilestones,
} from "./milestones";
import { templateFallback } from "./template";
import type { Allocation, DonorFacts, ImpactKind, ImpactLog, MilestoneHit, NarrativeResult } from "./types";

const NOW = Date.parse("2026-10-24T08:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function totals(p: Partial<Record<ImpactKind, number>>): Record<ImpactKind, number> {
  return { meals: 0, produce: 0, volunteer_shifts: 0, ...p };
}

function alloc(kind: ImpactKind, q: number): Allocation {
  return {
    donorId: "d",
    charityId: "demo-pantry-a",
    logId: `l${q}`,
    kind,
    unit: kind,
    loggedAt: 1,
    share: 0.5,
    estimatedQuantity: q,
    isEstimate: true,
  };
}

describe("estimateTotals", () => {
  it("sums unrounded by kind", () => {
    const t = estimateTotals([alloc("meals", 1.25), alloc("meals", 2.5), alloc("produce", 7)]);
    expect(t).toEqual({ meals: 3.75, produce: 7, volunteer_shifts: 0 });
  });
});

describe("planMilestones", () => {
  it("below every threshold -> nothing", () => {
    const r = planMilestones({ totals: totals({ meals: 24.9, produce: 99, volunteer_shifts: 2 }), fired: new Set() });
    expect(r).toEqual({ toMark: [], announce: null });
  });

  it("seeded donor_a01: 22.9 meals nothing, 26.8 meals -> meals:25", () => {
    const seed = buildSeed(NOW);
    const meals = (logs: ImpactLog[], at: number) =>
      estimateTotals(
        allocate(seed.donations, logs, windowEnding(at)).filter(
          (a) => a.donorId === "donor_a01" && a.charityId === "demo-pantry-a",
        ),
      );
    const before = meals(seed.impactLogs, NOW);
    expect(planMilestones({ totals: before, fired: new Set() })).toEqual({ toMark: [], announce: null });

    const served80: ImpactLog = {
      id: "log_demo_80",
      charityId: "demo-pantry-a",
      kind: "meals",
      count: 80,
      unit: "meals",
      note: null,
      photoStorageId: null,
      loggedAt: NOW + 60_000,
    };
    const after = meals([...seed.impactLogs, served80], NOW + 60_000);
    const hit: MilestoneHit = { kind: "meals", threshold: 25, thresholdId: "meals:25" };
    expect(planMilestones({ totals: after, fired: new Set() })).toEqual({ toMark: [hit], announce: hit });
  });

  it("uses the rounded estimate: 24.99 meals does not claim 25, 25.0000000001 does", () => {
    expect(planMilestones({ totals: totals({ meals: 24.99 }), fired: new Set() }).toMark).toEqual([]);
    expect(planMilestones({ totals: totals({ meals: 25.0000000001 }), fired: new Set() }).announce?.thresholdId).toBe(
      "meals:25",
    );
  });

  it("never re-hits a fired id", () => {
    const r = planMilestones({ totals: totals({ meals: 30 }), fired: new Set(["meals:25"]) });
    expect(r).toEqual({ toMark: [], announce: null });
  });

  it("a jump past two thresholds marks both and announces the higher", () => {
    const r = planMilestones({ totals: totals({ meals: 60 }), fired: new Set() });
    expect(r.toMark.map((h) => h.thresholdId)).toEqual(["meals:25", "meals:50"]);
    expect(r.announce?.thresholdId).toBe("meals:50");
  });

  it("only unfired lower ones are marked", () => {
    const r = planMilestones({ totals: totals({ meals: 110 }), fired: new Set(["meals:25"]) });
    expect(r.toMark.map((h) => h.thresholdId)).toEqual(["meals:50", "meals:100"]);
    expect(r.announce?.thresholdId).toBe("meals:100");
  });

  it("prefers meals, then produce, then volunteer_shifts when several kinds cross", () => {
    const all = planMilestones({ totals: totals({ meals: 30, produce: 600, volunteer_shifts: 12 }), fired: new Set() });
    expect(all.toMark).toHaveLength(7); // meals:25, produce:100/250/500, shifts:3/6/12
    expect(all.announce?.thresholdId).toBe("meals:25");
    const noMeals = planMilestones({ totals: totals({ produce: 120, volunteer_shifts: 3 }), fired: new Set() });
    expect(noMeals.announce?.thresholdId).toBe("produce:100");
    const onlyShifts = planMilestones({ totals: totals({ volunteer_shifts: 7 }), fired: new Set() });
    expect(onlyShifts.announce?.thresholdId).toBe("volunteer_shifts:6");
  });

  it("double-run safety: after claiming, a second plan has nothing to mark", () => {
    const claimed = new Set<string>(); // stands in for milestoneEmails rows
    const claim = (hits: MilestoneHit[]) => {
      const inserted: string[] = [];
      for (const h of hits) {
        if (claimed.has(h.thresholdId)) continue;
        claimed.add(h.thresholdId);
        inserted.push(h.thresholdId);
      }
      return inserted;
    };
    const t = totals({ meals: 60 });
    const first = planMilestones({ totals: t, fired: new Set(claimed) });
    const second = planMilestones({ totals: t, fired: new Set(claimed) }); // concurrent run saw the same state
    expect(claim(first.toMark)).toEqual(["meals:25", "meals:50"]);
    expect(claim(second.toMark)).toEqual([]); // loser of the race inserts nothing
    expect(planMilestones({ totals: t, fired: new Set(claimed) })).toEqual({ toMark: [], announce: null });
  });
});

describe("decideRecipient", () => {
  const allowlist = new Set(["team@example.com"]);
  const base = { allowlist, lastSentAt: null, now: NOW };
  it("null email", () => {
    expect(decideRecipient({ ...base, email: null })).toBe("skipped_no_email");
  });
  it("not allowlisted", () => {
    expect(decideRecipient({ ...base, email: "stranger@example.com" })).toBe("skipped_not_allowlisted");
  });
  it("empty allowlist sends nothing", () => {
    expect(decideRecipient({ ...base, allowlist: new Set(), email: "team@example.com" })).toBe(
      "skipped_not_allowlisted",
    );
  });
  it("case-insensitive match", () => {
    expect(decideRecipient({ ...base, email: "Team@Example.COM" })).toBe("send");
  });
  it("rate limited within 7 days, sends at 7 days + 1 ms", () => {
    const email = "team@example.com";
    expect(decideRecipient({ ...base, email, lastSentAt: NOW - 7 * DAY + 1 })).toBe("skipped_rate_limited");
    expect(decideRecipient({ ...base, email, lastSentAt: NOW - 7 * DAY })).toBe("send");
    expect(decideRecipient({ ...base, email, lastSentAt: NOW - 7 * DAY - 1 })).toBe("send");
  });
});

describe("buildMilestoneEmail", () => {
  const facts: DonorFacts = {
    charityName: "Riverside Pantry",
    donorFirstName: "Dana",
    donations: [{ amountDollars: 25, dateLabel: "Mon, Oct 12" }],
    totalGivenDollars: 25,
    records: [
      { logId: "l1", kind: "meals", count: 80, unit: "meals", dateLabel: "Tue, Oct 20", note: null, hasPhoto: false },
      { logId: "l2", kind: "meals", count: 40, unit: "meals", dateLabel: "Wed, Oct 21", note: null, hasPhoto: false },
    ],
    estimates: [{ kind: "meals", unit: "meals", approxQuantity: 26, marker: "about" }],
    sinceLastVisit: null,
    thinData: false,
  };
  const hit: MilestoneHit = { kind: "meals", threshold: 25, thresholdId: "meals:25" };
  const link = "https://pantry.example.org/site?ct=abc.def";
  const good: NarrativeResult = { output: templateFallback(facts), source: "template", guardReasons: [] };

  it("uses a guard-passing narrative, fixed subject, about, one link", () => {
    expect(guard(good.output, facts).ok).toBe(true);
    const e = buildMilestoneEmail({ facts, narrative: good, link, hit });
    expect(e.subject).toBe(MILESTONE_SUBJECT);
    expect(e.text).toContain(good.output.story);
    expect(e.text).toContain("Hi Dana,");
    expect(e.text).toContain("Your share so far: about 26 meals (estimate)");
    expect(e.text).toContain("proportional shares of pooled gifts");
    expect(e.text).toContain("Fictional demo — no real payment was made.");
    expect(e.text.split(link)).toHaveLength(2);
    expect(e.text).toMatch(/about/);
    const u = new URL(link);
    expect([...u.searchParams.keys()]).toEqual(["ct"]);
    expect(e.html.split(link)).toHaveLength(2);
    expect(e.html.match(/<a /g)).toHaveLength(1);
    expect(e.html).not.toMatch(/<img/i);
    expect(e.text).not.toContain("@");
    expect(e.html).not.toContain("@");
  });

  it("replaces a narrative with an invented number by the template", () => {
    const bad: NarrativeResult = {
      output: { story: "Your gift provided about 9999 meals.", nextStep: { kind: "give_again", text: "Give again." } },
      source: "claude",
      guardReasons: [],
    };
    const e = buildMilestoneEmail({ facts, narrative: bad, link, hit });
    expect(e.text).not.toContain("9999");
    expect(e.text).toContain(templateFallback(facts).story);
  });

  it("omits the share line when the facts have no estimate for the kind", () => {
    const e = buildMilestoneEmail({ facts: { ...facts, estimates: [] }, narrative: good, link, hit });
    expect(e.text).not.toContain("Your share so far");
    const e2 = buildMilestoneEmail({ facts, narrative: good, link, hit: { kind: "produce", threshold: 100, thresholdId: "produce:100" } });
    expect(e2.text).not.toContain("Your share so far");
  });

  it("greets without a name when facts have none", () => {
    const f = { ...facts, donorFirstName: null };
    const e = buildMilestoneEmail({ facts: f, narrative: { ...good, output: templateFallback(f) }, link, hit });
    expect(e.text.startsWith("Hello,")).toBe(true);
  });

  it("escapes hostile dynamic strings in html", () => {
    const hostile: DonorFacts = { ...facts, charityName: "<script>alert(1)</script>" };
    const narrative: NarrativeResult = { output: templateFallback(hostile), source: "template", guardReasons: [] };
    const e = buildMilestoneEmail({ facts: hostile, narrative, link: `${link}"><script>`, hit });
    expect(e.html).not.toContain("<script");
    expect(e.html).toContain("&lt;script&gt;");
    expect(e.html.match(/<a /g)).toHaveLength(1);
  });
});
