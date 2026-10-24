// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enhance, swap } from "../src/motion";
import { paintRegions } from "../src/regions";
import { parseView, type View } from "../src/view";

function viewOf(): View {
  const v = parseView({
    recognized: true,
    hero: { firstName: "Ada", story: "Thanks.", headline: null, body: null },
    records: [{ logId: "a", count: 1234, unit: "meals", dateLabel: "Oct 20", note: null }],
    estimates: [{ unit: "meals", approxQuantity: 26 }],
    photos: [],
    donor: { state: "first_impact", traits: [], gifts: [], giftCount: 1 },
  });
  if (!v) throw new Error("view");
  return v;
}

const PAGE = `
<div data-impact-region="hero"><h1>Default</h1></div>
<template data-impact-for="hero">
  <section data-ct-animate="reveal"><p data-ct-text="story"></p></section>
  <ul><li data-ct-each="records"><b data-ct-animate="count" data-ct-text="count"></b> <i data-ct-text="unit"></i><span class="ct-new-tag">Just logged</span></li></ul>
  <div data-ct-animate="draw"><p>Your share, an estimate</p>
    <ul><li data-ct-each="estimates"><b data-ct-animate="count" data-ct-text="estimate"></b></li></ul></div>
</template>`;

class FakeIO {
  static instances: FakeIO[] = [];
  seen = new Set<Element>();
  constructor(private cb: (entries: Array<{ isIntersecting: boolean; target: Element }>) => void) {
    FakeIO.instances.push(this);
  }
  observe(el: Element): void {
    this.seen.add(el);
  }
  disconnect(): void {
    this.seen.clear();
  }
  show(el: Element): void {
    this.cb([{ isIntersecting: true, target: el }]);
  }
}
const showAll = (): void => {
  for (const io of FakeIO.instances) for (const el of Array.from(io.seen)) io.show(el);
};

let reduce = false;
let vis = "visible";

function paint(): HTMLElement {
  const res = paintRegions(document, viewOf(), "");
  const region = res.painted[0];
  if (!region) throw new Error("not painted");
  return region;
}

beforeEach(() => {
  vi.useFakeTimers();
  document.head.innerHTML = "";
  document.body.innerHTML = PAGE;
  document.documentElement.removeAttribute("data-ct-vt");
  document.documentElement.removeAttribute("data-ct-fade");
  reduce = false;
  vis = "visible";
  FakeIO.instances = [];
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => vis });
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.indexOf("reduce") !== -1 && reduce }));
  vi.stubGlobal("IntersectionObserver", FakeIO);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
});

describe("motion.css", () => {
  it("keeps every rule inside the no-preference media query", () => {
    const css = readFileSync(join(process.cwd(), "layer/src/motion.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css.trim().startsWith("@media (prefers-reduced-motion:no-preference){")).toBe(true);
    expect(css.trim().endsWith("}")).toBe(true);
    // One top-level block only: brace depth returns to zero exactly once, at the end.
    let depth = 0;
    let closes = 0;
    for (const ch of css) {
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) closes++;
      }
    }
    expect(closes).toBe(1);
    expect(css).not.toContain("infinite");
    // Keyframes only ever touch opacity and transform.
    for (const body of css.match(/@keyframes [\w-]+ \{(?:[^{}]|\{[^{}]*\})*\}/g) || []) {
      const props = (body.match(/[\w-]+(?=\s*:)/g) || []).filter((p) => p !== "from" && p !== "to");
      for (const prop of props) expect(["opacity", "transform"]).toContain(prop);
    }
  });
});

describe("recognition swap", () => {
  it("motion allowed + View Transitions: wraps the update, injects style, pins and releases min-height", () => {
    const region = document.querySelector("[data-impact-region]") as HTMLElement;
    Object.defineProperty(region, "offsetHeight", { configurable: true, value: 240 });
    let inside: string | null = null;
    const vt = vi.fn((cb: () => void) => {
      inside = region.style.minHeight;
      cb();
      return { finished: Promise.resolve() };
    });
    (document as unknown as { startViewTransition: unknown }).startViewTransition = vt;
    const update = vi.fn();
    swap(document, update);
    expect(vt).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(inside).toBe("240px");
    expect(document.head.querySelector("style[data-ct-motion-style]")).not.toBeNull();
    vi.advanceTimersByTime(700);
    expect(region.style.minHeight).toBe("");
  });
  it("no startViewTransition: plain swap with a short fade flag", () => {
    const update = vi.fn();
    swap(document, update);
    expect(update).toHaveBeenCalledTimes(1);
    expect(document.documentElement.hasAttribute("data-ct-fade")).toBe(true);
    vi.advanceTimersByTime(700);
    expect(document.documentElement.hasAttribute("data-ct-fade")).toBe(false);
  });
  it("reduced motion: no transition, no style, plain update", () => {
    reduce = true;
    const vt = vi.fn();
    (document as unknown as { startViewTransition: unknown }).startViewTransition = vt;
    const update = vi.fn();
    swap(document, update);
    expect(update).toHaveBeenCalledTimes(1);
    expect(vt).not.toHaveBeenCalled();
    expect(document.head.querySelector("style")).toBeNull();
    expect(document.documentElement.hasAttribute("data-ct-fade")).toBe(false);
  });
  it("stalled View Transition (tab not rendering): the swap still runs once, via the fallback timer", () => {
    let held: (() => void) | null = null;
    const vt = vi.fn((cb: () => void) => {
      held = cb; // never called by the browser
      return { finished: new Promise(() => {}) };
    });
    (document as unknown as { startViewTransition: unknown }).startViewTransition = vt;
    const update = vi.fn();
    swap(document, update);
    expect(update).not.toHaveBeenCalled();
    vi.advanceTimersByTime(450);
    expect(update).toHaveBeenCalledTimes(1);
    held!(); // a late callback must not run the swap twice
    expect(update).toHaveBeenCalledTimes(1);
  });
  it("throwing View Transition: the swap still runs once", () => {
    (document as unknown as { startViewTransition: unknown }).startViewTransition = () => {
      throw new Error("InvalidStateError");
    };
    const update = vi.fn();
    swap(document, update);
    vi.advanceTimersByTime(450);
    expect(update).toHaveBeenCalledTimes(1);
  });
  it("hidden tab: no motion either", () => {
    vis = "hidden";
    const vt = vi.fn();
    (document as unknown as { startViewTransition: unknown }).startViewTransition = vt;
    swap(document, () => {});
    expect(vt).not.toHaveBeenCalled();
  });
});

describe("enhance", () => {
  it("count: final text stays in the DOM, aria-hidden overlay counts 0 to N in at most 30 steps", () => {
    const region = paint();
    enhance([region], "first");
    const count = region.querySelector("li b") as HTMLElement;
    expect(count.querySelector(".ct-count-real")?.textContent).toBe("1234");
    const overlay = count.querySelector(".ct-count-ov") as HTMLElement;
    expect(overlay.getAttribute("aria-hidden")).toBe("true");
    expect(overlay.textContent).toBe("0");
    showAll();
    const seen: string[] = [];
    for (let i = 0; i < 40; i++) {
      vi.advanceTimersByTime(24);
      seen.push(overlay.textContent || "");
    }
    expect(seen[0]).not.toBe("1,234"); // starts low, not at the final value
    expect(count.querySelector(".ct-count-ov")).toBeNull(); // finished and cleaned up
    expect(count.textContent).toBe("1234");
    expect(count.classList.contains("ct-count")).toBe(false);
  });
  it("count steps are capped and end exactly on the target", () => {
    const region = paint();
    enhance([region], "first");
    const count = region.querySelector("li b") as HTMLElement;
    const overlay = count.querySelector(".ct-count-ov") as HTMLElement;
    showAll();
    const values = new Set<string>();
    for (let i = 0; i < 800; i += 5) {
      vi.advanceTimersByTime(5);
      values.add(overlay.textContent || "");
    }
    expect(values.size).toBeLessThanOrEqual(31);
    expect(count.textContent).toBe("1234");
  });
  it("count is ignored inside estimate items, which never count up", () => {
    const region = paint();
    enhance([region], "first");
    const est = region.querySelector(".ct-estimate b") as HTMLElement;
    expect(est.querySelector(".ct-count-ov")).toBeNull();
    expect(est.textContent).toBe("about 26 meals");
  });
  it("draw and reveal wait for the viewport, then switch from ct-pre to ct-in", () => {
    const region = paint();
    enhance([region], "first");
    const draw = region.querySelector('[data-ct-animate="draw"]') as HTMLElement;
    const reveal = region.querySelector('[data-ct-animate="reveal"]') as HTMLElement;
    expect(draw.classList.contains("ct-pre")).toBe(true);
    expect(reveal.classList.contains("ct-pre")).toBe(true);
    showAll();
    expect(draw.classList.contains("ct-pre")).toBe(false);
    expect(draw.classList.contains("ct-in")).toBe(true);
    expect(reveal.classList.contains("ct-in")).toBe(true);
    expect(draw.textContent).toContain("about 26 meals"); // content never removed
  });
  it("update mode: only new records count, nothing is hidden again", () => {
    const region = paint();
    enhance([region], "update");
    expect(region.querySelector(".ct-count-ov")).toBeNull();
    expect(region.querySelector(".ct-pre[data-ct-animate=reveal]")).toBeNull();
    region.querySelector("li")?.setAttribute("data-ct-new", "");
    enhance([region], "update");
    expect(region.querySelector("li .ct-count-ov")).not.toBeNull();
  });
  it("reduced motion: nothing is touched, final text is shown", () => {
    reduce = true;
    const region = paint();
    region.querySelector("li")?.setAttribute("data-ct-new", "");
    const before = region.innerHTML;
    enhance([region], "first");
    expect(region.innerHTML).toBe(before);
    expect(region.querySelector(".ct-count-ov")).toBeNull();
    expect(region.querySelector("li b")?.textContent).toBe("1234");
    expect(document.head.querySelector("style")).toBeNull();
  });
  it("no IntersectionObserver: final values immediately, no overlay or hidden pre-state", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const region = paint();
    const before = region.innerHTML;
    enhance([region], "first");
    expect(region.innerHTML).toBe(before);
  });
  it("nothing to enhance injects nothing (strangers never reach here)", () => {
    enhance([], "first");
    expect(document.head.querySelector("style")).toBeNull();
  });
  it("arrive adds the animation class to new items", () => {
    const region = paint();
    const li = region.querySelector("li") as HTMLElement;
    li.setAttribute("data-ct-new", "");
    enhance([region], "update");
    expect(li.classList.contains("ct-arrive")).toBe(true);
    expect(document.head.querySelector("style[data-ct-motion-style]")).not.toBeNull();
  });
});
