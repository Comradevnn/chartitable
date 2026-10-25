# Handoff: Revnn (Lane A: product)

Last updated: Sat Oct 24, ~1:30 PM PT (Opus prompt #4, plug-and-play demo). Update this file whenever you stop or switch tools. Team-wide status lives in `PROGRESS.md`.

## Where things stand
- **Everything on the donor path is live and gated** on Convex dev `acoustic-donkey-399` + Vercel https://chartitable.vercel.app (469 tests).
- **The demo runs from one page:** https://chartitable.vercel.app/staff/demo. PIN = the `STAFF_PIN` env var on the Convex dev deployment (`npx convex env get STAFF_PIN`; never written down in the repo). No terminal needed on stage.
- Rehearsal script passes 9/9 twice in a row (16 s each) and leaves the demo in its canonical start state.
- Screenshots of the panel and the story: `docs/qa/lane-a/demo-panel/`.

## Running the demo (no docs needed, but here they are)
1. Open `/staff/demo`, type the PIN once. The bar at the top should say **Ready for the demo** (green) or **Ready, with warnings** (amber).
2. Click **Reset demo** (about 15 s) a few minutes before going on. It removes gifts/updates made since the last reset, reseeds, sets Mira's demo inbox, restages every persona and pre-writes all 10 Claude stories ("10 of 10 stories ready (Claude)").
3. Follow the **3-minute story** run sheet on the left of the panel:
   - Open Cinderwell as a first-time visitor (plain site, no request to us) → Donate → test $25 → "just gave".
   - Open Cinderwell as **Mira** (story donor) → her story, records vs estimates ("about").
   - Click **Served 80 meals** (Cinderwell). Within ~6 s Mira's tab shows "Just logged: 80 meals" and about 22 → about 26 meals. The milestone email goes to the demo inbox by itself (button **Send Mira's milestone email** reports "Already sent").
   - Open Brindlecote as **Lena** (repeat donor): different site, same embed.
   - Dashboard: https://chartitable.vercel.app/dashboard/ (Lane B; live data from Convex behind the same PIN).
4. Afterwards: **Reset demo**.
- Each persona button opens a named tab; clicking again reuses that tab and restages the persona, so the state is always the one on the card. If the browser blocks popups, the panel shows an "Open the tab" link instead.
- Personas: Cinderwell = Mira (first impact, story donor, email), Wren (just gave), Teo (news since last visit), Jonas (repeat), Hollis (lapsed); Brindlecote = Felix (first impact), Rhea (just gave), Sana (news), Lena (repeat, story donor), Juno (lapsed). Plus a first-time visitor per site. All fictional.

## If a check is not green
| Check | Amber/red means | Do |
|---|---|---|
| Claude story test | one live probe fell back to the template (guard rejection, cap, or API down) | Demo still works (templates are honest); click **Check again** in 5 min. If "capped": the hourly Claude budget is used up (see below) |
| First views ready | some persona's first view would be a template | Click **Warm stories** |
| Milestone email | email not configured / Mira's inbox not set / already sent | Reset demo. Needs `RESEND_API_KEY` + `DEMO_INBOXES` set in Convex env |
| Start state | gifts or updates since the last reset | Reset demo (only matters before you start) |
| Persona links | red: links not recognized (TOKEN_SECRET/seed problem); amber: a persona's state drifted (e.g. Wren became first_impact after a post) | Reset demo; if still red run `npm run demo:check` and check Convex env |
| Layer on the site | red: Vercel serves a stub or nothing | Push an owner-authored commit to redeploy (Vercel Hobby rule) |
| Seed data | red: seed rows missing | Reset demo |

## CLI (optional, never needed on stage)
```bash
npm run demo:check       # preflight summary, exit 1 on red
npm run demo:reset       # same as the Reset button, then preflight
npm run demo:rehearsal   # walks the run sheet against dev (holds the email; --send-email to really send), ends with a reset
```
PIN comes from `STAFF_PIN` in the environment or silently from `npx convex env get STAFF_PIN`; nothing prints the PIN or tokens.

## Dashboard adapter (Lane B)
Backend functions are live on `https://acoustic-donkey-399.convex.cloud` (the `/dashboard` build gets it as `VITE_CONVEX_URL`). Call them like the static staff pages do: `POST ${VITE_CONVEX_URL}/api/query` (or `/api/mutation`) with JSON `{ "path": "dashboard:overview", "args": { "pin": "<PIN typed by staff, kept in memory>", "charityId": "demo-pantry-a" }, "format": "json" }` → `{ status: "success", value }` or `{ status: "error", errorData: "unauthorized" }`.
- Queries: `dashboard:overview {pin, charityId, days?}` → DashOverview; `dashboard:donors {pin, charityId}` → DashDonor[]; `dashboard:expenses {pin, charityId, days?}` → DashExpense[].
- Mutations: `dashboard:addExpense {pin, charityId, date, amountCents, category, note?, receiptStorageId?}` (input is `amountCents`; output field is `amount`); `dashboard:markThanked {pin, charityId, donorId}` → `{ok}` (refetch donors after); `dashboard:generateReceiptUploadUrl {pin}`.
- Not built: `removeExpense`/`restoreExpense`, `donorDetail`. `thankedAt` is per donor, not per charity (known).
- Donors who chose "Don't list me publicly" come back as `displayName: "Anonymous"`.

## Gotchas
- `npx convex run` runs the DEPLOYED code. A `npx convex dev` watcher has run since ~1 AM, so saves to `convex/`, `engine/`, `seed/` deploy to dev within seconds.
- Claude budget: `NARRATIVE_MAX_PER_HOUR` is **120** calls/hour on dev (raised from the default 60 on Sat 2:10 PM; it caps warm, post re-warm and the probe together). A demo post now costs about 5 calls; a full rehearsal about 10. Over the cap the page still works from the honest template.
- Calibration: `engine/calibration.test.ts` pins Mira (donor_a01) at 22.9 → about 26.7 meals after "Served 80 meals" (shown rounded down: about 22 → about 26). A live donation on stage (step 1, $25) dilutes slightly (still about 26, still crosses 25).
- Smoke rows (`smoke:true`, from `scripts/e2e-smoke.mjs`) make the milestone check skip; Reset removes them. Never run the smoke script during the demo.
- Cursor/teammates edit this checkout: stage explicit paths only; never `git add -A`, stash, reset or checkout files.
- Verify token-bearing pages with screenshots or scripts, never with an accessibility tree / `find` (donate links carry `ct`; a browser `find` printed one dev token into a transcript on Sat 1:20 PM).

## Open (LOW, not fixed)
- `impact:log` accepts any `photoStorageId`; lowercase invented names pass the guard; 30-day token TTL with no revocation; donor first name goes to Anthropic in the facts; the PIN lockout is deployment-wide (someone spamming wrong PINs could lock the panel and the CLI for 10 min; `npx convex run seed:resetDemo` etc. still work as internal functions).

## Vercel owner-commit rule
Vercel Hobby blocks deployments for commits not authored by you. After a teammate pushes to `main`, push an owner-authored commit (`git commit --allow-empty -m "Redeploy" && git push`).
