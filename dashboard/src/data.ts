/// <reference types="vite/client" />
// The only data-access module. Components import from here and nowhere else.
// Two data sources, one rule for choosing:
//  - VITE_CONVEX_URL unset  -> demo data (mock). Nothing leaves the browser.
//  - VITE_CONVEX_URL set    -> live Convex backend (dashboard:* functions); every call passes the staff `pin`.
//    If the live backend can't be reached (at sign-in or mid-session), reads switch to demo data and the UI says so
//    ("fallback" mode). Writes never fall back silently: they throw, and the component shows the reason.
// The PIN lives in module memory only (typed at sign-in). It is never logged, stored, or put in the URL/env/files.
import { useSyncExternalStore } from "react";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import type { DashDonor, DashExpense, DashOverview, DonorDetail, NewExpense } from "./types";
import { NOW, donorDetail, donors, expenses, overview } from "./mock/data";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;
const CHARITY_ID = (import.meta.env.VITE_CHARITY_ID as string | undefined) ?? "demo-pantry-a";

let pin = "";
const ledger: DashExpense[] = [...expenses];

const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120));

// `api` is untyped (anyApi) so we don't import ../convex/_generated across folders; return shapes are the same
// DashOverview / DashDonor / DashExpense contract the mock uses (engine/types.ts mirrors ./types).
const client = CONVEX_URL ? new ConvexHttpClient(CONVEX_URL) : null;
const api = anyApi.dashboard;
const auth = () => ({ pin, charityId: CHARITY_ID });

/** True when this build is wired to a live backend (the sign-in copy depends on it). */
export const liveConfigured = client !== null;

// ---- mode: "live" (Convex) | "demo" (sample data by design) | "fallback" (sample data because live failed) ----
export type DataMode = "live" | "demo" | "fallback";
let fellBack = false;
const listeners = new Set<() => void>();
export const dataMode = (): DataMode => (!client ? "demo" : fellBack ? "fallback" : "live");
const setFellBack = (v: boolean) => {
  if (fellBack === v) return;
  fellBack = v;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
/** Current data mode; re-renders the caller when it changes (e.g. live data stopped loading). */
export const useDataMode = (): DataMode => useSyncExternalStore(subscribe, dataMode);

// ---- errors ----
// ConvexHttpClient throws ConvexError (with `.data`) when the backend answered with an error, and a plain Error
// (network failure, non-200) when it couldn't be reached.
const errText = (e: unknown): string => {
  const data = (e as { data?: unknown } | null)?.data;
  return (typeof data === "string" ? data : e instanceof Error ? e.message : "").toLowerCase();
};
const isUnauthorized = (e: unknown) => errText(e).includes("unauthorized");
const isLocked = (e: unknown) => /lock|too many|attempt|rate/.test(errText(e));

/** A specific, plain-language reason for a failed write, safe to show next to the control. */
export function describeError(e: unknown): string {
  if (isUnauthorized(e)) return "The PIN was not accepted. Sign out and sign in again.";
  if (isLocked(e)) return "Too many wrong PIN tries. Wait a few minutes, then try again.";
  const data = (e as { data?: unknown } | null)?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (e instanceof Error && e.message && !/server error|request id|failed to fetch|networkerror|load failed/i.test(e.message)) return e.message;
  return "The server couldn't be reached. Check your connection and try again.";
}

/** Run the live read; if it fails for any reason, switch to demo data (visible in the header) and use the sample. */
async function read<T>(live: () => Promise<T>, demo: () => Promise<T>): Promise<T> {
  if (client && !fellBack) {
    try {
      return await live();
    } catch {
      setFellBack(true);
    }
  }
  return demo();
}

// ---- donors: never expose an email or a hidden donor's name ----
// Whitelist copy: any extra field the backend might send (an email, say) is dropped here and can't reach the UI.
const safeDonor = (d: DashDonor): DashDonor => ({
  id: d.id,
  displayName: d.hideFromTopDonors ? "Anonymous" : d.displayName.includes("@") ? "Donor" : d.displayName,
  hideFromTopDonors: !!d.hideFromTopDonors,
  totalGiven: d.totalGiven,
  giftCount: d.giftCount,
  firstGiftAt: d.firstGiftAt,
  lastGiftAt: d.lastGiftAt,
  status: d.status,
  thankedAt: d.thankedAt ?? null,
});

export type LoginResult = { ok: true } | { ok: false; reason: "empty" | "wrong" | "locked" };

/**
 * Staff sign-in. Demo: any non-empty PIN. Live: verified by calling dashboard:overview with the candidate PIN.
 * Wrong PIN (backend says unauthorized) stays signed out. Backend unreachable / any other error signs in on demo data.
 */
export async function login(candidate: string): Promise<LoginResult> {
  if (!candidate.trim()) return { ok: false, reason: "empty" };
  setFellBack(false);
  if (!client) {
    pin = candidate; // held in memory only
    await delay(true);
    return { ok: true };
  }
  try {
    await client.query(api.overview, { pin: candidate, charityId: CHARITY_ID });
  } catch (e) {
    if (isUnauthorized(e)) { pin = ""; return { ok: false, reason: "wrong" }; }
    if (isLocked(e)) { pin = ""; return { ok: false, reason: "locked" }; }
    setFellBack(true); // couldn't reach live data: continue on sample data, clearly marked
  }
  pin = candidate; // held in memory only
  return { ok: true };
}
export const loggedIn = () => pin !== "";
export const logout = () => { pin = ""; setFellBack(false); };

export const getOverview = (): Promise<DashOverview> =>
  read(() => client!.query(api.overview, auth()), () => delay(overview));

export const getDonors = (): Promise<DashDonor[]> =>
  read<DashDonor[]>(() => client!.query(api.donors, auth()), () => delay([...donors])).then((rows) => rows.map(safeDonor));

/** Gift history exists only in demo data. Live has no donorDetail yet: null, and the UI says so (never invented). */
export const getDonorDetail = (id: string): Promise<DonorDetail | null> =>
  dataMode() === "live" ? Promise.resolve(null) : delay(donorDetail(id));

export const getExpenses = async (): Promise<DashExpense[]> => {
  const rows = await read<DashExpense[]>(() => client!.query(api.expenses, auth()), () => delay([...ledger]));
  return [...rows].sort((a, b) => b.date - a.date); // newest first, as the UI expects
};

/** Whether the backend can remove/restore an expense. Live has no such function, so the UI hides the control. */
export const canRemoveExpense = () => dataMode() !== "live";

/** Demo: flags the donor in memory. Live: dashboard:markThanked, then re-reads donors. Throws on failure (see describeError). */
export async function markThanked(id: string): Promise<DashDonor[]> {
  if (dataMode() === "live") {
    const res: { ok: true } | { ok: false; error: string } = await client!.mutation(api.markThanked, { ...auth(), donorId: id });
    if (!res.ok) throw new Error(res.error);
    return getDonors();
  }
  const d = donors.find((x) => x.id === id);
  if (d && d.thankedAt === null) d.thankedAt = NOW;
  return (await delay([...donors])).map(safeDonor);
}

// Demo only. No dashboard:removeExpense / restoreExpense exists, so live mode never offers Remove (canRemoveExpense).
export async function removeExpense(id: string): Promise<DashExpense | null> {
  const i = ledger.findIndex((x) => x.id === id);
  if (i < 0) return delay(null);
  const [row] = ledger.splice(i, 1);
  return delay(row);
}
export async function restoreExpense(row: DashExpense): Promise<void> {
  ledger.push(row);
  return delay(undefined);
}

/** Demo: adds to the in-memory ledger. Live: dashboard:addExpense. Throws on failure (see describeError). */
export async function addExpense(e: NewExpense): Promise<DashExpense> {
  if (dataMode() === "live") {
    // Backend names the amount `amountCents`; receipts (receiptStorageId) are not offered by this UI.
    const res: { ok: true; id: string } | { ok: false; error: string } = await client!.mutation(api.addExpense, {
      ...auth(),
      date: e.date,
      amountCents: e.amount,
      category: e.category,
      ...(e.note ? { note: e.note } : {}),
    });
    if (!res.ok) throw new Error(res.error);
    return { ...e, id: res.id };
  }
  const row = { ...e, id: "e" + (ledger.length + 1) + "_" + Date.now() };
  ledger.push(row);
  return delay(row);
}
