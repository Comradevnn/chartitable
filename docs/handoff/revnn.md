# Handoff: Revnn (Lane A: product)

Last updated: Sat Oct 24, ~4:15 AM PT. Update this file whenever you stop or switch tools. Team-wide status lives in `PROGRESS.md`.

## Where things stand (Sat ~4:15 AM PT)
- **Backend is live** on Convex dev (`acoustic-donkey-399`): T3, T4 backend, T6, T7, T9, T19 built and tested (254 tests); env set (TOKEN_SECRET, STAFF_PIN, ANTHROPIC_API_KEY, DONATE_PAGE_URL); seed loaded; live `/donor-view` verified (first view template, second Claude, bad token recognized:false).
- **Static hosts are live** on Vercel: https://chartitable.vercel.app (`/layer.js`, `/staff/*`, `/sites/<host>`, `/app`). Teammate commits show "Blocked" (Hobby); ship them by pushing an owner-authored commit (D16).
- **The gap:** `layer/src/layer.ts` is a stub (T8). No host site personalizes anything yet. T4 staff page also not built. Both are Cursor tasks.
- Cursor's four test hosts (T20) are fixtures only (D14). Teammate 1 owns the returning-donor look (T22) and the dashboard (T18).
- Four demo names resemble real orgs (T21). Product name "Chartitable" is one letter from the "Charitable" donation-software trademark (WP Charitable LLC): your decision before the repo goes public.
- Git identity (repo and global) is the GitHub noreply address; history was rewritten once (Sat 3 AM). Old history only in a local bundle in a session scratchpad.

## Next, in order
1. **Cursor, new chat, Part 1 of `docs/CURSOR_LAYER_STAFF_PROMPT.md`** (T8 `layer.js`). Then Part 2 (T4 staff page). Grok 4.7, Fast off, effort high; Composer 2.5 for mechanical steps.
2. **Claude Code, Opus 5.5, `docs/OPUS_LANE_A_PROMPT_2.md`** in parallel: T21 renames (name-checked), T23 smoke script, health page, gating of Cursor's diffs, audits, docs.
3. **Teammate 1: `docs/TEAMMATE_NEXT_PROMPT.md`** (T22 returning-donor design first, then dashboard).
4. **You, by hand:** Resend key in `.env` (`RESEND_API_KEY`) + the account-owner inbox → Convex env set (`DEMO_INBOXES`, `RESEND_API_KEY`) → `npx convex run milestones:setDemoEmail '{"donorId":"donor_a01","email":"<inbox>"}'` **before demo step 2**. Also X Premium pickup / Grok Bot, and ask at the booth how to enter the Anthropic track.
5. Decide: product name, which host is the demo site (D14), D15 (teammate designs slots).
6. C3 (~11 AM): demo-done checks 1, 2, 5 on a host site with the real layer. C4 (~2 PM): 1–5 on Vercel. C5 (~7 PM): 1–6 twice. Freeze 10 PM. T17 (public repo, secret scan, README) before Sun 8:30 AM.

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

## Vercel owner-commit rule
Vercel Hobby blocks deployments for commits not authored by you (e.g., `naelqdl`). After the teammate pushes to `main`, push an owner-authored commit (`git commit --allow-empty -m "Redeploy" && git push`) to ship it. `scripts/build-site.mjs` publishes `/layer.js`, `/staff`, `/sites/<test host>`, and `/app` (teammate's `/frontend`). Your git identity (repo and global) is the GitHub noreply address.
