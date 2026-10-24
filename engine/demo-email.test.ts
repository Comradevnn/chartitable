// Demo email dry run (PRODUCT_SPEC §7, §16): what donor_a01 receives after staff post "served 80
// meals", built by the same engine code the Convex milestone check uses, on the seed. No live data.
import { describe, expect, it } from "vitest";
import { buildSeed } from "../seed/data";
import { allocate } from "./allocate";
import { windowEnding } from "./config";
import { buildFacts } from "./facts";
import { guard } from "./guard";
import { buildMilestoneEmail, estimateTotals, planMilestones } from "./milestones";
import { templateFallback } from "./template";
import type { ImpactLog, NarrativeResult } from "./types";

const NOW = Date.parse("2026-10-24T08:00:00Z");
const DEMO_DONOR = "donor_a01";

function demoEmail(narrativeOutput?: unknown) {
  const seed = buildSeed(NOW);
  const at = NOW + 60_000;
  const served80: ImpactLog = {
    id: "log_demo_80",
    charityId: "demo-pantry-a",
    kind: "meals",
    count: 80,
    unit: "meals",
    note: "Hot meal packs went out with the shelf-stable boxes.",
    photoStorageId: null,
    loggedAt: at,
  };
  const charity = seed.charities.find((c) => c.id === "demo-pantry-a")!;
  const donor = seed.donors.find((d) => d.id === DEMO_DONOR)!;
  const window = windowEnding(at);
  const logs = [...seed.impactLogs, served80].filter((l) => l.charityId === charity.id);
  const donations = seed.donations.filter((d) => d.charityId === charity.id);
  const allocations = allocate(donations, logs, window).filter((a) => a.donorId === DEMO_DONOR);
  const facts = buildFacts({ charity, donor, donations, logs, allocations, window, lastVisitAt: null });
  const plan = planMilestones({ totals: estimateTotals(allocations), fired: new Set() });
  const link = new URL(charity.siteUrl);
  link.searchParams.set("ct", "opaque.token");
  const narrative: NarrativeResult = {
    output: (narrativeOutput ?? templateFallback(facts)) as NarrativeResult["output"],
    source: narrativeOutput ? "claude" : "template",
    guardReasons: [],
  };
  const email = plan.announce ? buildMilestoneEmail({ facts, narrative, link: link.toString(), hit: plan.announce }) : null;
  return { facts, plan, email, link: link.toString(), charity };
}

describe("demo milestone email (dry run on the seed)", () => {
  it("announces the 25-meal milestone after the 80-meal update", () => {
    const { plan } = demoEmail();
    expect(plan.announce?.thresholdId).toBe("meals:25");
  });

  it("the story passes the guard and the share is labeled as an estimate", () => {
    const { facts, email } = demoEmail();
    expect(guard(templateFallback(facts), facts)).toEqual({ ok: true });
    expect(email!.text).toContain("about 26 meals (estimate)");
    expect(email!.text).toMatch(/proportional|pooled|share/i);
  });

  it("links to <siteUrl>?ct=<token> only, with no personal data", () => {
    const { email, link, charity } = demoEmail();
    const u = new URL(link);
    expect(u.origin + u.pathname).toBe(charity.siteUrl);
    expect([...u.searchParams.keys()]).toEqual(["ct"]);
    expect(email!.text).toContain(`See the full update: ${link}`);
    expect(link).not.toMatch(/@|Mira|donor_/);
  });

  it("a stored Claude story that fails the guard is replaced by the template", () => {
    const hostile = { story: "Thank you, Mira. Your gift provided 80 meals.", nextStep: { kind: "share", text: "Share it." } };
    const { facts, email } = demoEmail(hostile);
    expect(email!.text).not.toContain("Your gift provided 80 meals");
    expect(email!.text).toContain(templateFallback(facts).story);
  });

  it("html escapes the story and keeps one link", () => {
    const { email } = demoEmail();
    expect(email!.html.match(/<a /g)).toHaveLength(1);
    expect(email!.html).not.toMatch(/<script/i);
  });
});
