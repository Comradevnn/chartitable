/// <reference types="vite/client" />
// The only data-access module. Components import from here and nowhere else.
// Two data sources, one rule for choosing:
//  - VITE_CONVEX_URL unset  -> demo data (mock). Nothing leaves the browser.
//  - VITE_CONVEX_URL set    -> live Convex backend (dashboard:* functions); every call passes the staff `pin`.
//    If the live backend can't be reached (at sign-in or mid-session), reads switch to demo data and the UI says so
//    ("fallback" mode). Writes never fall back silently: they throw, and the component shows the reason.
//    In fallback mode every write refuses (the UI disables its buttons and says why).
// The PIN lives in module memory only (typed at sign-in). It is never logged, stored, or put in the URL/env/files.
import { useSyncExternalStore } from "react";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import type { Capabilities, DashDonor, DashExpense, DashOverview, DonorDetail, NewExpense, ThankYouPreview, ThankYouResult, ThankYouStatus } from "./types";
import { NOW, charityName, donorDetail, donors, expenses, overviewFor } from "./mock/data";
import { money } from "./format";
import { receiptType } from "./receipt";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;
const CHARITY_ID = (import.meta.env.VITE_CHARITY_ID as string | undefined) ?? "demo-pantry-a";

let pin = "";
const ledger: DashExpense[] = [...expenses];
let lastRows: DashExpense[] = []; // last ledger read, so Remove can hand back the row for Undo

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
let version = 0; // bumped by refresh(): screens keyed on it re-read everything
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const dataMode = (): DataMode => (!client ? "demo" : fellBack ? "fallback" : "live");
const setFellBack = (v: boolean) => {
  if (fellBack === v) return;
  fellBack = v;
  emit();
};
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
/** Current data mode; re-renders the caller when it changes (e.g. live data stopped loading). */
export const useDataMode = (): DataMode => useSyncExternalStore(subscribe, dataMode);
/** Changes on every refresh(). Use as (part of) a React key so screens re-read. */
export const useRefreshTick = (): number => useSyncExternalStore(subscribe, () => version);

// ---- capabilities ----
// Some dashboard:* functions may not be deployed on the backend yet. After a live sign-in (and on refresh) we find out
// which ones exist, so the UI can disable a control with a reason instead of letting it fail. A function that isn't
// deployed answers "Could not find public function for ...". For each feature we call its function(s) with
// deliberately missing arguments: an argument-validation error means the function exists and nothing ran;
// "Could not find public function" means it doesn't. Demo mode has everything (in memory).
const ALL_ON: Capabilities = { removeExpense: true, donorDetail: true, thankYou: true };
const ALL_OFF: Capabilities = { removeExpense: false, donorDetail: false, thankYou: false };
let caps: Capabilities = client ? ALL_OFF : ALL_ON;
const setCaps = (next: Capabilities) => {
  if ((Object.keys(next) as (keyof Capabilities)[]).every((k) => next[k] === caps[k])) return;
  caps = next; // new object each change: stable snapshot for useSyncExternalStore
  emit();
};
export const capabilities = (): Capabilities => caps;
export const useCapabilities = (): Capabilities => useSyncExternalStore(subscribe, capabilities);

/** Shown next to any control whose backend function isn't deployed. */
export const UNSUPPORTED_REASON = "Needs a backend update that isn't deployed yet.";
/** Shown next to every write control while sample data is standing in for live data. */
export const FALLBACK_REASON = "Showing sample data because live data didn't load. Refresh to try again.";
/** Why writes are off right now, or null when they're allowed. */
export const writeBlockedReason = (): string | null => (dataMode() === "fallback" ? FALLBACK_REASON : null);

const rawText = (e: unknown): string => {
  const data = (e as { data?: unknown } | null)?.data;
  return `${typeof data === "string" ? data : ""} ${e instanceof Error ? e.message : ""}`.toLowerCase();
};
const isMissingFn = (e: unknown) => rawText(e).includes("could not find public function");
const isNetworkErr = (e: unknown) => /failed to fetch|networkerror|load failed|network request/.test(rawText(e));

/** True when the function is deployed. `call` must use missing args so it can never run for real. */
async function deployed(call: () => Promise<unknown>): Promise<boolean> {
  try {
    await call();
    return true;
  } catch (e) {
    return !isMissingFn(e) && !isNetworkErr(e); // an argument error is the expected "yes, it exists"
  }
}
async function probeCapabilities() {
  if (!client || pin === "") { setCaps(client ? ALL_OFF : ALL_ON); return; }
  const base = { pin, charityId: CHARITY_ID }; // no id / donorId on purpose
  const [removeExpense, donorDetail, preview, send] = await Promise.all([
    deployed(() => client.mutation(api.removeExpense, base)),
    deployed(() => client.query(api.donorDetail, base)),
    deployed(() => client.query(api.previewThankYou, base)),
    deployed(() => client.action(api.sendThankYou, base)),
  ]);
  setCaps({ removeExpense, donorDetail, thankYou: preview && send });
}
/** A call that reached a missing function proves the capability is off (e.g. backend rolled back): switch it off. */
function noteMissing(e: unknown, key: keyof Capabilities) {
  if (isMissingFn(e)) setCaps({ ...caps, [key]: false });
}

// ---- errors ----
// ConvexHttpClient throws ConvexError (with `.data`) when the backend answered with an error, and a plain Error
// (network failure, non-200) when it couldn't be reached.
const errText = (e: unknown): string => {
  const data = (e as { data?: unknown } | null)?.data;
  return (typeof data === "string" ? data : e instanceof Error ? e.message : "").toLowerCase();
};
const isUnauthorized = (e: unknown) => errText(e).includes("unauthorized");
// Lockout only: the backend says exactly "locked". Word-ish matches so "rate_limited" or "generate" never count.
const isLocked = (e: unknown) => /locked|too many (wrong )?(pin )?(attempts|tries)/.test(errText(e));

/** A specific, plain-language reason for a failed write, safe to show next to the control. */
export function describeError(e: unknown): string {
  if (isMissingFn(e)) return UNSUPPORTED_REASON;
  if (isUnauthorized(e)) return "The PIN was not accepted. Sign out and sign in again.";
  if (isLocked(e)) return "Too many wrong PIN tries. Wait a few minutes, then try again.";
  const data = (e as { data?: unknown } | null)?.data;
  if (typeof data === "string" && data.trim()) return hideEmails(data);
  if (e instanceof Error && e.message && !/server error|request id|failed to fetch|networkerror|load failed/i.test(e.message)) return hideEmails(e.message);
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

/** Every write goes through this: sample data must never look like a saved change. */
function assertWritable() {
  const why = writeBlockedReason();
  if (why) throw new Error(why);
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
/** Free text from the backend (email draft, reasons) never shows an address, even if one slipped in. */
const hideEmails = (s: unknown): string => String(s ?? "").replace(/[^\s<>"'(),;:]+@[^\s<>"'(),;:]+\.[^\s<>"'(),;:]+/g, "(address hidden)");

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
  if (!fellBack) await probeCapabilities();
  return { ok: true };
}
export const loggedIn = () => pin !== "";
export const logout = () => { pin = ""; setFellBack(false); setCaps(client ? ALL_OFF : ALL_ON); };

/** "Refresh": clear the fallback flag, re-check which backend features exist, and make every screen re-read. */
export async function refresh(): Promise<void> {
  if (client && pin !== "") {
    setFellBack(false);
    await probeCapabilities();
  }
  version += 1;
  emit();
}

export const getOverview = (): Promise<DashOverview> =>
  read(() => client!.query(api.overview, auth()), () => delay(overviewFor(ledger)));

export const getDonors = (): Promise<DashDonor[]> =>
  read<DashDonor[]>(() => client!.query(api.donors, auth()), () => delay([...donors])).then((rows) => rows.map(safeDonor));

/**
 * Gift history + what the donor sees. Demo: mock. Live: dashboard:donorDetail; if it can't load, this throws and the
 * UI says why. Live mode never shows mock content.
 */
export async function getDonorDetail(id: string): Promise<DonorDetail> {
  if (dataMode() === "live") {
    if (!caps.donorDetail) throw new Error(UNSUPPORTED_REASON);
    let d: DonorDetail;
    try {
      d = await client!.query(api.donorDetail, { ...auth(), donorId: id });
    } catch (e) { noteMissing(e, "donorDetail"); throw e; }
    if (!d || !Array.isArray(d.gifts) || !d.preview) throw new Error("The server sent a reply this page can't read.");
    // Whitelist copy again: only these fields reach the UI.
    return {
      gifts: d.gifts.map((g) => ({ at: g.at, amountCents: g.amountCents, label: hideEmails(g.label) })),
      preview: {
        story: hideEmails(d.preview.story),
        records: (d.preview.records ?? []).map((r) => ({ text: hideEmails(r.text), dateLabel: hideEmails(r.dateLabel) })),
        estimates: (d.preview.estimates ?? []).map((x) => ({ text: hideEmails(x.text) })),
      },
    };
  }
  const d = donorDetail(id);
  if (!d) throw new Error("No record of this donor in the sample data.");
  return delay(d);
}

export const getExpenses = async (): Promise<DashExpense[]> => {
  const rows = await read<DashExpense[]>(() => client!.query(api.expenses, auth()), () => delay([...ledger]));
  lastRows = [...rows].sort((a, b) => b.date - a.date); // newest first, as the UI expects
  return lastRows;
};

/** Whether Remove/Undo can work right now: demo yes, live only if the backend has the functions, fallback never. */
export const canRemoveExpense = () => {
  const m = dataMode();
  return m === "demo" || (m === "live" && caps.removeExpense);
};

/** Demo: flags the donor in memory. Live: dashboard:markThanked, then re-reads donors. Throws on failure (see describeError). */
export async function markThanked(id: string): Promise<DashDonor[]> {
  assertWritable();
  if (dataMode() === "live") {
    const res: { ok: true } | { ok: false; error: string } = await client!.mutation(api.markThanked, { ...auth(), donorId: id });
    if (!res.ok) throw new Error(hideEmails(res.error));
    return getDonors();
  }
  const d = donors.find((x) => x.id === id);
  if (d && d.thankedAt === null) d.thankedAt = NOW;
  return (await delay([...donors])).map(safeDonor);
}

/** Removes (soft-deletes) an expense and returns the row, so the caller can offer Undo. Throws on failure. */
export async function removeExpense(id: string): Promise<DashExpense | null> {
  assertWritable();
  if (dataMode() === "live") {
    if (!caps.removeExpense) throw new Error(UNSUPPORTED_REASON);
    const row = lastRows.find((x) => x.id === id) ?? null;
    let res: { ok: true } | { ok: false; error: string };
    try { res = await client!.mutation(api.removeExpense, { ...auth(), id }); } catch (e) { noteMissing(e, "removeExpense"); throw e; }
    if (!res.ok) throw new Error(hideEmails(res.error));
    return row;
  }
  const i = ledger.findIndex((x) => x.id === id);
  if (i < 0) return delay(null);
  const [row] = ledger.splice(i, 1);
  return delay(row);
}
/** Puts a removed expense back (live: same id, backend clears its removed flag). Throws on failure. */
export async function restoreExpense(row: DashExpense): Promise<void> {
  assertWritable();
  if (dataMode() === "live") {
    if (!caps.removeExpense) throw new Error(UNSUPPORTED_REASON);
    let res: { ok: true } | { ok: false; error: string };
    try { res = await client!.mutation(api.restoreExpense, { ...auth(), id: row.id }); } catch (e) { noteMissing(e, "removeExpense"); throw e; }
    if (!res.ok) throw new Error(hideEmails(res.error));
    return;
  }
  ledger.push(row);
  return delay(undefined);
}

/**
 * Demo: adds to the in-memory ledger (a receipt photo becomes an object URL). Live: dashboard:addExpense; a receipt
 * is uploaded first (generateReceiptUploadUrl -> POST the file -> storageId). If the upload fails nothing is saved.
 */
export async function addExpense(e: NewExpense, receiptFile?: File | null): Promise<DashExpense> {
  assertWritable();
  if (dataMode() === "live") {
    let receiptStorageId: string | undefined;
    if (receiptFile) {
      const uploadUrl: string = await client!.mutation(api.generateReceiptUploadUrl, { pin });
      let up: Response;
      try {
        up = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": receiptType(receiptFile) || "application/octet-stream" }, body: receiptFile });
      } catch {
        throw new Error("The receipt photo couldn't be uploaded. Check your connection. Nothing was saved.");
      }
      if (!up.ok) throw new Error(`The receipt photo couldn't be uploaded (error ${up.status}). Nothing was saved.`);
      const body = (await up.json().catch(() => null)) as { storageId?: string } | null;
      if (!body?.storageId) throw new Error("The receipt photo upload didn't finish. Nothing was saved.");
      receiptStorageId = body.storageId;
    }
    // Backend names the amount `amountCents`.
    const res: { ok: true; id: string } | { ok: false; error: string } = await client!.mutation(api.addExpense, {
      ...auth(),
      date: e.date,
      amountCents: e.amount,
      category: e.category,
      ...(e.note ? { note: e.note } : {}),
      ...(receiptStorageId ? { receiptStorageId } : {}),
    });
    if (!res.ok) throw new Error(hideEmails(res.error));
    return { ...e, id: res.id };
  }
  const row: DashExpense = { ...e, id: "e" + (ledger.length + 1) + "_" + Date.now(), ...(receiptFile ? { receiptPhotoUrl: URL.createObjectURL(receiptFile) } : {}) };
  ledger.push(row);
  return delay(row);
}

// ---- thank-you emails ----
const STATUSES: ThankYouStatus[] = ["sent", "skipped_not_allowlisted", "skipped_no_email", "skipped_rate_limited", "failed", "not_configured"];
const DEFAULT_REASON: Record<ThankYouStatus, string> = {
  sent: "",
  skipped_not_allowlisted: "This address isn't on the demo allow-list, so no email was sent.",
  skipped_no_email: "We don't have an email address for this donor, so no email was sent.",
  skipped_rate_limited: "This donor was already emailed in the last 7 days, so no email was sent.",
  failed: "The email service didn't accept it, so no email was sent.",
  not_configured: "Email isn't set up on the server, so no email was sent.",
};

/**
 * The draft thank-you for one donor (the address is never included). Demo: built from the mock facts only: gift count
 * and total are records, the impact figure says "about". Live: dashboard:previewThankYou. Throws on failure.
 */
export async function previewThankYou(id: string): Promise<ThankYouPreview> {
  if (dataMode() === "live") {
    if (!caps.thankYou) throw new Error(UNSUPPORTED_REASON);
    let p: ThankYouPreview;
    try { p = await client!.query(api.previewThankYou, { ...auth(), donorId: id }); } catch (e) { noteMissing(e, "thankYou"); throw e; }
    if (!p || typeof p.subject !== "string" || typeof p.body !== "string") throw new Error("The server sent a reply this page can't read.");
    return { subject: hideEmails(p.subject), body: hideEmails(p.body), canSend: !!p.canSend, reason: p.reason ? hideEmails(p.reason) : null };
  }
  const d = donors.find((x) => x.id === id);
  const detail = donorDetail(id);
  if (!d || !detail) throw new Error("No record of this donor in the sample data.");
  const first = d.hideFromTopDonors || d.displayName === "Anonymous" ? "friend" : d.displayName.split(" ")[0];
  const name = charityName.replace(/ \(fictional\)$/, "");
  const impact = detail.preview.estimates[0]?.text;
  const body = [
    `Dear ${first},`,
    `Thank you for your ${d.giftCount === 1 ? "gift" : d.giftCount + " gifts"} to ${name}: ${money(d.totalGiven)} in all.`,
    impact ? `Gifts are pooled, so we can only estimate your share: ${impact}.` : "Gifts are pooled, so we can only share estimates of what each one made possible.",
    `With thanks,\nThe ${name} team`,
  ].join("\n\n");
  return delay({ subject: `Thank you from ${name}`, body, canSend: true, reason: null });
}

/**
 * Sends the thank-you (live) or explains why nothing was sent. `note` is an optional short staff note (<= 500 chars).
 * Demo never sends and never changes thankedAt. Live: dashboard:sendThankYou (an action); after "sent" the donors are re-read
 * and returned in `donors`. A non-"sent" status always carries a plain reason. Throws on errors (see describeError).
 */
export async function sendThankYou(id: string, note?: string): Promise<ThankYouResult> {
  assertWritable();
  if (dataMode() === "live") {
    if (!caps.thankYou) throw new Error(UNSUPPORTED_REASON);
    const trimmed = note?.trim().slice(0, 500);
    let r: { status?: string; reason?: string };
    try { r = await client!.action(api.sendThankYou, { ...auth(), donorId: id, ...(trimmed ? { body: trimmed } : {}) }); } catch (e) { noteMissing(e, "thankYou"); throw e; }
    const status = STATUSES.find((s) => s === r?.status);
    if (!status) return { status: "failed", reason: "The server sent a reply this page can't read, so we can't say the email went out." };
    const reason = hideEmails(r.reason) || DEFAULT_REASON[status];
    if (status === "sent") return { status, reason, donors: await getDonors() };
    return { status, reason };
  }
  await delay(null);
  return { status: "not_configured", reason: "Demo mode: no email is sent." };
}
