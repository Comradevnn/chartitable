import { describe, expect, it } from "vitest";
import { buildSeed } from "../seed/data";
import { allocate } from "./allocate";
import { windowEnding } from "./config";
import { buildDonorView, narrativeFacts, parseDonorViewRequest } from "./donor-view";
import type { DonorViewContext } from "./donor-view";
import { guard } from "./guard";
import { templateFallback } from "./template";
import { signToken } from "./token";
import type { DonorView, NarrativeResult } from "./types";

const NOW = Date.UTC(2026, 9, 24, 18, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const SECRET = "test-secret-test-secret-test-secret-123";
const OTHER_SECRET = "another-secret-another-secret-4567890";
const URL_A = "https://x.convex.site/donor-view?charity=demo-pantry-a";

const seed = buildSeed(NOW);
const window = windowEnding(NOW);
const allocations = allocate(seed.donations, seed.impactLogs, window);
const EMAIL = "mira.private@example.org";

function contextFor(donorId: string, charityId: "demo-pantry-a" | "demo-pantry-b" = "demo-pantry-a"): DonorViewContext {
  const charity = seed.charities.find((c) => c.id === charityId)!;
  const base = seed.donors.find((d) => d.id === donorId)!;
  const photos = seed.impactLogs
    .filter((l) => l.charityId === charityId && l.photoPath)
    .map((l) => ({ logId: l.id, url: `https://assets.example/${l.photoPath}` }));
  return {
    charity,
    donor: { ...base, email: EMAIL },
    donations: seed.donations.filter((d) => d.charityId === charityId),
    logs: seed.impactLogs.filter((l) => l.charityId === charityId),
    allocations: allocations.filter((a) => a.donorId === donorId && a.charityId === charityId),
    window,
    photos,
  };
}

function templateNarrative(ctx: DonorViewContext): NarrativeResult {
  return { output: templateFallback(narrativeFacts(ctx)), source: "template", guardReasons: [] };
}

function recognized(v: DonorView) {
  if (!v.recognized) throw new Error("expected recognized view");
  return v;
}

describe("parseDonorViewRequest", () => {
  const payload = { donorId: "donor_a01", charityId: "demo-pantry-a" as const, exp: NOW + DAY };

  it("accepts a valid request", async () => {
    const token = await signToken(payload, SECRET);
    expect(await parseDonorViewRequest(URL_A, `Bearer ${token}`, SECRET, NOW)).toEqual({
      ok: true,
      donorId: "donor_a01",
      charityId: "demo-pantry-a",
    });
  });

  it("rejects tampered payload, tampered signature, expired, malformed", async () => {
    const token = await signToken(payload, SECRET);
    const [body, sig] = token.split(".") as [string, string];
    const forged = btoa(JSON.stringify({ ...payload, donorId: "donor_a02" })).replace(/=+$/, "");
    const flipped = sig.slice(0, -2) + (sig.endsWith("AA") ? "BB" : "AA");
    const expired = await signToken({ ...payload, exp: NOW - 1 }, SECRET);
    for (const t of [`${forged}.${sig}`, `${body}.${flipped}`, expired, "garbage", "a.b.c", ""]) {
      expect(await parseDonorViewRequest(URL_A, `Bearer ${t}`, SECRET, NOW)).toEqual({ ok: false });
    }
  });

  it("rejects missing/wrong header, bad charity, wrong-charity token, null secret, wrong secret", async () => {
    const token = await signToken(payload, SECRET);
    expect(await parseDonorViewRequest(URL_A, null, SECRET, NOW)).toEqual({ ok: false });
    expect(await parseDonorViewRequest(URL_A, `Basic ${token}`, SECRET, NOW)).toEqual({ ok: false });
    expect(await parseDonorViewRequest(URL_A, token, SECRET, NOW)).toEqual({ ok: false });
    expect(await parseDonorViewRequest("https://x.convex.site/donor-view?charity=nope", `Bearer ${token}`, SECRET, NOW)).toEqual({ ok: false });
    expect(await parseDonorViewRequest("https://x.convex.site/donor-view", `Bearer ${token}`, SECRET, NOW)).toEqual({ ok: false });
    expect(await parseDonorViewRequest("not a url", `Bearer ${token}`, SECRET, NOW)).toEqual({ ok: false });
    expect(
      await parseDonorViewRequest("https://x.convex.site/donor-view?charity=demo-pantry-b", `Bearer ${token}`, SECRET, NOW),
    ).toEqual({ ok: false });
    expect(await parseDonorViewRequest(URL_A, `Bearer ${token}`, null, NOW)).toEqual({ ok: false });
    expect(await parseDonorViewRequest(URL_A, `Bearer ${token}`, OTHER_SECRET, NOW)).toEqual({ ok: false });
  });
});

describe("buildDonorView", () => {
  const ctx = contextFor("donor_a01");

  it("first visit has no sinceLastVisit", () => {
    const v = recognized(buildDonorView({ context: ctx, previousVisitAt: null, narrative: templateNarrative(ctx), donateHref: null }));
    expect(v.sinceLastVisit).toBeNull();
    expect(v.hero.firstName).toBe("Mira");
  });

  it("sinceLastVisit lists logs after the previous visit and shifts with it", () => {
    const logs = [...ctx.logs].sort((a, b) => a.loggedAt - b.loggedAt);
    const target = logs[logs.length - 2]!;
    const newest = logs[logs.length - 1]!;
    const early = recognized(
      buildDonorView({ context: ctx, previousVisitAt: target.loggedAt - 1, narrative: templateNarrative(ctx), donateHref: null }),
    );
    const late = recognized(
      buildDonorView({ context: ctx, previousVisitAt: target.loggedAt + 1, narrative: templateNarrative(ctx), donateHref: null }),
    );
    expect(early.sinceLastVisit?.records.map((r) => r.logId)).toContain(target.id);
    expect(late.sinceLastVisit?.records.map((r) => r.logId)).not.toContain(target.id);
    expect(late.sinceLastVisit?.records.map((r) => r.logId)).toContain(newest.id);
    expect(early.sinceLastVisit).not.toEqual(late.sinceLastVisit);
  });

  it("leaks no email, donorId, or '@'; keeps records and estimates apart", () => {
    const v = recognized(
      buildDonorView({ context: ctx, previousVisitAt: NOW - 3 * DAY, narrative: templateNarrative(ctx), donateHref: "https://donate.example/?charity=demo-pantry-a" }),
    );
    const s = JSON.stringify(v);
    expect(s).not.toContain("@");
    expect(s).not.toContain(EMAIL);
    expect(s).not.toContain(ctx.donor.id);
    expect(Array.isArray(v.records)).toBe(true);
    expect(Array.isArray(v.estimates)).toBe(true);
    expect(v.estimates.length).toBeGreaterThan(0);
    expect(v.estimates.every((e) => e.marker === "about")).toBe(true);
    expect(v.records.length).toBeGreaterThan(0);
  });

  it("replaces a narrative with an invented number by the template", () => {
    const bad: NarrativeResult = {
      output: { story: "Thank you, Mira. You helped 9999 meals.", nextStep: { kind: "share", text: "Share us with a friend." } },
      source: "claude",
      guardReasons: [],
    };
    const v = recognized(buildDonorView({ context: ctx, previousVisitAt: null, narrative: bad, donateHref: null }));
    expect(v.hero.source).toBe("template");
    expect(v.hero.story).not.toContain("9999");
    expect(v.hero.story).toBe(templateFallback(narrativeFacts(ctx)).story);
  });

  it("keeps a narrative that passes the guard", () => {
    const facts = narrativeFacts(ctx);
    const good: NarrativeResult = { output: templateFallback(facts), source: "claude", guardReasons: [] };
    expect(guard(good.output, facts)).toEqual({ ok: true });
    const v = recognized(buildDonorView({ context: ctx, previousVisitAt: null, narrative: good, donateHref: null }));
    expect(v.hero.source).toBe("claude");
    expect(v.hero.story).toBe(good.output.story);
  });

  it("sets nextStep.href only for give_again / give_monthly", () => {
    const facts = narrativeFacts(ctx);
    const href = "https://donate.example/?charity=demo-pantry-a";
    const mk = (kind: "give_again" | "give_monthly" | "volunteer" | "share"): NarrativeResult => ({
      output: { story: templateFallback(facts).story, nextStep: { kind, text: "If you would like to, help keep the next update going." } },
      source: "claude",
      guardReasons: [],
    });
    for (const kind of ["give_again", "give_monthly", "volunteer", "share"] as const) {
      const v = recognized(buildDonorView({ context: ctx, previousVisitAt: null, narrative: mk(kind), donateHref: href }));
      expect(v.nextStep.kind).toBe(kind);
      expect(v.nextStep.href).toBe(kind === "give_again" || kind === "give_monthly" ? href : null);
    }
    const none = recognized(buildDonorView({ context: ctx, previousVisitAt: null, narrative: mk("give_again"), donateHref: null }));
    expect(none.nextStep.href).toBeNull();
  });

  it("only returns photos for logs in records", () => {
    const stray = { logId: "log_not_in_records", url: "https://assets.example/x.svg" };
    const withStray = { ...ctx, photos: [...ctx.photos, stray] };
    const v = recognized(buildDonorView({ context: withStray, previousVisitAt: null, narrative: templateNarrative(withStray), donateHref: null }));
    const ids = new Set(v.records.map((r) => r.logId));
    expect(v.photos.length).toBeGreaterThan(0);
    expect(v.photos.every((p) => ids.has(p.logId))).toBe(true);
    expect(v.photos.find((p) => p.logId === stray.logId)).toBeUndefined();
  });

  it("thin-data donor (no gifts in window) still gets a valid view without estimates", () => {
    const thin: DonorViewContext = {
      ...ctx,
      donor: { id: "donor_none", firstName: "Zed", email: EMAIL },
      allocations: [],
    };
    const v = recognized(buildDonorView({ context: thin, previousVisitAt: null, narrative: templateNarrative(thin), donateHref: null }));
    expect(v.estimates).toEqual([]);
    expect(v.hero.story.length).toBeGreaterThan(0);
    expect(v.hero.source).toBe("template");
    expect(JSON.stringify(v)).not.toContain("donor_none");
    expect(JSON.stringify(v)).not.toContain("@");
  });
});
