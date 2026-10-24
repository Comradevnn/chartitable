/// <reference types="vite/client" />
// The only data-access module. Components import from here and nowhere else.
// Two modes, chosen at build time:
//  - VITE_CONVEX_URL unset  -> mock data (demo fallback, behaves exactly as before).
//  - VITE_CONVEX_URL set    -> real Convex backend (dashboard:* functions); every call passes the staff `pin`.
// The PIN lives in module memory only (typed at sign-in). It is never logged, stored, or put in env/files.
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import type { DashDonor, DashExpense, DashOverview, DonorDetail, NewExpense } from "./types";
import { NOW, donorDetail, donors, expenses, overview } from "./mock/data";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;
const CHARITY_ID = (import.meta.env.VITE_CHARITY_ID as string | undefined) ?? "demo-pantry-a";

let pin = "";
const ledger: DashExpense[] = [...expenses];

const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120));

// Real mode. `api` is untyped (anyApi) so we don't import ../convex/_generated across folders; return shapes
// are the same DashOverview / DashDonor / DashExpense contract the mock uses (engine/types.ts mirrors ./types).
const client = CONVEX_URL ? new ConvexHttpClient(CONVEX_URL) : null;
const api = anyApi.dashboard;
const auth = () => ({ pin, charityId: CHARITY_ID });

/** Staff sign-in. Mock: accepts any non-empty PIN. Real: verified by calling dashboard:overview with the candidate PIN. */
export async function login(candidate: string): Promise<boolean> {
  if (!candidate.trim()) return false;
  if (!client) {
    pin = candidate; // held in memory only
    return delay(true);
  }
  try {
    await client.query(api.overview, { pin: candidate, charityId: CHARITY_ID });
  } catch {
    // "unauthorized" (wrong PIN) or an unreachable backend: either way, stay signed out. Same shape as the mock's rejection.
    pin = "";
    return false;
  }
  pin = candidate; // held in memory only
  return true;
}
export const loggedIn = () => pin !== "";
export const logout = () => { pin = ""; };

export const getOverview = (): Promise<DashOverview> =>
  client ? client.query(api.overview, auth()) : delay(overview);

export const getDonors = (): Promise<DashDonor[]> =>
  client ? client.query(api.donors, auth()) : delay(donors);

// backend missing (T19): falls back to mock. Real donor ids aren't in the mock, so real mode yields null.
export const getDonorDetail = (id: string): Promise<DonorDetail | null> => delay(donorDetail(id));

export const getExpenses = async (): Promise<DashExpense[]> => {
  if (!client) return delay([...ledger].sort((a, b) => b.date - a.date));
  // dashboard:expenses already returns the DashExpense shape; keep the newest-first order the UI expects.
  const rows: DashExpense[] = await client.query(api.expenses, auth());
  return [...rows].sort((a, b) => b.date - a.date);
};

/** Mock: flags the donor in memory. Real: dashboard:markThanked, then re-reads donors (the UI replaces its list with the result). */
export async function markThanked(id: string): Promise<DashDonor[]> {
  if (client) {
    const res: { ok: true } | { ok: false; error: string } = await client.mutation(api.markThanked, { ...auth(), donorId: id });
    if (!res.ok) throw new Error(res.error);
    return getDonors();
  }
  const d = donors.find((x) => x.id === id);
  if (d && d.thankedAt === null) d.thankedAt = NOW;
  return delay([...donors]);
}

// backend missing (T19): falls back to mock. No dashboard:removeExpense / restoreExpense exists, so in real mode
// remove is a no-op (null: the UI ignores it and shows no Undo) rather than touching the mock ledger.
export async function removeExpense(id: string): Promise<DashExpense | null> {
  if (client) return delay(null);
  const i = ledger.findIndex((x) => x.id === id);
  if (i < 0) return delay(null);
  const [row] = ledger.splice(i, 1);
  return delay(row);
}
// backend missing (T19): falls back to mock (unreachable in real mode, since removeExpense never yields a row there).
export async function restoreExpense(row: DashExpense): Promise<void> {
  if (client) return delay(undefined);
  ledger.push(row);
  return delay(undefined);
}

export async function addExpense(e: NewExpense): Promise<DashExpense> {
  if (client) {
    // Backend names the amount `amountCents`; receipts (receiptStorageId) are not offered by this UI.
    const res: { ok: true; id: string } | { ok: false; error: string } = await client.mutation(api.addExpense, {
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
