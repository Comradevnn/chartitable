// The only data-access module. Components import from here and nowhere else.
// Real backend: replace each body with the Convex query (dashboard:overview, dashboard:donors,
// dashboard:expenses, dashboard:addExpense). Every one takes the staff `pin` (demo PIN, never committed).
import type { DashDonor, DashExpense, DashOverview, DonorDetail, NewExpense } from "./types";
import { donorDetail, donors, expenses, overview } from "./mock/data";

let pin = "";
const ledger: DashExpense[] = [...expenses];

const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120));

/** Mock gate: accepts any non-empty PIN. Real auth is out of scope for the hackathon (stub, called out in README). */
export async function login(candidate: string): Promise<boolean> {
  if (!candidate.trim()) return false;
  pin = candidate; // held in memory only
  return delay(true);
}
export const loggedIn = () => pin !== "";
export const logout = () => { pin = ""; };

export const getOverview = (): Promise<DashOverview> => delay(overview);
export const getDonors = (): Promise<DashDonor[]> => delay(donors);
export const getDonorDetail = (id: string): Promise<DonorDetail | null> => delay(donorDetail(id));
export const getExpenses = (): Promise<DashExpense[]> => delay([...ledger].sort((a, b) => b.date - a.date));
export async function addExpense(e: NewExpense): Promise<DashExpense> {
  const row = { ...e, id: "e" + (ledger.length + 1) + "_" + Date.now() };
  ledger.push(row);
  return delay(row);
}
