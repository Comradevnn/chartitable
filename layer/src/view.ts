import { money } from "./safe";

// The donor view as the layer reads it. Every v2 field is optional and defensive:
// a missing or wrong-typed field is ignored, never an error (old backends keep working).

export interface RecordFact {
  logId: string;
  count: number;
  unit: string;
  dateLabel: string;
  note: string | null;
}

export interface EstimateFact {
  unit: string;
  approxQuantity: number;
}

export interface PhotoFact {
  logId: string;
  url: string;
}

export interface SinceFact {
  sinceDateLabel: string;
  records: RecordFact[];
  estimates: EstimateFact[];
}

export interface NextFact {
  text: string;
  href: string | null;
  kind: string | null;
  label: string | null;
}

export interface GiftFact {
  amountDollars: number;
  dateLabel: string;
}

export interface DonorFact {
  state: string | null;
  traits: string[];
  gifts: GiftFact[];
  giftCount: number | null;
}

export interface View {
  recognized: true;
  firstName: string | null;
  story: string;
  headline: string | null;
  body: string | null;
  since: SinceFact | null;
  next: NextFact | null;
  records: RecordFact[];
  estimates: EstimateFact[];
  photos: PhotoFact[];
  donor: DonorFact | null;
  rev: string | null;
  pollMs: number | null;
}

const STATES = ["just_gave", "news", "first_impact", "repeat", "lapsed", "returning"];
const TRAITS = ["named", "has_photos", "regular"];

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseView(data: unknown): View | false | null {
  if (!data || typeof data !== "object") return null;
  const body = data as Record<string, unknown>;
  if (body.recognized === false) return false;
  if (body.recognized !== true) return null;
  const hero = body.hero;
  if (!hero || typeof hero !== "object") return null;
  const h = hero as Record<string, unknown>;
  if (typeof h.story !== "string") return null;
  const rawName = h.firstName;
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
      next = {
        text: raw.text,
        href: typeof raw.href === "string" ? raw.href : null,
        kind: typeof raw.kind === "string" && /^[a-z_]{1,24}$/.test(raw.kind) ? raw.kind : null,
        label: text(raw.label),
      };
    }
  }

  let donor: DonorFact | null = null;
  if (body.donor && typeof body.donor === "object") {
    const raw = body.donor as Record<string, unknown>;
    const gifts: GiftFact[] = [];
    if (Array.isArray(raw.gifts)) {
      for (const g of raw.gifts) {
        if (!g || typeof g !== "object") continue;
        const amount = num((g as Record<string, unknown>).amountDollars);
        const label = (g as Record<string, unknown>).dateLabel;
        if (amount !== null && typeof label === "string") gifts.push({ amountDollars: amount, dateLabel: label });
      }
    }
    donor = {
      state: typeof raw.state === "string" && STATES.indexOf(raw.state) !== -1 ? raw.state : null,
      traits: Array.isArray(raw.traits)
        ? raw.traits.filter((t): t is string => typeof t === "string" && TRAITS.indexOf(t) !== -1)
        : [],
      gifts,
      giftCount: num(raw.giftCount),
    };
  }

  const live = body.live && typeof body.live === "object" ? num((body.live as Record<string, unknown>).pollMs) : null;

  return {
    recognized: true,
    firstName,
    story: h.story,
    headline: text(h.headline),
    body: text(h.body),
    since,
    next,
    records: asRecords(body.records),
    estimates: asEstimates(body.estimates),
    photos: asPhotos(body.photos),
    donor,
    rev: typeof body.rev === "string" ? body.rev : null,
    pollMs: live !== null && live > 0 ? live : null,
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

// Scalar fields for data-ct-text. null = no value, so the element is removed.
export function scalar(view: View, key: string): string | null {
  const gift = view.donor ? view.donor.gifts[0] : undefined;
  let value: string | null | undefined = null;
  switch (key) {
    case "firstName":
      value = view.firstName;
      break;
    case "headline":
      value = view.headline;
      break;
    case "story":
      value = view.story;
      break;
    case "body":
      value = view.body;
      break;
    case "nextText":
      value = view.next ? view.next.text : null;
      break;
    case "nextLabel":
      value = view.next ? view.next.label : null;
      break;
    case "sinceDate":
      value = view.since ? view.since.sinceDateLabel : null;
      break;
    case "lastGiftDate":
      value = gift ? gift.dateLabel : null;
      break;
    case "lastGift":
      value = gift ? money(gift.amountDollars) : null;
      break;
    case "giftCount":
      value = view.donor && view.donor.giftCount !== null ? String(view.donor.giftCount) : null;
      break;
  }
  return value ? value : null;
}
