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
