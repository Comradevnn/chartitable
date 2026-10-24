import { describe, expect, it } from "vitest";
import { buildSeed } from "../seed/data";
import { allocate } from "./allocate";
import { windowEnding } from "./config";
import { computeRev, nextStepKindFor } from "./donor-state";
import { buildDonorView, narrativeFacts, parseDonorViewRequest } from "./donor-view";
import { LIVE_POLL_MS } from "./config";
import { nextStepFor } from "./next-step";
import type { DonorViewContext } from "./donor-view";
import { guard } from "./guard";
import { templateFallback } from "./template";
import { signToken } from "./token";
import type { Donation, DonorView, NarrativeResult } from "./types";

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

  it("sets nextStep.href only for give kinds; kind comes from the donor-state rule", () => {
    const facts = narrativeFacts(ctx);
    const href = "https://donate.example/?charity=demo-pantry-a";
    const mk = (kind: "give_again" | "give_monthly" | "volunteer" | "share"): NarrativeResult => ({
      output: { story: templateFallback(facts).story, nextStep: { kind, text: "If you would like to, help keep the next update going." } },
      source: "claude",
      guardReasons: [],
    });
    const lapsedCtx: DonorViewContext = {
      ...ctx,
      donations: ctx.donations.filter((d) => d.donorId !== ctx.donor.id),
      allocations: [],
    };
    for (const kind of ["give_again", "give_monthly", "volunteer", "share"] as const) {
      const v = recognized(buildDonorView({ context: ctx, previousVisitAt: null, narrative: mk(kind), donateHref: href }));
      expect(v.nextStep.kind).toBe(nextStepKindFor(v.donor!.state));
      expect(v.nextStep.href).toBe(v.nextStep.kind === "give_again" ? href : null);
    }
    const none = recognized(buildDonorView({ context: lapsedCtx, previousVisitAt: null, narrative: mk("give_again"), donateHref: null }));
    expect(none.nextStep.kind).toBe("give_again");
    expect(none.nextStep.href).toBeNull();
    const withHref = recognized(buildDonorView({ context: lapsedCtx, previousVisitAt: null, narrative: mk("give_again"), donateHref: href }));
    expect(withHref.nextStep.href).toBe(href);
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

describe("buildDonorView contract v2 fields", () => {
  const ctx = contextFor("donor_a01");
  const build = (
    c: DonorViewContext,
    extra: Partial<Parameters<typeof buildDonorView>[0]> = {},
  ) => recognized(buildDonorView({ context: c, previousVisitAt: null, narrative: templateNarrative(c), donateHref: null, ...extra }));

  it("fills headline, body, label, donor, rev and live", () => {
    const v = build(ctx);
    expect(v.hero.headline).toBeTruthy();
    expect(v.hero.headline).not.toMatch(/\d/);
    expect(v.hero.body).toBeTruthy();
    expect(v.hero.body!.startsWith("Thank you")).toBe(false);
    expect(v.nextStep.label).toBe(nextStepFor(v.nextStep.kind, ctx.charity.name).label);
    expect(v.donor!.traits).toContain("named");
    expect(v.donor!.traits).toContain("has_photos");
    expect(v.donor!.giftCount).toBe(v.donor!.gifts.length);
    expect(v.rev).toMatch(/^[0-9a-z]+$/);
    expect(v.live).toEqual({ pollMs: LIVE_POLL_MS });
  });

  it("does not change the facts Claude sees", () => {
    const before = JSON.stringify(narrativeFacts(ctx));
    build(ctx, { ownGifts: ctx.donations, visitsInLast30Days: 5, narrativeAt: 7 });
    expect(JSON.stringify(narrativeFacts(ctx))).toBe(before);
    expect(narrativeFacts(ctx)).not.toHaveProperty("nextStepKind");
  });

  it("donor.gifts is newest first, own gifts only, whole-dollar facts", () => {
    const mine = (id: string, ageDays: number, cents: number): Donation => ({
      id, donorId: ctx.donor.id, charityId: ctx.charity.id, amountCents: cents, createdAt: NOW - ageDays * DAY, testMode: true,
    });
    const stranger: Donation = { ...mine("g_other", 0, 99900), donorId: "donor_a02" };
    const own = [mine("g_old", 80, 1000), mine("g_new", 2, 2500), mine("g_mid", 40, 5000), stranger];
    const v = build(ctx, { ownGifts: own });
    expect(v.donor!.giftCount).toBe(3);
    expect(v.donor!.gifts.map((g) => g.amountDollars)).toEqual([25, 50, 10]);
    expect(v.donor!.gifts[0]!.dateLabel).toMatch(/^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d+$/);
    expect(v.donor!.state).toBe("repeat");
    expect(JSON.stringify(v)).not.toContain("99900");
  });

  it("falls back to context.donations for this donor when ownGifts is absent", () => {
    const v = build(ctx);
    const expected = ctx.donations.filter((d) => d.donorId === ctx.donor.id).length;
    expect(v.donor!.giftCount).toBe(expected);
  });

  it("caps donor.gifts but keeps the true giftCount", () => {
    const many: Donation[] = Array.from({ length: 60 }, (_, i) => ({
      id: `g${i}`, donorId: ctx.donor.id, charityId: ctx.charity.id, amountCents: 100, createdAt: NOW - (i + 3) * DAY, testMode: true,
    }));
    const v = build(ctx, { ownGifts: many });
    expect(v.donor!.gifts).toHaveLength(50);
    expect(v.donor!.giftCount).toBe(60);
  });

  it("classifies just_gave for a fresh gift without estimates, and regular from visits", () => {
    const fresh: DonorViewContext = {
      ...ctx,
      donor: { id: "donor_new", firstName: "Zed", email: EMAIL },
      donations: [{ id: "g1", donorId: "donor_new", charityId: ctx.charity.id, amountCents: 2500, createdAt: NOW - 10 * 60 * 1000, testMode: true }],
      allocations: [],
    };
    const v = build(fresh, { visitsInLast30Days: 4 });
    expect(v.donor!.state).toBe("just_gave");
    expect(v.donor!.traits).toEqual(["named", "has_photos", "regular"]);
    expect(v.hero.headline).toBe("Thank you, Zed. Your gift is in.");
    expect(v.nextStep.kind).toBe("share");
  });

  it("news when logs arrived after the previous visit", () => {
    const logs = [...ctx.logs].sort((a, b) => a.loggedAt - b.loggedAt);
    const v = build(ctx, { previousVisitAt: logs[logs.length - 1]!.loggedAt - 1 });
    expect(v.donor!.state).toBe("news");
    expect(v.hero.headline).toContain(ctx.charity.name);
    expect(v.nextStep.kind).toBe("share");
  });

  it("keeps the narrative's next-step text when its kind matches, else uses the rule's text", () => {
    const facts = narrativeFacts(ctx);
    const probe = build(ctx);
    const kind = probe.nextStep.kind;
    const custom = "If it feels right, share this with a neighbor.";
    const matching: NarrativeResult = {
      output: { story: templateFallback(facts).story, nextStep: { kind, text: custom } },
      source: "claude",
      guardReasons: [],
    };
    expect(guard(matching.output, facts).ok).toBe(true);
    expect(build(ctx, { narrative: matching }).nextStep.text).toBe(custom);
    const other = kind === "share" ? "volunteer" : "share";
    const mismatched: NarrativeResult = {
      output: { story: templateFallback(facts).story, nextStep: { kind: other, text: custom } },
      source: "claude",
      guardReasons: [],
    };
    expect(build(ctx, { narrative: mismatched }).nextStep.text).toBe(nextStepFor(kind, ctx.charity.name).text);
  });

  it("rev is stable, and changes with a new log, a new narrative time, or a new gift", () => {
    const r0 = build(ctx).rev;
    expect(build(ctx).rev).toBe(r0);
    expect(build(ctx, { visitsInLast30Days: 9, previousVisitAt: NOW - DAY }).rev).toBe(r0);
    expect(build(ctx, { narrativeAt: 123 }).rev).not.toBe(r0);
    const newLog = { ...ctx.logs[0]!, id: "log_zzz_new", loggedAt: NOW + 1000 };
    expect(build({ ...ctx, logs: [...ctx.logs, newLog] }).rev).not.toBe(r0);
    const newGift: Donation = { id: "g_new", donorId: ctx.donor.id, charityId: ctx.charity.id, amountCents: 500, createdAt: NOW - 1000, testMode: true };
    expect(build(ctx, { ownGifts: [...ctx.donations.filter((d) => d.donorId === ctx.donor.id), newGift] }).rev).not.toBe(r0);
  });

  it("rev equals computeRev of newest log, narrativeAt and newest own gift", () => {
    const newestLog = [...ctx.logs].sort((a, b) => b.loggedAt - a.loggedAt)[0]!;
    const own = ctx.donations.filter((d) => d.donorId === ctx.donor.id).sort((a, b) => b.createdAt - a.createdAt)[0]!;
    expect(build(ctx, { narrativeAt: 42 }).rev).toBe(
      computeRev({ newestLogId: newestLog.id, narrativeAt: 42, newestGiftId: own.id }),
    );
    expect(build({ ...ctx, logs: [], donations: [] }).rev).toBe(
      computeRev({ newestLogId: null, narrativeAt: null, newestGiftId: null }),
    );
  });

  it("never leaks email or donorId in any v2 state", () => {
    for (const id of ["donor_a01", "donor_a02", "donor_a03"]) {
      const c = contextFor(id);
      const s = JSON.stringify(build(c, { visitsInLast30Days: 3, narrativeAt: 5 }));
      expect(s).not.toContain("@");
      expect(s).not.toContain(EMAIL);
      expect(s).not.toContain(id);
    }
  });

  it("nextStep.text passes the guard for each kind (as a narrative with the view's facts)", () => {
    const facts = narrativeFacts(ctx);
    for (const kind of ["give_again", "give_monthly", "volunteer", "share"] as const) {
      const out = { story: templateFallback(facts).story, nextStep: { kind, text: nextStepFor(kind, ctx.charity.name).text } };
      expect(guard(out, facts)).toEqual({ ok: true });
    }
    const v = build(ctx);
    expect(guard({ story: v.hero.story, nextStep: { kind: v.nextStep.kind, text: v.nextStep.text } }, facts)).toEqual({ ok: true });
  });
});
