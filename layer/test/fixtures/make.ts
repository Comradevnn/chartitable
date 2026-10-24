// Generates fixture donor views for the variant harness (layer/test/variant-server.mjs) from the
// real engine + fictional seed, so hosts and the layer can be checked in every donor state without
// a token or a backend. Run: node layer/test/variant-server.mjs (it rebuilds these on start).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { allocate } from "../../../engine/allocate";
import { windowEnding } from "../../../engine/config";
import { buildDonorView, narrativeFacts } from "../../../engine/donor-view";
import { templateFallback } from "../../../engine/template";
import type { CharityId, Donation } from "../../../engine/types";
import { buildSeed } from "../../../seed/data";

type SeedLog = ReturnType<typeof buildSeed>["impactLogs"][number];

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const seed = buildSeed(now);
const window = windowEnding(now);
const ASSETS = "https://chartitable.vercel.app";
const DONATE = "https://chartitable.vercel.app/staff/donate?charity=";

function view(charityId: CharityId, donorId: string, opts: { previousVisitAt?: number | null; extraGift?: Donation; extraLog?: SeedLog } = {}) {
  const charity = seed.charities.find((c) => c.id === charityId)!;
  const donor = seed.donors.find((d) => d.id === donorId) ?? { id: donorId, firstName: "Sam", email: null };
  const donations = seed.donations.filter((d) => d.charityId === charityId && d.createdAt >= window.from);
  if (opts.extraGift) donations.push(opts.extraGift);
  const logs = seed.impactLogs.filter((l) => l.charityId === charityId).concat(opts.extraLog ? [opts.extraLog] : []);
  const allocations = allocate(donations, logs, window).filter((a) => a.donorId === donorId);
  const photos = logs.filter((l) => l.photoPath).map((l) => ({ logId: l.id, url: `${ASSETS}/${l.photoPath}` }));
  const context = { charity, donor: { ...donor, email: null }, donations, logs, allocations, window, photos };
  const facts = narrativeFacts(context);
  return buildDonorView({
    context,
    previousVisitAt: opts.previousVisitAt ?? null,
    narrative: { output: templateFallback(facts), source: "template", guardReasons: [] },
    donateHref: DONATE + charityId,
    ownGifts: seed.donations.filter((d) => d.donorId === donorId && d.charityId === charityId).concat(opts.extraGift ? [opts.extraGift] : []),
    visitsInLast30Days: 2,
  });
}

const newGift = (charityId: CharityId): Donation => ({
  id: "don_fixture_new",
  donorId: "donor_fixture_new",
  charityId,
  amountCents: 2500,
  createdAt: now - 60_000,
  testMode: true,
});

// What staff post in demo step 2 ("served 80 meals"), logged a minute ago.
const justLogged = (charityId: CharityId): SeedLog => ({
  id: "log_fixture_live",
  charityId,
  kind: "meals",
  count: 80,
  unit: "meals",
  note: "Hot supper in the side room, served by the Tuesday crew.",
  photoStorageId: null,
  photoPath: null,
  loggedAt: now - 60_000,
});

const fixtures: Record<string, unknown> = {
  "a.first_impact": view("demo-pantry-a", "donor_a01"),
  "a.news": view("demo-pantry-a", "donor_a01", { previousVisitAt: now - 3 * DAY }),
  // Live step: same visit anchor as a.first_impact's page load, plus the new log → new rev.
  "a.live": view("demo-pantry-a", "donor_a01", { previousVisitAt: now - 5 * 60_000, extraLog: justLogged("demo-pantry-a") }),
  "a.repeat": view("demo-pantry-a", "donor_a02"),
  "a.just_gave": view("demo-pantry-a", "donor_fixture_new", { extraGift: newGift("demo-pantry-a") }),
  "b.first_impact": view("demo-pantry-b", "donor_a02"),
  "b.news": view("demo-pantry-b", "donor_a02", { previousVisitAt: now - 3 * DAY }),
  "b.live": view("demo-pantry-b", "donor_a02", { previousVisitAt: now - 5 * 60_000, extraLog: justLogged("demo-pantry-b") }),
  "b.repeat": view("demo-pantry-b", "donor_a05"),
  "b.just_gave": view("demo-pantry-b", "donor_a12"),
};

const out = process.argv[2] ?? ".";
for (const [name, body] of Object.entries(fixtures)) {
  writeFileSync(join(out, `${name}.json`), JSON.stringify(body, null, 2) + "\n");
}
console.log(
  Object.entries(fixtures)
    .map(([n, v]) => `${n}=${(v as { donor?: { state: string } }).donor?.state}`)
    .join(" "),
);
