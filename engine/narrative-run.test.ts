import { describe, expect, it, vi } from "vitest";
import { NARRATIVE_JSON_SCHEMA, buildPrompt } from "./prompt";
import { guard } from "./guard";
import { templateFallback } from "./template";
import { ModelError, runNarrative, type CallModel, type NarrativeCaps, type RunNarrativeInput } from "./narrative-run";
import type { DonorFacts, NarrativeResult, RecordFact } from "./types";

const rec = (logId: string, count: number, unit: string, dateLabel: string, kind: RecordFact["kind"] = "meals"): RecordFact => ({
  logId, kind, count, unit, dateLabel, note: null, hasPhoto: false,
});

const facts: DonorFacts = {
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
const thinFacts: DonorFacts = { ...facts, records: [rec("l1", 80, "meals", "Thu, Oct 8")], estimates: [], thinData: true };

const NOW = 1_000_000_000_000;
const openCaps: NarrativeCaps = { callsInLastHour: 0, lastCallAtForDonor: null, maxPerHour: 60, minIntervalMs: 60_000 };

// The template output is guard-clean by construction; use it as a stand-in for a good model reply.
const goodReply = templateFallback(facts);

const run = (callModel: CallModel | null, over: Partial<RunNarrativeInput> = {}) =>
  runNarrative({ facts, now: NOW, cached: null, caps: openCaps, callModel, ...over });

describe("runNarrative", () => {
  it("accepts a guard-clean Claude reply", async () => {
    const mock = vi.fn<CallModel>().mockResolvedValue(goodReply);
    const out = await run(mock);
    expect(out.outcome).toBe("claude");
    expect(out.called).toBe(true);
    expect(out.result).toEqual({ output: goodReply, source: "claude", guardReasons: [] });
    expect(guard(out.result.output, facts)).toEqual({ ok: true });
  });

  it("passes the buildPrompt system/user and the narrative schema to the model", async () => {
    const mock = vi.fn<CallModel>().mockResolvedValue(goodReply);
    await run(mock, { timeoutMs: 1234 });
    expect(mock).toHaveBeenCalledTimes(1);
    const req = mock.mock.calls[0]![0];
    const p = buildPrompt(facts);
    expect(req.system).toBe(p.system);
    expect(req.user).toBe(p.user);
    expect(req.schema).toBe(NARRATIVE_JSON_SCHEMA);
    expect(req.timeoutMs).toBe(1234);
  });

  it("rejects an invented number and falls back to the template", async () => {
    const bad = { story: "Your gift gave about 999 meals this month. That is an estimate from pooled gifts.", nextStep: { kind: "give_again", text: "Consider giving again." } };
    const out = await run(vi.fn<CallModel>().mockResolvedValue(bad));
    expect(out.outcome).toBe("rejected");
    expect(out.called).toBe(true);
    expect(out.result.source).toBe("template");
    expect(out.result.guardReasons.length).toBeGreaterThan(0);
    expect(out.result.output).toEqual(templateFallback(facts));
  });

  it("rejects an invented name", async () => {
    const bad = { story: "Thanks to Marcus Delgado, Priya, your gifts helped Juniper Street Pantry.", nextStep: { kind: "share", text: "Tell a friend about us." } };
    const out = await run(vi.fn<CallModel>().mockResolvedValue(bad));
    expect(out.outcome).toBe("rejected");
    expect(out.result.source).toBe("template");
    expect(out.result.guardReasons.length).toBeGreaterThan(0);
  });

  it("times out when the model never resolves", async () => {
    const mock = vi.fn<CallModel>(() => new Promise(() => {}));
    const out = await run(mock, { timeoutMs: 20 });
    expect(out.outcome).toBe("error");
    expect(out.called).toBe(true);
    expect(out.result.source).toBe("template");
    expect(out.result.guardReasons).toEqual(["model error: timeout"]);
  });

  it("maps ModelError categories", async () => {
    for (const cat of ["refusal", "parse", "api", "timeout"] as const) {
      const out = await run(vi.fn<CallModel>().mockRejectedValue(new ModelError(cat)));
      expect(out.outcome).toBe("error");
      expect(out.result.source).toBe("template");
      expect(out.result.guardReasons).toEqual([`model error: ${cat}`]);
    }
  });

  it("treats a non-ModelError throw as api", async () => {
    const out = await run(vi.fn<CallModel>().mockRejectedValue(new TypeError("boom")));
    expect(out.outcome).toBe("error");
    expect(out.result.guardReasons).toEqual(["model error: api"]);
    const sync = await run(() => {
      throw new Error("sync boom");
    });
    expect(sync.result.guardReasons).toEqual(["model error: api"]);
  });

  it("never throws on junk replies", async () => {
    for (const junk of [null, undefined, "a string", 42, [], { story: 1 }, { story: "x" }]) {
      const out = await run(vi.fn<CallModel>().mockResolvedValue(junk));
      expect(["rejected", "error"]).toContain(out.outcome);
      expect(out.result.source).toBe("template");
      expect(guard(out.result.output, facts)).toEqual({ ok: true });
    }
  });

  it("returns the template without calling when there is no key", async () => {
    const out = await run(null);
    expect(out.outcome).toBe("no_key");
    expect(out.called).toBe(false);
    expect(out.latencyMs).toBe(0);
    expect(out.result).toEqual({ output: templateFallback(facts), source: "template", guardReasons: [] });
  });

  it("returns the cached row without calling the model", async () => {
    const cached: NarrativeResult = { output: goodReply, source: "claude", guardReasons: [] };
    const mock = vi.fn<CallModel>();
    const out = await run(mock, { cached });
    expect(out).toEqual({ result: cached, outcome: "cache", called: false, latencyMs: 0 });
    expect(mock).not.toHaveBeenCalled();
  });

  it("serves the cache even with no key or when capped", async () => {
    const cached: NarrativeResult = { output: goodReply, source: "template", guardReasons: ["x"] };
    expect((await run(null, { cached })).outcome).toBe("cache");
    expect((await run(vi.fn<CallModel>(), { cached, caps: { ...openCaps, callsInLastHour: 99 } })).outcome).toBe("cache");
  });

  it("is capped by the hourly limit", async () => {
    const mock = vi.fn<CallModel>().mockResolvedValue(goodReply);
    const out = await run(mock, { caps: { ...openCaps, callsInLastHour: 60 } });
    expect(out.outcome).toBe("capped");
    expect(out.called).toBe(false);
    expect(out.result.source).toBe("template");
    expect(mock).not.toHaveBeenCalled();
    const under = await run(mock, { caps: { ...openCaps, callsInLastHour: 59 } });
    expect(under.outcome).toBe("claude");
  });

  it("is capped by the per donor+charity minimum interval, and not once it has passed", async () => {
    const mock = vi.fn<CallModel>().mockResolvedValue(goodReply);
    const recent = await run(mock, { caps: { ...openCaps, lastCallAtForDonor: NOW - 59_999 } });
    expect(recent.outcome).toBe("capped");
    expect(mock).not.toHaveBeenCalled();
    const passed = await run(mock, { caps: { ...openCaps, lastCallAtForDonor: NOW - 60_000 } });
    expect(passed.outcome).toBe("claude");
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("every template result passes the guard", async () => {
    for (const f of [facts, thinFacts, { ...facts, donorFirstName: null }]) {
      const outs = [
        await runNarrative({ facts: f, now: NOW, cached: null, caps: openCaps, callModel: null }),
        await runNarrative({ facts: f, now: NOW, cached: null, caps: { ...openCaps, callsInLastHour: 60 }, callModel: vi.fn<CallModel>() }),
        await runNarrative({ facts: f, now: NOW, cached: null, caps: openCaps, callModel: vi.fn<CallModel>().mockRejectedValue(new ModelError("api")) }),
        await runNarrative({ facts: f, now: NOW, cached: null, caps: openCaps, callModel: vi.fn<CallModel>().mockResolvedValue({ story: 1 }) }),
      ];
      for (const o of outs) {
        expect(o.result.source).toBe("template");
        expect(guard(o.result.output, f)).toEqual({ ok: true });
      }
    }
  });
});
