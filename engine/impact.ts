// Staff impact-log validation (T4). Pure TS, no Convex imports.
// Notes are shown verbatim to donors, so they are length-limited and kept free of
// markup, emails, and links.
import type { ImpactKind } from "./types";

export const UNIT_FOR_KIND: Record<ImpactKind, string> = {
  meals: "meals",
  produce: "pounds of produce",
  volunteer_shifts: "volunteer shifts",
};

export const IMPACT_COUNT_MAX = 10_000;
export const IMPACT_NOTE_MAX = 200;
export const IMPACT_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Server-side photo check (the staff page also checks, but the server must not trust it). */
export function photoMetaOk(meta: { size: number; contentType?: string | null } | null): boolean {
  return meta !== null && meta.size > 0 && meta.size <= IMPACT_PHOTO_MAX_BYTES && /^image\//.test(meta.contentType ?? "");
}

/** Client-generated id that makes impact:log idempotent across retries. */
export function isRequestId(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(id);
}

export type ImpactLogValidation =
  | { ok: true; value: { kind: ImpactKind; count: number; unit: string; note: string | null } }
  | { ok: false; error: "kind" | "count" | "note" };

function isKind(k: unknown): k is ImpactKind {
  return typeof k === "string" && Object.prototype.hasOwnProperty.call(UNIT_FOR_KIND, k);
}

export function validateImpactLog(i: { kind: unknown; count: unknown; note?: unknown }): ImpactLogValidation {
  const { kind, count } = i;
  if (!isKind(kind)) return { ok: false, error: "kind" };
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > IMPACT_COUNT_MAX) {
    return { ok: false, error: "count" };
  }
  let note: string | null = null;
  if (i.note !== undefined && i.note !== null) {
    if (typeof i.note !== "string") return { ok: false, error: "note" };
    const trimmed = i.note.trim();
    if (trimmed.length > IMPACT_NOTE_MAX) return { ok: false, error: "note" };
    if (/[<>@]/.test(trimmed) || /http/i.test(trimmed)) return { ok: false, error: "note" };
    note = trimmed === "" ? null : trimmed;
  }
  return { ok: true, value: { kind, count, unit: UNIT_FOR_KIND[kind], note } };
}
