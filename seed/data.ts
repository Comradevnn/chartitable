// ALL DATA IS FICTIONAL (D5). Invented charities, invented first names, no real
// people, places, or organizations. Pure module: no Convex imports, no randomness,
// no Date.now. Same `now` in -> identical output.
import type {
  Charity,
  CharityId,
  Donation,
  Donor,
  Expense,
  ExpenseCategory,
  ImpactKind,
  ImpactLog,
} from "../engine/types";

export const SEED_NOTICE = "Fictional demo data — no real people or organizations.";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export type SeedImpactLog = ImpactLog & { photoPath: string | null };

export interface SeedData {
  charities: Charity[];
  donors: Donor[];
  donations: Donation[];
  impactLogs: SeedImpactLog[];
  expenses: Expense[];
}

const CHARITIES: Charity[] = [
  {
    id: "demo-pantry-a",
    name: "Cinderwell Pantry",
    siteUrl: "http://localhost:5501",
    fictional: true,
  },
  {
    id: "demo-pantry-b",
    name: "Brindlecote Food Bank",
    siteUrl: "http://localhost:5502",
    fictional: true,
  },
];

// donor_a01 is THE DEMO DONOR (single $25 gift to demo-pantry-a). Emails stay null;
// the lead sets demo inboxes later.
const DONOR_NAMES = [
  "Mira", "Jonas", "Priya", "Teo", "Lena", "Omar",
  "Nadia", "Caleb", "Sana", "Felix", "Ines", "Rhea",
];

// [donor index (1-based), charity, dollars, daysAgo]; hours offset derived from row index.
const DONATION_ROWS: [number, CharityId, number, number][] = [
  [1, "demo-pantry-a", 25, 9], // the demo donor's gift
  [2, "demo-pantry-a", 50, 20],
  [2, "demo-pantry-a", 20, 6],
  [3, "demo-pantry-a", 10, 18],
  [3, "demo-pantry-b", 15, 12],
  [4, "demo-pantry-a", 100, 15],
  [5, "demo-pantry-b", 30, 17], // donor 5: no gifts in the latest 7 days
  [5, "demo-pantry-b", 20, 10],
  [6, "demo-pantry-a", 40, 14],
  [6, "demo-pantry-a", 40, 8],
  [7, "demo-pantry-b", 75, 19],
  [7, "demo-pantry-b", 25, 5],
  [8, "demo-pantry-b", 10, 16],
  [9, "demo-pantry-a", 60, 11],
  [9, "demo-pantry-b", 35, 4],
  [10, "demo-pantry-b", 45, 13],
  [10, "demo-pantry-a", 15, 2],
  [11, "demo-pantry-a", 20, 20],
  [11, "demo-pantry-b", 20, 3],
  [2, "demo-pantry-b", 25, 1],
  [4, "demo-pantry-b", 50, 9],
  [8, "demo-pantry-a", 30, 6],
  [7, "demo-pantry-a", 80, 8],
  [3, "demo-pantry-a", 20, 3],
];

const pad = (n: number, w: number) => String(n).padStart(2, "0").padStart(w, "0");

const NOTES: Record<ImpactKind, string[]> = {
  meals: [
    "Morning distribution, steady line all hour.",
    "Evening pickup window ran full.",
    "Hot meal packs went out with the shelf-stable boxes.",
    "Family boxes packed the night before.",
  ],
  produce: [
    "Fresh delivery from a local farm co-op, sorted by lunch.",
    "Leafy greens and root vegetables, all gone by close.",
    "Surplus produce rescued from a grocery partner.",
  ],
  volunteer_shifts: [
    "Packing crew covered both shifts.",
    "New volunteers trained on intake.",
    "Sorting and loading help for the weekend rush.",
  ],
};

const UNITS: Record<ImpactKind, string> = {
  meals: "meals",
  produce: "pounds of produce",
  volunteer_shifts: "volunteer shifts",
};

const PHOTOS: Record<ImpactKind, string> = {
  meals: "seed/photos/meals-1.svg",
  produce: "seed/photos/produce-1.svg",
  volunteer_shifts: "seed/photos/volunteers-1.svg",
};

// [category, base cents, daysAgo, note]. Generic notes only; all within the last 30 days.
const EXPENSE_ROWS: [ExpenseCategory, number, number, string][] = [
  ["food", 32000, 27, "Bulk shelf-stable groceries order"],
  ["transport", 6800, 24, "Van fuel for pickup runs"],
  ["facility", 21000, 22, "Cold storage and utilities share"],
  ["food", 18500, 19, "Weekly produce and dairy purchase"],
  ["supplies", 7400, 15, "Boxes, bags, and packing tape"],
  ["food", 14200, 11, "Bread and canned goods restock"],
  ["transport", 4500, 9, "Mileage reimbursement for delivery volunteers"],
  ["other", 3500, 5, "Printing for distribution flyers"],
];

// Day buckets 0..6 (0 = today). demo-pantry-a has NO logs in bucket 3.
export const PANTRY_A_EMPTY_DAY_BUCKET = 3;

export function buildSeed(now: number): SeedData {
  const donors: Donor[] = DONOR_NAMES.map((firstName, i) => ({
    id: `donor_a${pad(i + 1, 2)}`,
    firstName,
    email: null,
    ...(i === 6 ? { hideFromTopDonors: true } : {}), // donor_a07 opts out of public lists
  }));
  const donorId = (n: number) => `donor_a${pad(n, 2)}`;

  const donations: Donation[] = DONATION_ROWS.map(([d, charityId, dollars, daysAgo], i) => ({
    id: `don_a${pad(i + 1, 3)}`,
    donorId: donorId(d),
    charityId,
    amountCents: dollars * 100,
    createdAt: now - daysAgo * DAY - (((i * 7) % 20) + 1) * HOUR,
    testMode: true,
  }));
  // Late donor: only gift lands after every log (30 minutes ago).
  donations.push({
    id: `don_a${pad(donations.length + 1, 3)}`,
    donorId: donorId(12),
    charityId: "demo-pantry-b",
    amountCents: 3500,
    createdAt: now - 30 * MIN,
    testMode: true,
  });

  const impactLogs: SeedImpactLog[] = [];
  let seq = 0;
  CHARITIES.forEach((charity, ci) => {
    for (let bucket = 6; bucket >= 0; bucket--) {
      if (charity.id === "demo-pantry-a" && bucket === PANTRY_A_EMPTY_DAY_BUCKET) continue;
      const kinds: ImpactKind[] = ["meals"];
      if ((bucket + ci) % 2 === 0) kinds.push("produce");
      if ((bucket + ci) % 3 === 0) kinds.push("volunteer_shifts");
      kinds.forEach((kind, ki) => {
        seq += 1;
        const base = kind === "meals" ? 60 : kind === "produce" ? 120 : 3;
        const step = kind === "meals" ? 10 : kind === "produce" ? 15 : 1;
        const count = base + ((bucket * 3 + ci * 2 + ki) % 5) * step;
        const notes = NOTES[kind];
        impactLogs.push({
          id: `log_a${pad(seq, 3)}`,
          charityId: charity.id,
          kind,
          count,
          unit: UNITS[kind],
          note: notes[(bucket + ci + ki) % notes.length] ?? null,
          photoStorageId: null,
          photoPath: (bucket + ki) % 2 === 0 ? PHOTOS[kind] : null,
          loggedAt: now - bucket * DAY - (ki * 2 + 2 + ci) * HOUR,
        });
      });
    }
  });

  const expenses: Expense[] = [];
  CHARITIES.forEach((charity, ci) => {
    EXPENSE_ROWS.forEach(([category, baseCents, daysAgo, note], ri) => {
      const date = now - (daysAgo + ci) * DAY - (((ri * 5) % 12) + 1) * HOUR;
      expenses.push({
        id: `exp_a${pad(expenses.length + 1, 3)}`,
        charityId: charity.id,
        date,
        amountCents: Math.round((baseCents * (1 + ci * 0.15)) / 100) * 100,
        category,
        note,
        receiptStorageId: null,
        createdAt: date,
      });
    });
  });

  return { charities: CHARITIES.map((c) => ({ ...c })), donors, donations, impactLogs, expenses };
}

/** Pure upsert decision: rows whose id already exists get updated, others inserted. */
export function planUpserts<T extends { id: string }>(
  existingKeys: ReadonlySet<string>,
  rows: readonly T[],
): { insert: T[]; update: T[] } {
  const insert: T[] = [];
  const update: T[] = [];
  for (const row of rows) (existingKeys.has(row.id) ? update : insert).push(row);
  return { insert, update };
}
