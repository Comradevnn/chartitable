import { describe, expect, it } from "vitest";
import { buildHealth, COUNT_CAP, countVisitStates, HOUR_MS, tallyDryRun } from "./ops";
import type { HealthInput } from "./ops";

const NOW = Date.parse("2026-10-24T08:00:00Z");

function input(p: Partial<HealthInput> = {}): HealthInput {
  return {
    now: NOW,
    latestCall: null,
    recentCallAts: [],
    latestNarrative: null,
    maxPerHour: 60,
    minIntervalMs: 60_000,
    configured: false,
    lastRun: null,
    latestEmail: null,
    sentTotal: 0,
    seedCounts: { charities: 0, donors: 0, donations: 0, impactLogs: 0, expenses: 0 },
    smokeCounts: { donors: 0, impactLogs: 0 },
    visitStates: countVisitStates([]),
    ...p,
  };
}

describe("buildHealth", () => {
  it("empty tables give nulls and zeros", () => {
    const h = buildHealth(input());
    expect(h.narrative).toEqual({
      lastCallAt: null,
      lastCallOutcome: null,
      lastSource: null,
      lastGuardReasonCount: null,
      callsLastHour: 0,
      maxPerHour: 60,
      minIntervalMs: 60_000,
    });
    expect(h.milestones).toEqual({ configured: false, lastRun: null });
    expect(h.email).toEqual({ lastStatus: null, lastAt: null, sentTotal: 0 });
    expect(h.seed).toEqual({ charities: 0, donors: 0, donations: 0, impactLogs: 0, expenses: 0 });
    expect(h.smoke).toEqual({ donors: 0, impactLogs: 0 });
    expect(h.generatedAt).toBe(NOW);
  });

  it("passes through the latest rows", () => {
    const h = buildHealth(
      input({
        latestCall: { at: NOW - 5000, outcome: "rejected" },
        latestNarrative: { source: "template", guardReasonCount: 2 },
        configured: true,
        lastRun: { at: NOW - 1000, smokeSkipped: true, checked: 0, sent: 0, skipped: 0, failed: 0 },
        latestEmail: { status: "skipped_rate_limited", sentAt: NOW - 9000 },
        sentTotal: 3,
      }),
    );
    expect(h.narrative.lastCallAt).toBe(NOW - 5000);
    expect(h.narrative.lastCallOutcome).toBe("rejected");
    expect(h.narrative.lastSource).toBe("template");
    expect(h.narrative.lastGuardReasonCount).toBe(2);
    expect(h.milestones.configured).toBe(true);
    expect(h.milestones.lastRun).toEqual({ at: NOW - 1000, smokeSkipped: true, checked: 0, sent: 0, skipped: 0, failed: 0 });
    expect(h.email).toEqual({ lastStatus: "skipped_rate_limited", lastAt: NOW - 9000, sentTotal: 3 });
  });

  it("caps every count at 1000", () => {
    const h = buildHealth(
      input({
        recentCallAts: Array.from({ length: 1500 }, () => NOW - 1),
        sentTotal: 5000,
        seedCounts: { charities: 1001, donors: 2000, donations: 1000, impactLogs: 999, expenses: 1234 },
        smokeCounts: { donors: 1001, impactLogs: 7 },
      }),
    );
    expect(h.narrative.callsLastHour).toBe(COUNT_CAP);
    expect(h.email.sentTotal).toBe(COUNT_CAP);
    expect(h.seed).toEqual({ charities: 1000, donors: 1000, donations: 1000, impactLogs: 999, expenses: 1000 });
    expect(h.smoke).toEqual({ donors: 1000, impactLogs: 7 });
  });

  it("callsLastHour includes exactly now-1h and excludes older or future rows", () => {
    const h = buildHealth(input({ recentCallAts: [NOW - HOUR_MS - 1, NOW - HOUR_MS, NOW - 1, NOW, NOW + 1] }));
    expect(h.narrative.callsLastHour).toBe(3);
  });

  it("does not alias the lastRun input object", () => {
    const lastRun = { at: 1, smokeSkipped: false, checked: 1, sent: 1, skipped: 0, failed: 0 };
    const h = buildHealth(input({ lastRun }));
    expect(h.milestones.lastRun).not.toBe(lastRun);
  });

  it("contains no email address or free text", () => {
    const h = buildHealth(
      input({
        latestCall: { at: NOW, outcome: "claude" },
        latestNarrative: { source: "claude", guardReasonCount: 0 },
        latestEmail: { status: "sent", sentAt: NOW },
        lastRun: { at: NOW, smokeSkipped: false, checked: 2, sent: 1, skipped: 1, failed: 0 },
      }),
    );
    expect(JSON.stringify(h)).not.toContain("@");
  });
});

describe("tallyDryRun", () => {
  const allowlist = new Set(["demo@example.com"]);

  it("empty input is all zeros", () => {
    expect(tallyDryRun({ configured: false, allowlist, items: [] })).toEqual({
      configured: false,
      candidates: 0,
      nothingToAnnounce: 0,
      wouldSend: 0,
      skippedNoEmail: 0,
      skippedNotAllowlisted: 0,
      skippedRateLimited: 0,
      nonAllowlistedWouldSend: 0,
    });
  });

  it("counts each decision", () => {
    const r = tallyDryRun({
      configured: true,
      allowlist,
      items: [
        { outcome: "nothing", email: null },
        { outcome: "nothing", email: "x@example.com" },
        { outcome: "send", email: "demo@example.com" },
        { outcome: "send", email: " Demo@Example.com " },
        { outcome: "skipped_no_email", email: null },
        { outcome: "skipped_not_allowlisted", email: "other@example.com" },
        { outcome: "skipped_rate_limited", email: "demo@example.com" },
        { outcome: "skipped_rate_limited", email: "demo@example.com" },
      ],
    });
    expect(r).toEqual({
      configured: true,
      candidates: 8,
      nothingToAnnounce: 2,
      wouldSend: 2,
      skippedNoEmail: 1,
      skippedNotAllowlisted: 1,
      skippedRateLimited: 2,
      nonAllowlistedWouldSend: 0,
    });
  });

  it("flags a send decision whose address is off the allowlist", () => {
    const r = tallyDryRun({
      configured: true,
      allowlist,
      items: [
        { outcome: "send", email: "stranger@example.com" },
        { outcome: "send", email: null },
        { outcome: "send", email: "demo@example.com" },
      ],
    });
    expect(r.wouldSend).toBe(3);
    expect(r.nonAllowlistedWouldSend).toBe(2);
  });

  it("never carries an email address", () => {
    const r = tallyDryRun({
      configured: true,
      allowlist,
      items: [{ outcome: "send", email: "demo@example.com" }],
    });
    expect(JSON.stringify(r)).not.toContain("@");
  });
});

describe("countVisitStates", () => {
  const ZERO = { just_gave: 0, news: 0, first_impact: 0, repeat: 0, lapsed: 0, returning: 0, unknown: 0 };

  it("is zero-filled for all six states plus unknown", () => {
    expect(countVisitStates([])).toEqual(ZERO);
  });

  it("counts each state and buckets missing or unrecognised values as unknown", () => {
    const c = countVisitStates([
      { state: "just_gave" },
      { state: "repeat" },
      { state: "repeat" },
      { state: "lapsed" },
      { state: "news" },
      { state: "first_impact" },
      { state: "returning" },
      {},
      { state: null },
      { state: "bogus" },
    ]);
    expect(c).toEqual({ just_gave: 1, news: 1, first_impact: 1, repeat: 2, lapsed: 1, returning: 1, unknown: 3 });
  });

  it("buildHealth passes visit state counts through, zero-filled and capped", () => {
    const h = buildHealth(input({ visitStates: { ...ZERO, repeat: 5, news: COUNT_CAP + 50 } }));
    expect(h.visitStates).toEqual({ ...ZERO, repeat: 5, news: COUNT_CAP });
  });
});
