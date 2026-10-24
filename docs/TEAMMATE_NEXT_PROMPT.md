# Next prompt for Teammate 1 (paste into Cursor or Claude Code at the repo root)

Setup: `git fetch && git checkout main && git pull --rebase`. Work on `main` in your own folders (`/frontend`, `/dashboard`, `docs/design`) or on branch `dashboard`; either works. **Vercel will show your pushes as "Blocked" (Hobby plan, expected); tell Revnn when you want a deploy and he ships it with an owner-authored commit.**

---

You are helping Teammate 1 on Chartitable at Cal Hacks 13.0 (Devpost submission Sun Oct 25, 9:00 AM PT). Read `CLAUDE.md` (rules, read map), then the Lane B parts of `PROGRESS.md` (Snapshot, Blockers, integration contract v1, decisions D12–D16, rows T18 and T22, last ~20 log lines tagged `[B]` or `[ALL]`), `docs/handoff/teammate1.md`, `docs/DASHBOARD_SPEC.md`, `docs/demo-site-reference.md`, and `docs/design/README.md`. Do not read Lane A files.

## Where things stand
- Backend is live and tested; it is not your concern except its API shapes. The donor-facing layer (`layer.js`) is being built in Cursor by Revnn; until then nothing personalizes a real site.
- Cursor's four test host sites exist (`/demo-sites/test-hosts`, live at https://chartitable.vercel.app/sites/<name>/) as **test fixtures**. Leave them alone; do not polish them.
- Your `/frontend` pages are live at https://chartitable.vercel.app/app/ . The returning-donor experience in them is not good enough yet (lead's review). You are the person to fix it.

## Priority 1 (about 60% of your time): the returning-donor experience (task T22, decision D15)
The returning donor sees three blocks that `layer.js` fills inside empty slots on the charity's own site: **hero** (a short story + what the pantry logged + the donor's estimated share), **since-last-visit**, and **next-step**. Design how these look, then deliver CSS:
1. Run `npx impeccable install --providers=cursor --scope=project` if not done, `/impeccable init` if `PRODUCT.md` is thin, then `/impeccable shape` for the returning-donor experience (audience: someone who gave $25 once and is coming back; goal: feel seen and informed, never watched; tone: neighborly, specific, honest).
2. Design it in Figma: first view with thin data (short, modest), a rich view (story, 2–3 logged records with a photo, estimates, since-last-visit, one next step), and an error/empty state (nothing shown at all; site looks normal). Show it on two host styles (warm pantry, clean regional bank) by only changing the `--ct-*` variables.
3. Deliver **`docs/design/ct-slots.css`** following `docs/design/README.md` exactly: zero-specificity `:where()` selectors on the existing classes only, variables with fallbacks, no new markup, no animation, no external requests. Records and estimates must be unmistakably different; every estimate shows "about"/"estimate".
4. Test it without the real layer: open any test host with `?preview=1` (its dev harness fills the slots with the same markup the real layer will emit), at 1280 and 390 px, with two different `--ct-*` palettes. Run `/impeccable critique`, `audit`, `polish`.
5. Replace the ad-hoc donor impact styling in `/frontend/dashboard.html` with the same classes so the product looks consistent, then log `[B]` in PROGRESS.md and set T22 to `review`.
Honesty rules are not optional: records vs estimates visually separate, "about" on every estimate, say less when data is thin, no guilt language, fictional data only.

## Priority 2 (about 40%): dashboard MVP (T18)
Continue per `docs/TEAMMATE_DASHBOARD_PROMPT.md` and the spec: Overview, Donors (top donors), Expenses on mock data behind `dashboard/src/data.ts`. Note the real backend functions all take a `pin` argument (the demo staff PIN, told to you by Revnn directly; never commit it); keep the PIN in a login gate and pass it in the adapter. Reuse the same design tokens as T22.

## Housekeeping
- Names: "Tansy Street Pantry" (yours) and the test hosts' names are being checked against real organizations (T21). Don't ship a name until Revnn confirms it is CLEAR.
- Keep `docs/handoff/teammate1.md` current and append one `[B]` line to the PROGRESS.md log per finished piece. Commit small, only your own paths, never force-push.
- Cut order if you run short: dashboard Next/extra charts → expense receipts → donor detail preview. Never cut T22.
