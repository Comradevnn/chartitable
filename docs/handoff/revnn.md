# Handoff: Revnn (Lane A: product)

Last updated: Sat Oct 24, ~1:25 AM PT (after the Lane A backend run). Update this file whenever you stop or switch tools. Team-wide status lives in `PROGRESS.md`.

## Where things stand
- **Done in code, tested (250 tests green, typecheck + build clean):** T1 scaffold, T2/T12 schema + seed (now with expenses), T5 allocation, T6 narrative + guard + Claude action, T7 tokens + `/donor-view` + visits, T3 donate page, T4 backend (`impact:*`), T9 milestones + email, T19 dashboard backend, calibration test (§16).
- **Live Claude smoke passed** (Sat 1:08 AM): demo donor got a `source: "claude"` story that passed the guard on the first try, 3.9 s.
- **Nothing is deployed.** Convex is not linked (`convex/_generated/` doesn't exist; `convex/lib/builders.ts` gives typed builders without it).
- **Cursor next:** T8 `layer.js` and the T4 staff page. Prompts are in `docs/CURSOR_LAYER_STAFF_PROMPT.md` (Part 1, Part 2). T20 test hosts are in progress in Cursor.
- Repo: https://github.com/Comradevnn/chartitable (private). `.env` is local only (gitignored) and holds `ANTHROPIC_API_KEY`.

## Next, in order (human steps first)
1. `npx convex dev` (interactive login; links the deployment, generates `_generated/`, pushes functions). Leave it running in a terminal tab.
2. Set Convex env (values never in the repo; generate the secret, e.g. `openssl rand -hex 32`):
   ```bash
   npx convex env set TOKEN_SECRET <64 hex chars>
   npx convex env set ANTHROPIC_API_KEY <key>
   npx convex env set STAFF_PIN <fictional demo PIN>
   npx convex env set DEMO_INBOXES <resend account owner inbox>
   npx convex env set RESEND_API_KEY <key>
   npx convex env set DONATE_PAGE_URL http://localhost:5175/donate.html
   ```
3. `npx convex run seed:load` then `npx convex run milestones:setDemoEmail '{"donorId":"donor_a01","email":"<same inbox>"}'` **before** demo step 2 (a donor without an email is marked skipped for good once they cross a threshold).
4. Demo link for the seeded donor: `npx convex run tokens:issue '{"donorId":"donor_a01","charityId":"demo-pantry-a"}'`.
5. Put the `.convex.cloud` URL in `staff/config.js` (`convexUrl`) for the donate page; serve it with `npx esbuild --servedir=staff --serve=5175`.
6. Cursor: T8 then T4 using the prompt doc; build `layer.js` with `--define:CT_API_BASE='"https://<deployment>.convex.site"'`.
7. Vercel deploy (C4, ~Sat 2 PM); T17 before Sun 8:30 AM (secret scan, README, make repo public).

## Resume commands
```bash
cd "~/Claude Code/Chartitable" && git pull --rebase --autostash && npm install && npm test && npm run typecheck
```
Start Claude Code here with Opus 5.5; read CLAUDE.md, PROGRESS.md (Lane A parts), this file, `docs/PRODUCT_SPEC.md` §12–§19.

## Gotchas
- Cursor edits this checkout at the same time: stage explicit paths only; never `git add -A`, stash, reset or checkout files. PROGRESS.md often has Cursor's uncommitted lines; commit only your own hunks.
- Convex function references go through `internal`/`api` from `convex/lib/builders.ts` (anyApi). After codegen they still work; switching to `./_generated/*` is optional.
- `/donor-view` never waits on Claude: the first view after a data change shows the template and schedules generation; the next view shows Claude's story. Pre-warm the demo donor by loading the page once before presenting.
- The milestone check does nothing (marks nothing) until `RESEND_API_KEY` and `DEMO_INBOXES` are set. It also runs right after every `impact:log`.
- Dashboard functions all need `pin`; Lane B's adapter must pass it.
- Calibration: `engine/calibration.test.ts` pins the demo numbers (22.9 → 26.8 meals). If the seed or window changes and it fails, fix the defaults, not the test's meaning.

## Open questions for the lead
- Confirm the defaults chosen in `docs/PRODUCT_SPEC.md` (end of file): 30-day window, PIN auth, 60/hour cap, 60 s regeneration interval, build-time API origin for `layer.js`.
- Returning donors via the donate page get a new donor id (no lookup by email, on purpose: an email lookup would let anyone view another donor's impact). OK for the demo?
- Dashboard login: PIN is wired; magic link not built.
