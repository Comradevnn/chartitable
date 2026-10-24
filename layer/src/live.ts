// Live updates (T28, plan 3.4). After a recognized paint the layer polls a cheap pulse endpoint, only
// while the tab is visible and for at most LIVE_MAX_MS. A changed rev fetches the full view with peek=1
// (no visit row, so "since your last visit" stays anchored) and repaints regions only.
import { enhance } from "./motion";
import { paintRegions, setHooks } from "./regions";
import { unitFor } from "./safe";
import { parseView, type RecordFact, type View } from "./view";

export const LIVE_MAX_MS = 600000;

export interface LiveOptions {
  view: View; // the view that was just painted
  api: string;
  charity: string;
  token: () => string | null;
  forget: () => void; // pulse said recognized:false: drop the stored token
  donateHref: string;
  variants?: Record<string, string>; // region variants of the first paint, kept current for chartitable:update
}

export function startLive(o: LiveOptions): (() => void) | null {
  const pollMs = o.view.pollMs;
  if (!pollMs || !o.view.rev || !o.api) return null;
  const q = o.api.replace(/\/+$/, "") + "/%?charity=" + encodeURIComponent(o.charity);
  const doc = document;
  const root = doc.documentElement;
  // One layer-owned, visually hidden live region. Only created for recognized donors.
  const status = doc.createElement("div");
  status.className = "ct-sr";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden";
  doc.body.appendChild(status);
  const offscreen = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    return r.bottom < 0 || r.top > window.innerHeight;
  };

  const variants = { ...o.variants };
  let current = o.view;
  const arrived: string[] = [];
  let lastRev: string | null = o.view.rev;
  let stopped = false;
  let busy = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stop = (): void => {
    stopped = true;
    clearTimeout(timer);
    clearTimeout(limit);
    doc.removeEventListener("visibilitychange", wake);
    root.removeAttribute("data-impact-live");
  };

  // One cycle: poll (visible tabs only), then schedule the next. Hidden tabs just stop scheduling;
  // wake() starts a cycle again as soon as the tab is visible.
  const tick = async (): Promise<void> => {
    clearTimeout(timer);
    if (stopped || busy || doc.visibilityState !== "visible") return;
    busy = true;
    try {
      await poll();
    } catch {
      /* Keep going silently. */
    }
    busy = false;
    if (!stopped && doc.visibilityState === "visible") timer = setTimeout(tick, pollMs);
  };
  function wake(): void {
    void tick();
  }

  const poll = async (): Promise<void> => {
    const token = o.token();
    const pulse = (token && (await getJson(q.replace("%", "donor-pulse"), token))) as { retry?: unknown; recognized?: unknown; rev?: unknown } | null;
    if (stopped) return;
    if (!token || (pulse && pulse.recognized === false)) {
      if (token) o.forget();
      return stop();
    }
    if (!pulse || pulse.retry === true || typeof pulse.rev !== "string" || pulse.rev === lastRev) return;
    const next = parseView(await getJson(q.replace("%", "donor-view") + "&peek=1", token));
    if (stopped) return;
    if (next === false) {
      o.forget();
      return stop();
    }
    if (!next) return; // retry next tick
    lastRev = next.rev || pulse.rev;
    apply(next);
  };

  const apply = (next: View): void => {
    // Records not in the previous view (each logId once).
    const known = recordsOf(current).map((r) => r.logId);
    const added: RecordFact[] = [];
    for (const r of recordsOf(next)) {
      if (known.indexOf(r.logId) < 0) {
        known.push(r.logId);
        added.push(r);
      }
    }
    current = next;
    const result = paintRegions(doc, next, o.donateHref, { offscreen, ageMs: performance.now() });
    // Repainted regions are rebuilt from scratch, so nothing is ever duplicated. Records that arrived
    // during this page view keep data-ct-new on later repaints (a story upgrade must not wipe the
    // "Just logged" tag); only this repaint's arrivals get "" and therefore the arrival animation.
    for (const r of added) arrived.push(r.logId);
    for (const region of result.painted) {
      for (const el of Array.from(region.querySelectorAll("[data-ct-id]"))) {
        const id = el.getAttribute("data-ct-id") || "";
        if (arrived.indexOf(id) >= 0) el.setAttribute("data-ct-new", added.some((r) => r.logId === id) ? "" : "seen");
      }
    }
    enhance(result.painted.filter((r) => result.fresh.indexOf(r) < 0), "update");
    enhance(result.fresh, "first");
    setHooks(doc, next);
    if (added.length) {
      status.textContent = "Just logged: " + added.map((r) => r.count + " " + unitFor(r.count, r.unit)).join(" and ") + ".";
    }
    Object.assign(variants, result.variants);
    doc.dispatchEvent(new CustomEvent("chartitable:update", { detail: { state: next.donor ? next.donor.state : null, variants } }));
  };

  const limit = setTimeout(stop, LIVE_MAX_MS);
  root.setAttribute("data-impact-live", "");
  doc.addEventListener("visibilitychange", wake);
  timer = setTimeout(tick, pollMs);
  return stop;
}

function recordsOf(view: View): RecordFact[] {
  return view.since ? view.records.concat(view.since.records) : view.records;
}

async function getJson(url: string, token: string): Promise<unknown> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: "Bearer " + token },
      credentials: "omit",
      signal: AbortSignal.timeout(4000),
    });
    return await res.json();
  } catch {
    return undefined;
  }
}

