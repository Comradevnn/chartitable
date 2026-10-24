// DEMO DATA (fictional) — swap for Convex query
// The ONE dataset behind index.html, dashboard.html and admin.html (classic script, so the pages also work from file://).
// Each page reads window.DEMO_DATA only inside its own swap-point function (index/admin: load() + buildModel(), dashboard: getDonorView()).
// Money is integer cents; times are ms epoch (noon UTC so dates never drift across timezones).
// Shapes follow DASHBOARD_SPEC.md (DashDonor / DashOverview / DashExpense) and DonorView in engine/types.ts.
// No estimate is stored here: every "about" number is computed from `donors[].gifts` (the shared gift pool) and `impactLogs` by CT.allocate() in shared.js.
window.DEMO_DATA = (function () {
  const ts = s => Date.parse(s + "T12:00:00Z");
  const G = (d, cents, label) => ({ at: ts(d), amountCents: cents, label });
  return {
    charity: { id: "demo-pantry-a", name: "Tansy Street Pantry", staffName: "Jordan", windowDays: 30, milestones: [25, 50, 100, 250],
      formula: "Your estimated share = your gifts ÷ all gifts in the 30-day window × what the pantry logged. A log only counts gifts made on or before its date. Rounded down, never up." },
    now: ts("2026-10-24"),
    period: { from: ts("2026-09-24"), to: ts("2026-10-24"), label: "Last 30 days" },
    // Which donors the demo shows by default (dashboard with no ?ct=, index "Returning donor") and for the dashboard's "First gift, no updates yet" state.
    demo: { returningDonorId: "donor_a01", firstGiftDonorId: "donor_a06" },
    // Every donor and their gifts: together these are the gift pool. viewToken is the opaque ?ct= stand-in (no names in URLs).
    donors: [
      { id: "donor_a01", displayName: "Maya Rodriguez", email: "maya.r@example.com", hideFromTopDonors: false, thankedAt: ts("2026-10-03"), viewToken: "k7q2m9",
        gifts: [G("2026-03-03", 1500, "Citrus run"), G("2026-05-20", 5000, "Spring planting run"), G("2026-08-12", 2500, "Stone fruit run"), G("2026-10-01", 1000, "Winter squash run"), G("2026-10-15", 2500, "General fund")] },
      { id: "donor_a02", displayName: "Devon Price", email: "devon.p@example.com", hideFromTopDonors: false, thankedAt: ts("2026-10-02"), viewToken: null,
        gifts: ["2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01"].map(d => G(d, 4000, "Monthly gift")) },
      { id: "donor_a03", displayName: "Aiko Tanaka", email: "aiko.t@example.com", hideFromTopDonors: false, thankedAt: ts("2026-04-03"), viewToken: null,
        gifts: [G("2025-12-10", 50000, "Year-end drive"), G("2026-04-02", 25000, "Spring planting run")] },
      { id: "donor_a04", displayName: "Luis Ortega", email: "luis.o@example.com", hideFromTopDonors: false, thankedAt: ts("2025-12-19"), viewToken: null,
        gifts: [G("2025-12-18", 10000, "Year-end drive")] },
      { id: "donor_a05", displayName: "Priya Shah", email: "priya.s@example.com", hideFromTopDonors: false, thankedAt: ts("2026-10-02"), viewToken: null,
        gifts: ["2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01"].map(d => G(d, 2500, "Monthly gift")) },
      { id: "donor_a06", displayName: "Sam Whitaker", email: "sam.w@example.com", hideFromTopDonors: false, thankedAt: null, viewToken: "t3x8v5",
        gifts: [G("2026-10-23", 3000, "General fund")] },
      { id: "donor_a07", displayName: "Grace Kim", email: "grace.k@example.com", hideFromTopDonors: false, thankedAt: ts("2026-02-21"), viewToken: null,
        gifts: [G("2025-09-05", 100000, "Warehouse fund"), G("2026-02-20", 20000, "Citrus run")] },
      { id: "donor_a08", displayName: "Omar Haddad", email: "omar.h@example.com", hideFromTopDonors: false, thankedAt: ts("2026-01-09"), viewToken: null,
        gifts: [G("2026-01-08", 2000, "Citrus run")] },
      { id: "donor_a09", displayName: "Beatriz Souza", email: "bea.s@example.com", hideFromTopDonors: false, thankedAt: ts("2026-09-03"), viewToken: null,
        gifts: [G("2026-04-15", 6000, "Spring planting run"), G("2026-09-02", 7500, "Stone fruit run")] },
      { id: "donor_a10", displayName: "Ken Okafor", email: "ken.o@example.com", hideFromTopDonors: false, thankedAt: null, viewToken: null,
        gifts: [G("2026-10-19", 10000, "Winter squash run")] },
      { id: "donor_a11", displayName: "Hana Novak", email: "hana.n@example.com", hideFromTopDonors: false, thankedAt: ts("2026-09-06"), viewToken: null,
        gifts: [G("2026-06-12", 4500, "Citrus run"), G("2026-09-05", 4500, "Stone fruit run")] },
      { id: "donor_a12", displayName: "Tom Becker", email: "tom.b@example.com", hideFromTopDonors: false, thankedAt: ts("2026-10-02"), viewToken: null,
        gifts: ["2026-01-01", "2026-04-01", "2026-07-01", "2026-10-01"].map(d => G(d, 1500, "Quarterly gift")) },
      { id: "donor_a13", displayName: "Rosa Delgado", email: "rosa.d@example.com", hideFromTopDonors: false, thankedAt: ts("2026-07-29"), viewToken: null,
        gifts: [G("2026-07-28", 3500, "Stone fruit run")] },
      { id: "donor_a14", displayName: "Anonymous", email: null, hideFromTopDonors: true, thankedAt: null, viewToken: null,
        gifts: [G("2026-09-28", 7500, "General fund")] }
    ],
    // Per-donor view extras for donors who have a personal page (keyed by donor id): last visit, the name shown on the page, next-step copy.
    // `nextStep` is the dashboard's copy; `homeNextStep` is the shorter copy the home page shows in its "next step" slot (its link goes to the donor's page).
    donorViews: {
      donor_a01: { shortName: "Maya R.", lastVisitAt: ts("2026-10-15"), hero: { firstName: "Maya", source: "template" },
        nextStep: { kind: "give_monthly", href: "index.html#give",
          text: "If you would like to keep this going, a monthly gift would show up here as it happens. No pressure: this page stays just as it is either way." },
        homeNextStep: { kind: "give_monthly",
          text: "Your page shows every update with the logged facts and your estimated share. A monthly gift is one way to keep it going, and it is entirely optional." },
        photos: [] },
      donor_a06: { shortName: "Sam W.", lastVisitAt: null, hero: { firstName: "Sam", source: "template" }, // brand-new donor: thin data, say less
        nextStep: { kind: "share", href: "index.html", text: "Nothing to do right now. Your page fills in as the pantry logs updates." },
        photos: [] }
    },
    impactLogs: [ // charity-wide, logged by staff
      { id: "l0", kind: "meals", count: 70, unit: "meals", note: null, loggedAt: ts("2026-09-12") },
      { id: "l1", kind: "meals", count: 45, unit: "meals", note: null, loggedAt: ts("2026-09-27") },
      { id: "l2", kind: "meals", count: 60, unit: "meals", note: null, loggedAt: ts("2026-10-06") },
      { id: "l3", kind: "produce", count: 410, unit: "lb", note: null, loggedAt: ts("2026-10-09") },
      { id: "l4", kind: "meals", count: 50, unit: "meals", note: null, loggedAt: ts("2026-10-14") },
      { id: "l5", kind: "meals", count: 80, unit: "meals", note: "Fresh peaches on a Tuesday. Kids were eating them in line.", loggedAt: ts("2026-10-20") },
      { id: "l6", kind: "produce", count: 220, unit: "lb", note: null, loggedAt: ts("2026-10-22") }
    ],
    expenses: [ // DashExpense
      { id: "e0", date: ts("2026-09-10"), amount: 12000, category: "facility", note: "Cold-room repair (before this period)" },
      { id: "e1", date: ts("2026-09-28"), amount: 18200, category: "food", note: "Bulk staples to fill gaps" },
      { id: "e2", date: ts("2026-10-02"), amount: 5420, category: "transport", note: "Fuel, pickup truck" },
      { id: "e3", date: ts("2026-10-08"), amount: 5425, category: "supplies", note: "Crates and gloves" },
      { id: "e4", date: ts("2026-10-16"), amount: 4220, category: "transport", note: "Fuel, pickup truck" }
    ],
    categories: { food: "Food purchases", transport: "Transport and fuel", facility: "Facility", supplies: "Supplies", staff: "Staff and stipends", other: "Other" }
  };
})();
