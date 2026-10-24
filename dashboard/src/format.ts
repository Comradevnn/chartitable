export const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 === 0 ? 0 : 2 });

export const day = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" });

export const dayYear = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });

type NamedDonor = { displayName: string; hideFromTopDonors: boolean; firstGiftAt: number };
/** Donors who chose not to be listed never show a name. Two of them stay distinguishable by first-gift date only. */
export const donorLabel = (d: NamedDonor) =>
  d.hideFromTopDonors || d.displayName === "Anonymous" ? "Anonymous donor, first gave " + day(d.firstGiftAt) : d.displayName;
export const isAnonymous = (d: NamedDonor) => d.hideFromTopDonors || d.displayName === "Anonymous";
