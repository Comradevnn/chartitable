# Charity Dashboard — spec v0 (living doc)

Status: **idea-gathering + MVP scope**, written Sat Oct 24 ~12:30 AM PT. Decision D12 in PROGRESS.md. Owner: Teammate 1 (Figma design first, then `/dashboard`). Add ideas at the bottom under "Idea log"; don't delete others' lines.

## Why
Chartitable's donor layer needs a staff-facing home. Small pantries have no fundraising staff, so the dashboard must answer in 30 seconds: **who gave, what did we spend, what did it do, who needs a thank-you.** It is also where the honesty rule becomes visible to staff: every number says whether it is a *record* (logged) or an *estimate* (computed), the same visual split donors see.

## Users
- **Pantry coordinator / volunteer admin** (primary): non-technical, limited time, phone or old laptop. Needs plain words, big numbers, few clicks.
- **Board member / grant writer** (secondary): wants exportable totals and cost-per-meal for reports.
Demo persona: the coordinator of the fictional pantry (`demo-pantry-a`). Fictional data only (D5); donor names in the seed are fictional.

## Principles
1. **Records vs estimates, always labeled.** Reuse `.ct-record` / `.ct-estimate` language from the layer. Never show a computed number without "estimate"/"about".
2. **Say less when data is thin.** Empty and sparse states are designed screens, not blanks.
3. **Donor dignity.** Top donors is for thanking, not ranking people. Donors can opt out of recognition (see Privacy). No guilt framing in suggested outreach.
4. **Reuse, don't generate.** Dashboard uses a small fixed component set (stat tile, table, bar/line chart, timeline, queue item). No generated graphics.
5. **Cheap and fast.** Everything reads from Convex reactive queries; no heavy BI tooling.

## MVP (target: design by Sat ~1 PM, 3 screens built by Sat ~7 PM; DoD 1–6 of the main demo come first)
| # | Screen | Contents | Source |
|---|---|---|---|
| M1 | **Overview** | Total raised (record), this month vs last, number of donors, new / returning / lapsed counts, meals served this week (record), **cost per meal** (estimate: expenses ÷ meals), last 5 staff updates | donations, impactLogs, expenses |
| M2 | **Donors** | Table: name (or "Anonymous"), total given, gifts, last gift date, status (new / active / at risk / lapsed), "thank-you sent?" flag. Top-N donors sorted by total. Click → donor detail with gift history and *the exact story this donor currently sees* (preview) | donors, donations, narratives |
| M3 | **Expenses** | Ledger table + quick-add form (date, amount, category, note, optional receipt photo). Category totals and a simple "where the money went" bar. Categories: Food purchases, Transport/fuel, Facility, Supplies, Staff/stipends, Other | expenses (new) |

## Next (after MVP, ordered)
- **N1 Staff update feed + composer:** the T4 "served 80 meals" form embedded in the dashboard, with photo; shows how each update changed allocations.
- **N2 Milestone queue:** upcoming "See where your donation has gone" emails with preview and an approve/skip toggle before send (Resend, team inboxes only in demo).
- **N3 Narrative review:** each generated donor story with guard result (passed / fell back to template, with reasons). Makes the fact-check guard visible. Great for the Anthropic pitch.
- **N4 Preview as donor:** pick a donor, see the three layer slots rendered on the demo site (iframe with their token).
- **N5 Retention view:** new vs returning vs lapsed over time, first-to-second gift conversion, average gift, monthly-giver count.
- **N6 Grant/board report export:** one-page CSV/PDF: totals, cost per meal, donors count, meals served, period, all with record/estimate labels. (Lead has grant-writing background; this is the realistic, lived use case.)

## Stretch / idea pool
- **Needs list:** staff mark current shortages ("peanut butter, diapers"); feeds the donor-facing "next step" suggestion with real, current needs.
- **Personalization controls ("creep dial"):** per charity toggles: which slots are on, whether to mention gift amounts, frequency cap on emails, quiet period, a global kill switch. Defaults conservative.
- **Match campaigns:** set a match with cap and deadline; shows progress; layer shows it to donors (pattern seen on real sites).
- **Thank-you queue:** donors who gave but haven't been thanked in N days, with a one-click drafted note (guard-checked, human edits before send).
- **Lapse watch:** donors who gave 2+ times then stopped; suggested gentle, non-guilt touch.
- **Monthly-giving funnel:** one-time donors with 2+ gifts as candidates; conversion tracking.
- **Runway view:** expenses vs average monthly giving; "weeks of operations covered" (estimate).
- **Impact per category:** link expense categories to outputs (e.g., food purchases → pounds distributed) to make cost-per-meal drill-down possible.
- **Volunteer shifts count** as impact records (already an impact kind).
- **Inventory/produce intake log** (pounds in vs out) to sanity-check meals served.
- **Event/drive mode:** time-boxed campaign with its own totals and leaderboard of *teams*, not people.
- **Audit log:** who changed which record (trust story; also useful for the honesty rule).
- **Data export / delete a donor:** one click, supports privacy claims.
- **Cartesia stretch (only if all else done):** spoken weekly summary for the coordinator.
- **Accessibility:** keyboard-first tables, high contrast mode, large-type mode for volunteers.

## Privacy & honesty rules (non-negotiable)
- Staff see donor names/emails only inside the dashboard; **never in URLs** (D6). Dashboard auth for demo: a fictional staff PIN stub; real auth is out of scope for the hackathon and must be called out in the README/pitch.
- **Recognition opt-out:** a donor flag `hideFromTopDonors` (default false for seeded data; the donate page gets a checkbox "Don't list me publicly"). Even though the dashboard is staff-only, the flag controls any future public donor wall and shows we thought about it.
- Money display: cents stored as integers; formatted in one helper.
- Cost per meal is labeled "estimate" with its formula ("expenses ÷ meals served in the period") on hover/tap.
- Seed data only; no real people.

## Data contract (what Revnn will expose from Convex)
Teammate builds against **mock JSON with these shapes first**; Revnn swaps the adapter for Convex queries. Keep shapes stable; ask via PROGRESS.md Blockers before changing.
```ts
type Money = number; // integer cents
type DashOverview = {
  period: { from: number; to: number; label: string };
  totalRaised: Money; prevPeriodRaised: Money;
  donorCounts: { total: number; new: number; returning: number; lapsed: number };
  mealsServed: number;                 // record (sum of impactLogs unit "meals")
  expensesTotal: Money;
  costPerMeal: { value: Money | null; isEstimate: true; formula: string }; // null if meals = 0
  recentUpdates: { id: string; kind: string; count: number; unit: string; note?: string; photoUrl?: string; loggedAt: number }[];
};
type DashDonor = {
  id: string; displayName: string | "Anonymous"; hideFromTopDonors: boolean;
  totalGiven: Money; giftCount: number; firstGiftAt: number; lastGiftAt: number;
  status: "new" | "active" | "at_risk" | "lapsed"; thankedAt: number | null;
};
type DashExpense = {
  id: string; date: number; amount: Money;
  category: "food" | "transport" | "facility" | "supplies" | "staff" | "other";
  note?: string; receiptPhotoUrl?: string;
};
```
Revnn adds: `expenses` table, `donors.hideFromTopDonors`, `donors.thankedAt`, and queries `dashboard:overview`, `dashboard:donors`, `dashboard:expenses`, `dashboard:addExpense`.
Status rules (v0, tweak freely): new = first gift in period; active = gift within 45 days; at_risk = 46–90 days; lapsed = 90+ days.

## Visual / UX direction (to refine in Figma)
- Calm, data-led, warm: reuse Juniper Row / Northmere palettes? **Decision for Teammate 1**; dashboard may have its own neutral chrome with the charity's accent color.
- Desktop-first, usable at tablet width; one primary action per screen.
- Charts: few, labeled directly, no chart junk. Tables beat charts for small data.
- Use Impeccable (`/impeccable init`, `shape`, `craft`, `critique`, `audit`, `polish`) for implementation quality and to avoid generic-AI-template tells.

## Open questions
1. Figma track: which of the five tracks is the dashboard aiming for (Best Design, Best Use Case of Figma, Figma Agent)? Criteria unseen.
2. Does the dashboard live at `/dashboard` on the same Vercel project as the staff page, or its own deploy?
3. Staff login: PIN stub vs magic link (Resend). Recommend PIN stub.
4. Do we show donor emails in the table? Recommend no (name only; email on detail view).

## Idea log (append only)
- [Sat 12:30 AM PT] Lead: dashboard for charities with top donors, expense tracking, "and so on". Need more ideas. Claude seeded the lists above.
