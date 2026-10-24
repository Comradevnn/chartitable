// Convex docs → engine types. Rows store the engine id in `key`.
import type { Doc } from "./doc";
import type { Charity, Donation, Donor, Expense, ImpactLog } from "../../engine/types";

export function toCharity(d: Doc<"charities">): Charity {
  return { id: d.key, name: d.name, siteUrl: d.siteUrl, fictional: true };
}

/** Email is stripped unless explicitly requested (only the milestone mailer needs it). */
export function toDonor(d: Doc<"donors">, opts: { withEmail?: boolean } = {}): Donor {
  return {
    id: d.key,
    firstName: d.firstName,
    email: opts.withEmail ? d.email : null,
    hideFromTopDonors: d.hideFromTopDonors ?? false,
    thankedAt: d.thankedAt ?? null,
  };
}

export function toDonation(d: Doc<"donations">): Donation {
  return {
    id: d.key,
    donorId: d.donorId,
    charityId: d.charityId,
    amountCents: d.amountCents,
    createdAt: d.createdAt,
    testMode: true,
  };
}

export function toImpactLog(d: Doc<"impactLogs">): ImpactLog {
  return {
    id: d.key,
    charityId: d.charityId,
    kind: d.kind,
    count: d.count,
    unit: d.unit,
    note: d.note,
    photoStorageId: d.photoStorageId,
    loggedAt: d.loggedAt,
  };
}

export function toExpense(d: Doc<"expenses">): Expense {
  return {
    id: d.key,
    charityId: d.charityId,
    date: d.date,
    amountCents: d.amountCents,
    category: d.category,
    note: d.note,
    receiptStorageId: d.receiptStorageId,
    createdAt: d.createdAt,
  };
}
