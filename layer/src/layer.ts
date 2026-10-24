// Chartitable embed (T8). One classic script tag. Empty slots stay empty
// unless this browser is holding a donor token for this charity.
import SLOT_STYLES from "../../docs/design/ct-slots.css";
import { startLive } from "./live";
import { enhance, swap } from "./motion";
import { announceReady, donateHrefFor, donateHrefWithToken, paintRegions, rewriteDonate, setHooks } from "./regions";
import { safeUrl, unitFor } from "./safe";
import { parseView, type EstimateFact, type NextFact, type PhotoFact, type RecordFact, type SinceFact, type View } from "./view";

declare const CT_API_BASE: string;
declare const CT_DONATE_URL: string;

const API_BASE = CT_API_BASE;
const DONATE_URL = CT_DONATE_URL;

const KNOWN = ["demo-pantry-a", "demo-pantry-b"];
const TIMEOUT_MS = 4000;
const memory = new Map<string, string>();
let donateHref = "";
let announced = false;
let liveStarted = false;

if (API_BASE || DONATE_URL) {
  const scriptAtLoad = document.currentScript;
  const boot = (): void => {
    start(scriptAtLoad);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}

function start(script: HTMLOrSVGScriptElement | null): void {
  const fromUrl = takeUrlToken();
  const charityId = script ? script.getAttribute("data-charity") : null;
  if (charityId && fromUrl && KNOWN.indexOf(charityId) !== -1) remember(charityId, fromUrl);
  // An empty `?ct=` means "not me": drop any token this browser holds (shared screens, demo strangers).
  if (charityId && fromUrl === "" && KNOWN.indexOf(charityId) !== -1) forget(charityId);
  if (!script || !charityId || KNOWN.indexOf(charityId) === -1) return;
  if (!document.querySelector("[data-impact-slot],[data-impact-region]")) return;

  donateHref = donateHrefFor(DONATE_URL, charityId);
  rewriteDonate(document, donateHref);

  const token = fromUrl || recall(charityId);
  if (!token || !API_BASE) return;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const url = API_BASE.replace(/\/+$/, "") + "/donor-view?charity=" + encodeURIComponent(charityId);
  fetch(url, {
    method: "GET",
    headers: { Authorization: "Bearer " + token },
    credentials: "omit",
    signal: ctrl.signal,
  })
    .then((res) => res.json())
    .then((data: unknown) => {
      if (data && typeof data === "object" && (data as { retry?: unknown }).retry === true) return;
      const view = parseView(data);
      if (view === false) {
        forget(charityId);
        return;
      }
      if (!view) return;
      donateHref = donateHrefWithToken(donateHref, token);
      rewriteDonate(document, donateHref);
      paint(view, charityId, token);
    })
    .catch(() => {
      /* Network, timeout, or bad JSON: leave the page alone. */
    })
    .finally(() => clearTimeout(timer));
}

/** The `ct` param (removed from the address bar): null = absent, "" = present but empty. */
function takeUrlToken(): string | null {
  let url: URL;
  try {
    url = new URL(window.location.href);
  } catch {
    return null;
  }
  if (!url.searchParams.has("ct")) return null;
  const raw = url.searchParams.get("ct");
  url.searchParams.delete("ct");
  try {
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  } catch {
    /* Sandboxed documents can refuse replaceState. The token still works. */
  }
  return raw ? raw.trim() : "";
}

function storageKey(charityId: string): string {
  return "chartitable:" + charityId;
}

function remember(charityId: string, token: string): void {
  memory.set(charityId, token);
  try {
    localStorage.setItem(storageKey(charityId), token);
  } catch {
    /* Private mode: the in-memory copy lasts for this page. */
  }
}

function recall(charityId: string): string | null {
  try {
    const stored = localStorage.getItem(storageKey(charityId));
    if (stored) return stored;
  } catch {
    /* Fall through to the in-memory copy. */
  }
  return memory.get(charityId) ?? null;
}

function forget(charityId: string): void {
  memory.delete(charityId);
  try {
    localStorage.removeItem(storageKey(charityId));
  } catch {
    /* Already gone from memory. */
  }
}

function paint(view: View, charityId: string, token: string): void {
  const heroSlot = document.querySelector('[data-impact-slot="hero"]');
  const sinceSlot = document.querySelector('[data-impact-slot="since-last-visit"]');
  const nextSlot = document.querySelector('[data-impact-slot="next-step"]');
  const hero = buildHero(view);
  const since = view.since && (view.since.records.length || view.since.estimates.length) ? buildSince(view.since, view.photos) : null;
  const next = view.next ? buildNext(view.next) : null;
  const finish = (variants: Record<string, string>): void => {
    setHooks(document, view);
    if (announced) return;
    announced = true;
    announceReady(document, view, variants);
  };
  // Regions are in the DOM in this same task (no View Transition) or in the transition's callback, and
  // the hooks follow in the same step, so host CSS re-composes with no frame gap and in background tabs.
  if (document.querySelector("[data-impact-region]")) {
    swap(document, () => {
      const regions = paintRegions(document, view, donateHref);
      if (!regions.count) return;
      finish(regions.variants);
      enhance(regions.painted, "first");
      if (!liveStarted) {
        liveStarted = true;
        startLive({ view, api: API_BASE, charity: charityId, token: () => token, forget: () => forget(charityId), donateHref, variants: regions.variants });
      }
    });
  }
  // No v1 slots on the page: skip the slot styles, which would also match v2 items' ct-* classes.
  if ((!hero && !since && !next) || (!heroSlot && !sinceSlot && !nextSlot)) return;

  requestAnimationFrame(() => {
    injectStyles();
    let filled = false;
    if (hero && heroSlot instanceof HTMLElement && heroSlot.getAttribute("data-impact-state") !== "ready") {
      heroSlot.appendChild(hero);
      mark(heroSlot, "Your impact");
      filled = true;
    }
    if (since && sinceSlot instanceof HTMLElement && sinceSlot.getAttribute("data-impact-state") !== "ready") {
      sinceSlot.appendChild(since);
      mark(sinceSlot, "Since your last visit");
      filled = true;
    }
    if (next && nextSlot instanceof HTMLElement && nextSlot.getAttribute("data-impact-state") !== "ready") {
      nextSlot.appendChild(next);
      mark(nextSlot, "A next step");
      filled = true;
    }
    if (filled) finish({});
  });
}

function mark(slot: HTMLElement, label: string): void {
  slot.setAttribute("data-impact-state", "ready");
  slot.setAttribute("role", "region");
  slot.setAttribute("aria-label", label);
}

function injectStyles(): void {
  if (document.head.querySelector("style[data-ct-layer-style]")) return;
  const style = document.createElement("style");
  style.setAttribute("data-ct-layer-style", "");
  style.textContent = SLOT_STYLES;
  document.head.appendChild(style);
}

function buildHero(view: View): DocumentFragment | null {
  const frag = document.createDocumentFragment();
  let any = false;
  if (view.story) {
    frag.appendChild(paragraph("ct-story", view.story));
    any = true;
  }
  if (appendFacts(frag, view.records, view.estimates, view.photos)) any = true;
  return any ? frag : null;
}

function buildSince(since: SinceFact, photos: PhotoFact[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  const heading = document.createElement("h2");
  heading.className = "ct-since-heading";
  heading.textContent = "Since your last visit (" + since.sinceDateLabel + ")";
  frag.appendChild(heading);
  appendFacts(frag, since.records, since.estimates, photos);
  return frag;
}

function buildNext(next: NextFact): DocumentFragment {
  const frag = document.createDocumentFragment();
  frag.appendChild(paragraph("ct-next", next.text));
  const href = next.href ? safeUrl(next.href) : null;
  if (href) {
    const link = document.createElement("a");
    link.className = "ct-next-link";
    link.href = href;
    if (/^https?:/i.test(href)) link.rel = "noopener";
    link.textContent = "See how to help";
    frag.appendChild(link);
  }
  return frag;
}

function appendFacts(parent: Node, records: RecordFact[], estimates: EstimateFact[], photos: PhotoFact[]): boolean {
  let any = false;
  if (records.length) {
    parent.appendChild(heading("Logged by the pantry"));
    const list = document.createElement("ul");
    list.className = "ct-facts";
    for (const record of records) {
      const item = document.createElement("li");
      item.className = "ct-record";
      item.appendChild(document.createTextNode(record.dateLabel + " · " + record.count + " " + unitFor(record.count, record.unit)));
      if (record.note) {
        item.appendChild(document.createTextNode(" "));
        const note = document.createElement("span");
        note.className = "ct-note";
        note.textContent = record.note;
        item.appendChild(note);
      }
      for (const photo of photos) {
        if (photo.logId !== record.logId) continue;
        const src = safeUrl(photo.url);
        if (!src) continue;
        const img = document.createElement("img");
        img.className = "ct-photo";
        img.alt = record.note || record.unit;
        img.loading = "lazy";
        img.src = src;
        item.appendChild(img);
      }
      list.appendChild(item);
    }
    parent.appendChild(list);
    any = true;
  }
  if (estimates.length) {
    parent.appendChild(heading("Your share (estimate)"));
    const list = document.createElement("ul");
    list.className = "ct-facts";
    for (const estimate of estimates) {
      const item = document.createElement("li");
      item.className = "ct-estimate";
      item.textContent =
        "about " + estimate.approxQuantity + " " + unitFor(estimate.approxQuantity, estimate.unit) + " (estimate)";
      list.appendChild(item);
    }
    parent.appendChild(list);
    parent.appendChild(paragraph("ct-disclaimer", "Estimates are your proportional share of pooled gifts, not traced dollars."));
    any = true;
  }
  return any;
}

function heading(value: string): HTMLElement {
  const node = document.createElement("h2");
  node.className = "ct-heading";
  node.textContent = value;
  return node;
}

function paragraph(className: string, value: string): HTMLElement {
  const node = document.createElement("p");
  node.className = className;
  node.textContent = value;
  return node;
}
