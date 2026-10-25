export const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 === 0 ? 0 : 2 });

/** Today's date on this device as YYYY-MM-DD, the format a date input uses. Not toISOString(): that is UTC, so after ~5 pm Pacific it already says tomorrow. */
export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const day = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" });

export const dayYear = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });

type NamedDonor = { displayName: string; hideFromTopDonors: boolean; firstGiftAt: number };
/** Donors who chose not to be listed never show a name. Two of them stay distinguishable by first-gift date only. */
export const donorLabel = (d: NamedDonor) =>
  d.hideFromTopDonors || d.displayName === "Anonymous" ? "Anonymous donor, first gave " + day(d.firstGiftAt) : d.displayName;
export const isAnonymous = (d: NamedDonor) => d.hideFromTopDonors || d.displayName === "Anonymous";
