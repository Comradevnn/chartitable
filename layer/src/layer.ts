// Chartitable embed (T8). One classic script tag. Empty slots stay empty
// unless this browser is holding a donor token for this charity.
import SLOT_STYLES from "../../docs/design/ct-slots.css";

declare const CT_API_BASE: string;
declare const CT_DONATE_URL: string;

const API_BASE = CT_API_BASE;
const DONATE_URL = CT_DONATE_URL;

const KNOWN = ["demo-pantry-a", "demo-pantry-b"];
const TIMEOUT_MS = 4000;
const memory = new Map<string, string>();

interface RecordFact {
  logId: string;
  count: number;
  unit: string;
  dateLabel: string;
  note: string | null;
}

interface EstimateFact {
  unit: string;
  approxQuantity: number;
}

interface PhotoFact {
  logId: string;
  url: string;
}

interface SinceFact {
  sinceDateLabel: string;
  records: RecordFact[];
  estimates: EstimateFact[];
}

interface NextFact {
  text: string;
  href: string | null;
}

interface View {
  recognized: true;
  firstName: string | null;
  story: string;
  since: SinceFact | null;
  next: NextFact | null;
  records: RecordFact[];
  estimates: EstimateFact[];
  photos: PhotoFact[];
}

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
  if (charityId && fromUrl) remember(charityId, fromUrl);
  if (!script || !charityId || KNOWN.indexOf(charityId) === -1) return;
  if (!document.querySelector("[data-impact-slot],[data-impact-region]")) return;

  rewriteDonate(charityId);

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
      paint(view);
    })
    .catch(() => {
      /* Network, timeout, or bad JSON: leave the page alone. */
    })
    .finally(() => clearTimeout(timer));
}

function rewriteDonate(charityId: string): void {
  if (!DONATE_URL) return;
  const join = DONATE_URL.indexOf("?") === -1 ? "?" : "&";
  const href = DONATE_URL + join + "charity=" + encodeURIComponent(charityId);
  const nodes = document.querySelectorAll("[data-impact-donate]");
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes.item(i);
    if (node instanceof HTMLAnchorElement) node.href = href;
  }
}

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
  if (!raw) return null;
  const token = raw.trim();
  return token ? token : null;
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

function parseView(data: unknown): View | false | null {
  if (!data || typeof data !== "object") return null;
  const body = data as Record<string, unknown>;
  if (body.recognized === false) return false;
  if (body.recognized !== true) return null;
  const hero = body.hero;
  if (!hero || typeof hero !== "object") return null;
  const story = (hero as Record<string, unknown>).story;
  if (typeof story !== "string") return null;
  const rawName = (hero as Record<string, unknown>).firstName;
  const firstName = typeof rawName === "string" && rawName.trim() ? rawName.trim() : null;
  if (!Array.isArray(body.records) || !Array.isArray(body.estimates) || !Array.isArray(body.photos)) return null;

  let since: SinceFact | null = null;
  if (body.sinceLastVisit != null) {
    if (typeof body.sinceLastVisit !== "object") return null;
    const raw = body.sinceLastVisit as Record<string, unknown>;
    if (typeof raw.sinceDateLabel !== "string" || !Array.isArray(raw.records) || !Array.isArray(raw.estimates)) {
      return null;
    }
    since = {
      sinceDateLabel: raw.sinceDateLabel,
      records: asRecords(raw.records),
      estimates: asEstimates(raw.estimates),
    };
  }

  let next: NextFact | null = null;
  if (body.nextStep && typeof body.nextStep === "object") {
    const raw = body.nextStep as Record<string, unknown>;
    if (typeof raw.text === "string" && raw.text.trim()) {
      next = { text: raw.text, href: typeof raw.href === "string" ? raw.href : null };
    }
  }

  return {
    recognized: true,
    firstName,
    story,
    since,
    next,
    records: asRecords(body.records),
    estimates: asEstimates(body.estimates),
    photos: asPhotos(body.photos),
  };
}

function asRecords(value: unknown[]): RecordFact[] {
  const out: RecordFact[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.logId !== "string" || typeof raw.unit !== "string" || typeof raw.dateLabel !== "string") continue;
    if (typeof raw.count !== "number" || !Number.isFinite(raw.count)) continue;
    out.push({
      logId: raw.logId,
      count: raw.count,
      unit: raw.unit,
      dateLabel: raw.dateLabel,
      note: typeof raw.note === "string" && raw.note ? raw.note : null,
    });
  }
  return out;
}

function asEstimates(value: unknown[]): EstimateFact[] {
  const out: EstimateFact[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.unit !== "string") continue;
    if (typeof raw.approxQuantity !== "number" || !Number.isFinite(raw.approxQuantity)) continue;
    out.push({ unit: raw.unit, approxQuantity: raw.approxQuantity });
  }
  return out;
}

function asPhotos(value: unknown[]): PhotoFact[] {
  const out: PhotoFact[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.logId !== "string" || typeof raw.url !== "string") continue;
    out.push({ logId: raw.logId, url: raw.url });
  }
  return out;
}

function paint(view: View): void {
  const regionsFilled = paintRegions(view);
  if (regionsFilled) document.documentElement.setAttribute("data-impact-active", "");
  const heroSlot = document.querySelector('[data-impact-slot="hero"]');
  const sinceSlot = document.querySelector('[data-impact-slot="since-last-visit"]');
  const nextSlot = document.querySelector('[data-impact-slot="next-step"]');
  const hero = buildHero(view);
  const since = view.since && (view.since.records.length || view.since.estimates.length) ? buildSince(view.since, view.photos) : null;
  const next = view.next ? buildNext(view.next) : null;
  if (!hero && !since && !next) {
    if (regionsFilled) document.documentElement.setAttribute("data-impact-active", "");
    return;
  }

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
    if (filled || regionsFilled) document.documentElement.setAttribute("data-impact-active", "");
  });
}

// Contract v2: host-authored regions. A region keeps the host's default markup for
// strangers. For a recognized donor the layer swaps in the host's own
// <template data-impact-for="<region>"> and fills it with facts via textContent only.
// Estimates can only reach the page through data-ct-text="estimate", which the layer
// always writes as "about N unit", so a template cannot drop the label.
function paintRegions(view: View): boolean {
  let any = false;
  const regions = document.querySelectorAll("[data-impact-region]");
  for (let i = 0; i < regions.length; i++) {
    const region = regions.item(i);
    if (!(region instanceof HTMLElement) || region.getAttribute("data-impact-state") === "ready") continue;
    const name = region.getAttribute("data-impact-region");
    if (!name) continue;
    const requires = region.getAttribute("data-impact-requires");
    if (requires && !hasFacts(view, requires)) continue;
    const tpl = document.querySelector('template[data-impact-for="' + cssEscape(name) + '"]');
    if (!(tpl instanceof HTMLTemplateElement)) continue;
    const frag = tpl.content.cloneNode(true) as DocumentFragment;
    fillNode(frag, view);
    if (!frag.childNodes.length) continue;
    region.replaceChildren(frag);
    region.setAttribute("data-impact-state", "ready");
    any = true;
  }
  return any;
}

function cssEscape(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "");
}

function scalar(view: View, key: string): string | null {
  switch (key) {
    case "firstName":
      return view.firstName;
    case "story":
      return view.story || null;
    case "nextText":
      return view.next ? view.next.text : null;
    case "sinceDate":
      return view.since ? view.since.sinceDateLabel : null;
    default:
      return null;
  }
}

function facts(view: View, key: string): Array<RecordFact | EstimateFact> {
  switch (key) {
    case "records":
      return view.records;
    case "estimates":
      return view.estimates;
    case "sinceRecords":
      return view.since ? view.since.records : [];
    case "sinceEstimates":
      return view.since ? view.since.estimates : [];
    default:
      return [];
  }
}

function hasFacts(view: View, key: string): boolean {
  if (key === "next") return !!view.next;
  if (key === "since") return !!view.since && (view.since.records.length > 0 || view.since.estimates.length > 0);
  if (key === "photos") return view.photos.length > 0;
  const known = facts(view, key);
  if (known.length) return true;
  return scalar(view, key) !== null;
}

function fillNode(root: ParentNode, view: View): void {
  const guarded = root.querySelectorAll("[data-ct-if]");
  for (let i = 0; i < guarded.length; i++) {
    const el = guarded.item(i);
    const key = el.getAttribute("data-ct-if") || "";
    if (!hasFacts(view, key)) el.remove();
  }
  const repeaters = root.querySelectorAll("[data-ct-each]");
  for (let i = 0; i < repeaters.length; i++) {
    const proto = repeaters.item(i);
    if (!(proto instanceof HTMLElement) || !proto.parentNode) continue;
    const key = proto.getAttribute("data-ct-each") || "";
    const items = facts(view, key);
    const limitRaw = parseInt(proto.getAttribute("data-ct-limit") || "", 10);
    const limit = limitRaw > 0 ? limitRaw : items.length;
    for (let n = 0; n < items.length && n < limit; n++) {
      const copy = proto.cloneNode(true) as HTMLElement;
      copy.removeAttribute("data-ct-each");
      copy.removeAttribute("data-ct-limit");
      const fact = items[n];
      if (fact) fillFact(copy, fact, view, key.indexOf("stimates") !== -1);
      proto.parentNode.insertBefore(copy, proto);
    }
    proto.remove();
  }
  const texts = root.querySelectorAll("[data-ct-text]");
  for (let i = 0; i < texts.length; i++) {
    const el = texts.item(i);
    const value = scalar(view, el.getAttribute("data-ct-text") || "");
    if (value === null) el.remove();
    else el.textContent = value;
  }
  const links = root.querySelectorAll("[data-ct-href]");
  for (let i = 0; i < links.length; i++) {
    const el = links.item(i);
    const raw = el.getAttribute("data-ct-href") === "nextHref" && view.next ? view.next.href : null;
    const href = raw ? safeUrl(raw) : null;
    if (href && el instanceof HTMLAnchorElement) {
      el.href = href;
      if (/^https?:/i.test(href)) el.rel = "noopener";
      el.removeAttribute("data-ct-href");
    } else {
      el.remove();
    }
  }
}

function fillFact(node: HTMLElement, fact: RecordFact | EstimateFact, view: View, isEstimate: boolean): void {
  const texts = node.querySelectorAll("[data-ct-text]");
  for (let i = 0; i < texts.length; i++) {
    const el = texts.item(i);
    const key = el.getAttribute("data-ct-text") || "";
    let value: string | null = null;
    if (isEstimate && "approxQuantity" in fact) {
      if (key === "estimate") value = "about " + fact.approxQuantity + " " + unitFor(fact.approxQuantity, fact.unit);
      else if (key === "unit") value = unitFor(fact.approxQuantity, fact.unit);
    } else if (!isEstimate && "count" in fact) {
      if (key === "date") value = fact.dateLabel;
      else if (key === "count") value = String(fact.count);
      else if (key === "unit") value = unitFor(fact.count, fact.unit);
      else if (key === "record") value = fact.count + " " + unitFor(fact.count, fact.unit);
      else if (key === "note") value = fact.note;
    }
    if (value === null || value === "") el.remove();
    else {
      el.textContent = value;
      el.removeAttribute("data-ct-text");
    }
  }
  const imgs = node.querySelectorAll("img[data-ct-photo]");
  for (let i = 0; i < imgs.length; i++) {
    const img = imgs.item(i);
    const photo = !isEstimate && "logId" in fact ? view.photos.find((p) => p.logId === fact.logId) : undefined;
    const src = photo ? safeUrl(photo.url) : null;
    if (src && img instanceof HTMLImageElement) {
      img.src = src;
      img.alt = "note" in fact && fact.note ? fact.note : "";
      img.removeAttribute("data-ct-photo");
    } else {
      img.remove();
    }
  }
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

function unitFor(quantity: number, unit: string): string {
  if (quantity !== 1) return unit;
  if (unit === "meals") return "meal";
  if (unit === "volunteer shifts") return "volunteer shift";
  if (unit === "pounds of produce") return "pound of produce";
  return unit;
}

function safeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.charAt(0) !== "/" || value.charAt(1) === "/" || value.charAt(1) === "\\") return null;
  return value;
}
