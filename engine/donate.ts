// Pure validation for the hosted test-mode donate page (spec §14, D10). No Convex imports.
import { DONATION_MAX_DOLLARS, DONATION_MIN_DOLLARS } from "./config";
import { CHARITY_IDS } from "./types";
import type { CharityId } from "./types";

export type DonateError = "charity" | "amount" | "firstName" | "email";

export interface ValidDonation {
  charityId: CharityId;
  amountCents: number;
  firstName: string | null;
  email: string | null;
  hideFromTopDonors: boolean;
}

const FIRST_NAME_MAX = 40;
const EMAIL_MAX = 254;
const FIRST_NAME_RE = /^[\p{L} '-]+$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateDonation(input: {
  charityId: unknown;
  amountCents: unknown;
  firstName?: unknown;
  email?: unknown;
  hideFromTopDonors?: unknown;
}): { ok: true; value: ValidDonation } | { ok: false; error: DonateError } {
  const { charityId, amountCents } = input;
  if (typeof charityId !== "string" || !(CHARITY_IDS as readonly string[]).includes(charityId)) {
    return { ok: false, error: "charity" };
  }
  if (
    typeof amountCents !== "number" ||
    !Number.isInteger(amountCents) ||
    amountCents < DONATION_MIN_DOLLARS * 100 ||
    amountCents > DONATION_MAX_DOLLARS * 100
  ) {
    return { ok: false, error: "amount" };
  }

  let firstName: string | null = null;
  if (input.firstName !== undefined && input.firstName !== null) {
    if (typeof input.firstName !== "string") return { ok: false, error: "firstName" };
    const t = input.firstName.trim();
    if (t !== "") {
      if (t.length > FIRST_NAME_MAX || !FIRST_NAME_RE.test(t)) return { ok: false, error: "firstName" };
      firstName = t;
    }
  }

  let email: string | null = null;
  if (input.email !== undefined && input.email !== null) {
    if (typeof input.email !== "string") return { ok: false, error: "email" };
    const t = input.email.trim().toLowerCase();
    if (t !== "") {
      if (t.length > EMAIL_MAX || !EMAIL_RE.test(t)) return { ok: false, error: "email" };
      email = t;
    }
  }

  return {
    ok: true,
    value: {
      charityId: charityId as CharityId,
      amountCents,
      firstName,
      email,
      hideFromTopDonors: input.hideFromTopDonors === true,
    },
  };
}

/** Keep an email only if it is on the DEMO_INBOXES allowlist (D4): other addresses are never stored. */
export function keepAllowlistedEmail(email: string | null, allowlist: ReadonlySet<string>): string | null {
  return email !== null && allowlist.has(email) ? email : null;
}

/** siteUrl with its query/hash replaced by ?ct=<token>. Only the token ever rides in the URL. */
export function redirectUrl(siteUrl: string, token: string): string {
  const u = new URL(siteUrl); // throws on unparseable input
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("siteUrl must be http or https");
  }
  u.search = "";
  u.hash = "";
  u.searchParams.set("ct", token);
  return u.href;
}
