// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LIVE_MAX_MS, startLive } from "../src/live";
import { paintRegions } from "../src/regions";
import { parseView, type View } from "../src/view";

const API = "https://api.test";
const DONATE = "https://example.test/donate?charity=demo-pantry-a";
const NO_REC = { logId: "a", count: 80, unit: "meals", dateLabel: "Oct 20", note: null };

function viewOf(over: Record<string, unknown> = {}, story = "Thanks, Ada."): View {
  const v = parseView({
    recognized: true,
    hero: { firstName: "Ada", story, headline: "Thank you", body: null },
    sinceLastVisit: null,
    nextStep: null,
    records: [NO_REC],
    estimates: [{ unit: "meals", approxQuantity: 26 }],
    photos: [],
    donor: { state: "first_impact", traits: [], gifts: [], giftCount: 1 },
    rev: "r1",
    live: { pollMs: 6000 },
    ...over,
  });
  if (!v) throw new Error("view");
  return v;
}

const PAGE = `
<div data-impact-region="hero"><h1>Default</h1></div>
<template data-impact-for="hero" data-impact-when="state:news" data-impact-variant="news">
  <p data-ct-text="story"></p><ul><li data-ct-each="records"><span data-ct-text="record"></span></li></ul>
</template>
<template data-impact-for="hero" data-impact-variant="first-impact">
  <p data-ct-text="story"></p>
  <ul><li data-ct-each="records"><span data-ct-text="record"></span></li></ul>
  <p data-ct-each="estimates"><span data-ct-text="estimate"></span></p>
</template>
<div data-impact-region="recent" data-impact-requires="sinceRecords"><p>No news</p></div>
<template data-impact-for="recent" data-impact-variant="recent">
  <ul><li data-ct-each="sinceRecords"><span data-ct-text="record"></span></li></ul>
</template>`;

let vis = "visible";
const setVis = (v: string): void => {
  vis = v;
  document.dispatchEvent(new Event("visibilitychange"));
};

type Reply = unknown | (() => unknown);
let routes: { pulse: Reply; view: Reply };
let calls: Array<{ url: string; init: RequestInit }>;
const fetchStub = vi.fn(async (url: string, init: RequestInit) => {
  calls.push({ url, init });
  const reply = url.indexOf("/donor-pulse") !== -1 ? routes.pulse : routes.view;
  const body = typeof reply === "function" ? (reply as () => unknown)() : reply;
  if (body instanceof Error) throw body;
  return { json: async () => body };
});
const pulses = (): number => calls.filter((c) => c.url.indexOf("/donor-pulse") !== -1).length;
const peeks = (): number => calls.filter((c) => c.url.indexOf("/donor-view") !== -1).length;

function apiBody(over: Record<string, unknown> = {}, story = "Thanks, Ada."): Record<string, unknown> {
  return ({
    recognized: true,
    hero: { firstName: "Ada", story, headline: "Thank you" },
    records: [NO_REC],
    estimates: [{ unit: "meals", approxQuantity: 26 }],
    photos: [],
    donor: { state: "first_impact", traits: [], gifts: [], giftCount: 1 },
    rev: "r1",
    live: { pollMs: 6000 },
    ...over,
  });
}

let forgotten = 0;
const stops: Array<() => void> = [];
function begin(view: View, extra: Record<string, unknown> = {}): () => void {
  const stop = startLive({
    view,
    api: API,
    charity: "demo-pantry-a",
    token: () => "tok",
    forget: () => {
      forgotten++;
    },
    donateHref: DONATE,
    ...extra,
  });
  if (!stop) throw new Error("no live");
  stops.push(stop);
  return stop;
}

function paintFirst(view: View): void {
  paintRegions(document, view, DONATE);
}

beforeEach(() => {
  vi.useFakeTimers();
  document.documentElement.removeAttribute("data-impact-live");
  document.body.innerHTML = PAGE;
  vis = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => vis });
  vi.stubGlobal("fetch", fetchStub);
  vi.stubGlobal("matchMedia", () => ({ matches: true })); // reduced motion: these tests are about data
  calls = [];
  fetchStub.mockClear();
  routes = { pulse: { rev: "r1" }, view: apiBody() };
  forgotten = 0;
});
afterEach(() => {
  while (stops.length) stops.pop()?.();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("starting", () => {
  it("needs pollMs and rev, and an api", () => {
    expect(startLive({ view: viewOf({ live: undefined }), api: API, charity: "c", token: () => "t", forget: () => {}, donateHref: "" })).toBeNull();
    expect(startLive({ view: viewOf({ rev: undefined }), api: API, charity: "c", token: () => "t", forget: () => {}, donateHref: "" })).toBeNull();
    expect(startLive({ view: viewOf(), api: "", charity: "c", token: () => "t", forget: () => {}, donateHref: "" })).toBeNull();
    expect(document.documentElement.hasAttribute("data-impact-live")).toBe(false);
    expect(document.querySelector(".ct-sr")).toBeNull();
    expect(fetchStub).not.toHaveBeenCalled();
  });
  it("polls every pollMs with a bearer token, no credentials, and sets data-impact-live", async () => {
    begin(viewOf());
    expect(document.documentElement.hasAttribute("data-impact-live")).toBe(true);
    await vi.advanceTimersByTimeAsync(5900);
    expect(pulses()).toBe(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(pulses()).toBe(1);
    const call = calls[0];
    expect(call?.url).toBe(API + "/donor-pulse?charity=demo-pantry-a");
    expect(call?.init.credentials).toBe("omit");
    expect((call?.init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    await vi.advanceTimersByTimeAsync(6000);
    expect(pulses()).toBe(2);
    expect(peeks()).toBe(0); // rev unchanged
  });
});

describe("visibility and limit", () => {
  it("pauses while hidden and resumes on visible", async () => {
    begin(viewOf());
    await vi.advanceTimersByTimeAsync(6100);
    expect(pulses()).toBe(1);
    setVis("hidden");
    await vi.advanceTimersByTimeAsync(60000);
    expect(pulses()).toBe(1);
    setVis("visible");
    await vi.advanceTimersByTimeAsync(10);
    expect(pulses()).toBe(2); // catches up right away
    await vi.advanceTimersByTimeAsync(6100);
    expect(pulses()).toBe(3);
  });
  it("stops for good after 10 minutes and removes data-impact-live", async () => {
    begin(viewOf());
    await vi.advanceTimersByTimeAsync(LIVE_MAX_MS + 1);
    expect(document.documentElement.hasAttribute("data-impact-live")).toBe(false);
    const n = pulses();
    expect(n).toBeGreaterThan(50);
    await vi.advanceTimersByTimeAsync(60000);
    expect(pulses()).toBe(n);
    setVis("hidden");
    setVis("visible");
    await vi.advanceTimersByTimeAsync(60000);
    expect(pulses()).toBe(n);
  });
  it("returned stop function works", async () => {
    const stop = begin(viewOf());
    stop();
    await vi.advanceTimersByTimeAsync(20000);
    expect(pulses()).toBe(0);
    expect(document.documentElement.hasAttribute("data-impact-live")).toBe(false);
  });
});

describe("pulse handling", () => {
  it("recognized:false forgets the token and stops", async () => {
    routes.pulse = { recognized: false };
    begin(viewOf());
    await vi.advanceTimersByTimeAsync(6100);
    expect(forgotten).toBe(1);
    expect(document.documentElement.hasAttribute("data-impact-live")).toBe(false);
    await vi.advanceTimersByTimeAsync(30000);
    expect(pulses()).toBe(1);
  });
  it("retry and network errors keep polling silently", async () => {
    routes.pulse = { retry: true };
    begin(viewOf());
    await vi.advanceTimersByTimeAsync(6100);
    routes.pulse = new Error("offline");
    await vi.advanceTimersByTimeAsync(6000);
    await vi.advanceTimersByTimeAsync(6000);
    expect(pulses()).toBe(3);
    expect(forgotten).toBe(0);
    expect(document.documentElement.hasAttribute("data-impact-live")).toBe(true);
    expect(peeks()).toBe(0);
  });
});

describe("repaint", () => {
  it("changed rev: one peek fetch, repaint, new record flagged once, no duplicates", async () => {
    const first = viewOf({ records: [{ logId: "a", count: 80, unit: "meals", dateLabel: "Oct 20" }] });
    paintFirst(first);
    begin(first);
    expect(document.querySelectorAll("[data-ct-id]").length).toBe(1);
    routes.pulse = { rev: "r2" };
    routes.view = apiBody({
      rev: "r2",
      records: [
        { logId: "b", count: 1, unit: "volunteer shifts", dateLabel: "Oct 24", note: null },
        { logId: "a", count: 80, unit: "meals", dateLabel: "Oct 20", note: null },
      ],
    });
    await vi.advanceTimersByTimeAsync(6100);
    expect(peeks()).toBe(1);
    const peek = calls.find((c) => c.url.indexOf("/donor-view") !== -1);
    expect(peek?.url).toBe(API + "/donor-view?charity=demo-pantry-a&peek=1");
    const items = Array.from(document.querySelectorAll("[data-impact-region=hero] [data-ct-id]"));
    expect(items.map((e) => e.getAttribute("data-ct-id"))).toEqual(["b", "a"]);
    expect(document.querySelectorAll("[data-ct-new]").length).toBe(1);
    expect(items[0]?.hasAttribute("data-ct-new")).toBe(true);
    expect(document.querySelectorAll("[data-impact-region=hero] p").length).toBe(2); // story + estimate, once each

    // Same rev again: nothing at all.
    await vi.advanceTimersByTimeAsync(6100);
    expect(peeks()).toBe(1);
    // A later rev with the same records (e.g. Claude's story landed): repainted without duplicates; the
    // arrived record keeps its "Just logged" flag as "seen", so it does not animate again.
    routes.pulse = { rev: "r3" };
    routes.view = apiBody({
      rev: "r3",
      records: [
        { logId: "b", count: 1, unit: "volunteer shifts", dateLabel: "Oct 24", note: null },
        { logId: "a", count: 80, unit: "meals", dateLabel: "Oct 20", note: null },
      ],
    });
    await vi.advanceTimersByTimeAsync(6100);
    expect(peeks()).toBe(2);
    expect(document.querySelectorAll("[data-impact-region=hero] [data-ct-id]").length).toBe(2);
    expect(document.querySelectorAll("[data-ct-new]").length).toBe(1);
    expect(document.querySelector('[data-ct-id="b"]')?.getAttribute("data-ct-new")).toBe("seen");
    expect(document.querySelectorAll('[data-ct-new=""]').length).toBe(0);
  });

  it("a region that was default and now matches is painted for the first time", async () => {
    const first = viewOf();
    paintFirst(first);
    const recent = document.querySelector("[data-impact-region=recent]") as HTMLElement;
    expect(recent.innerHTML).toBe("<p>No news</p>");
    begin(first);
    routes.pulse = { rev: "r2" };
    routes.view = apiBody({
      rev: "r2",
      sinceLastVisit: {
        sinceDateLabel: "Oct 22",
        records: [{ logId: "n1", count: 40, unit: "meals", dateLabel: "Oct 24", note: null }],
        estimates: [],
      },
    });
    await vi.advanceTimersByTimeAsync(6100);
    expect(recent.getAttribute("data-impact-state")).toBe("ready");
    expect(recent.querySelectorAll("li").length).toBe(1);
    expect(recent.querySelector("li")?.hasAttribute("data-ct-new")).toBe(true);
  });

  it("announces via a layer-owned polite status element (textContent only)", async () => {
    const first = viewOf();
    paintFirst(first);
    begin(first);
    const sr = document.querySelector('.ct-sr[role="status"]') as HTMLElement;
    expect(sr.getAttribute("aria-live")).toBe("polite");
    expect(sr.textContent).toBe("");
    routes.pulse = { rev: "r2" };
    routes.view = apiBody({
      rev: "r2",
      records: [
        { logId: "z", count: 80, unit: "meals", dateLabel: "Oct 24", note: "<img src=x onerror=alert(1)>" },
        { logId: "a", count: 80, unit: "meals", dateLabel: "Oct 20", note: null },
      ],
    });
    await vi.advanceTimersByTimeAsync(6100);
    expect(sr.textContent).toBe("Just logged: 80 meals.");
    expect(document.querySelectorAll(".ct-sr").length).toBe(1);
    expect(document.querySelector("img")).toBeNull();
  });

  it("dispatches chartitable:update with only state and variants", async () => {
    const first = viewOf();
    paintFirst(first);
    begin(first);
    const events: CustomEvent[] = [];
    document.addEventListener("chartitable:update", (e) => events.push(e as CustomEvent));
    routes.pulse = { rev: "r2" };
    routes.view = apiBody({ rev: "r2", donor: { state: "news", traits: [], gifts: [], giftCount: 1 } });
    await vi.advanceTimersByTimeAsync(6100);
    expect(events.length).toBe(1);
    const detail = events[0]?.detail as Record<string, unknown>;
    expect(Object.keys(detail).sort()).toEqual(["state", "variants"]);
    expect(detail.state).toBe("news");
    expect(document.documentElement.getAttribute("data-impact-donor")).toBe("news");
  });

  it("recognized:false from the peek view forgets and stops", async () => {
    const first = viewOf();
    paintFirst(first);
    begin(first);
    routes.pulse = { rev: "r2" };
    routes.view = { recognized: false };
    await vi.advanceTimersByTimeAsync(6100);
    expect(forgotten).toBe(1);
    expect(document.documentElement.hasAttribute("data-impact-live")).toBe(false);
  });
});

describe("story upgrade rule", () => {
  const hero = (): HTMLElement => document.querySelector("[data-impact-region=hero]") as HTMLElement;
  const upgraded = (extra: Record<string, unknown> = {}): Record<string, unknown> =>
    apiBody(
      {
        rev: "r2",
        records: [
          { logId: "b", count: 5, unit: "meals", dateLabel: "Oct 24", note: null },
          { logId: "a", count: 80, unit: "meals", dateLabel: "Oct 20", note: null },
        ],
        ...extra,
      },
      "A warmer story from Claude.",
    );

  async function run(opts: { offscreen: boolean; age: number }, body: Record<string, unknown>): Promise<void> {
    const first = viewOf();
    paintFirst(first);
    vi.spyOn(performance, "now").mockReturnValue(opts.age);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: opts.offscreen ? 5000 : 10, bottom: opts.offscreen ? 5100 : 90 } as DOMRect);
    begin(first);
    routes.pulse = { rev: "r2" };
    routes.view = body;
    await vi.advanceTimersByTimeAsync(6100);
  }

  it("on-screen and past 3 s: the story text is held, but new records still arrive", async () => {
    await run({ offscreen: false, age: 20000 }, upgraded());
    expect(hero().querySelector("p")?.textContent).toBe("Thanks, Ada.");
    expect(hero().querySelectorAll("li").length).toBe(2);
    expect(hero().querySelectorAll("li[data-ct-new]").length).toBe(1);
  });
  it("on-screen, text unchanged: the region still updates", async () => {
    await run({ offscreen: false, age: 20000 }, apiBody({ rev: "r2", records: [{ logId: "b", count: 5, unit: "meals", dateLabel: "Oct 24" }, NO_REC] }));
    expect(hero().querySelectorAll("li").length).toBe(2);
  });
  it("off-screen: story updates", async () => {
    await run({ offscreen: true, age: 20000 }, upgraded());
    expect(hero().querySelector("p")?.textContent).toBe("A warmer story from Claude.");
  });
  it("page younger than 3 s: story updates", async () => {
    await run({ offscreen: false, age: 1000 }, upgraded());
    expect(hero().querySelector("p")?.textContent).toBe("A warmer story from Claude.");
  });
  it("held text does not slip through on the next poll", async () => {
    await run({ offscreen: false, age: 20000 }, upgraded());
    routes.pulse = { rev: "r3" };
    routes.view = upgraded({ rev: "r3" });
    await vi.advanceTimersByTimeAsync(6100);
    expect(hero().querySelector("p")?.textContent).toBe("Thanks, Ada.");
  });
});
