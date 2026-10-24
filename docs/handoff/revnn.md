# Handoff: Revnn (Lane A: product)

Last updated: Sat Oct 24, ~3:00 AM PT (Opus prompt #2 run). Update this file whenever you stop or switch tools. Team-wide status lives in `PROGRESS.md`.

## Where things stand
- **Backend live** on Convex dev (`acoustic-donkey-399`): T3, T4 backend, T6, T7, T9, T19 built; 276 tests. Env set: TOKEN_SECRET, STAFF_PIN, ANTHROPIC_API_KEY, DONATE_PAGE_URL. Missing: RESEND_API_KEY, DEMO_INBOXES.
- **T21 seed renamed and live:** `demo-pantry-a` = Cinderwell Pantry, `demo-pantry-b` = Brindlecote Food Bank (Haiku two-search CLEAR). Lane B still renames hosts/`/frontend` (Blockers row has the mapping).
- **Seed `siteUrl`** now points at the Vercel test hosts (`/sites/warm-pantry/`, `/sites/regional-bank/`), so donate redirects and email links work on any machine. Repoint when you pick the demo host (D14): edit `seed/data.ts`, `npx convex dev --once`, `npx convex run seed:load`.
- **T23 done:** `scripts/e2e-smoke.mjs` passes 8/8 (run twice in a row, plus twice more after fixes). Hidden health page: https://chartitable.vercel.app/staff/health (PIN). `ops:health`, `ops:milestoneDryRun` (PIN-gated).
- **Audit fixes shipped:** guard binds numbers to units and rejects "you provided 80 meals" style record credit (tightening only; demo donor still gets a Claude story); `donations:create` capped at 120/hour and stores only allowlisted emails; `/donor-view` returns 429/503 `{retry:true}` on rate limit/backend error so the layer keeps the token.
- **Cursor T8/T4** still uncommitted in the working tree; pre-gate findings are in PROGRESS.md Blockers. Formal gate pending their commit.

## Next, in order
1. **Rotate STAFF_PIN** (currently 4 digits; brute-forceable once the repo/deployment URL is public): `npx convex env set STAFF_PIN '<12+ char passphrase>'`, tell Teammates 1 and 2. Before T17.
2. **Resend:** key in `.env` → `npx convex env set RESEND_API_KEY ...` and `DEMO_INBOXES <account-owner inbox>` → `npx convex run milestones:setDemoEmail '{"donorId":"donor_a01","email":"<inbox>"}'` before demo step 2. Then run the smoke script once: check 7 must still show sent=0 (smoke-skipped).
3. When Cursor commits T8/T4: gate (diff, `npm test`, `npm run typecheck`, `npm run build:site`, live preview with `npx convex run tokens:issue '{"donorId":"donor_a01","charityId":"demo-pantry-a"}'`, do not paste the link anywhere public).
4. Decide: product name (one letter from the "Charitable" donation-software trademark), demo host (D14), D15.
5. X Premium / Grok Bot at the SpaceXSI booth; ask how to enter the Anthropic track.

## Resume commands
```bash
cd "~/Claude Code/Chartitable" && git pull --rebase --autostash && npm install && npm test && npm run typecheck
STAFF_PIN="$(npx convex env get STAFF_PIN)" node scripts/e2e-smoke.mjs   # dev only; never prints the PIN or tokens
```

## Gotchas
- `npx convex run` runs the DEPLOYED code: push first with `npx convex dev --once` after editing `convex/`, `engine/` or `seed/`.
- Don't push Convex while another agent is mid-edit on `engine/` (the push bundles the working tree).
- Smoke rows carry `smoke: true`; `npx convex run seed:cleanSmoke '{}'` removes them. The milestone check skips while a smoke log exists (small race: a cron run already in progress when the smoke log lands is not skipped; only matters once email is configured).
- Cursor edits this checkout at the same time: stage explicit paths only; never `git add -A`, stash, reset or checkout files.
- `/donor-view` never waits on Claude: the first view after a data change is the template; pre-warm the demo donor (`npx convex run narrative:getOrGenerate '{"donorId":"donor_a01","charityId":"demo-pantry-a"}'`).
- Calibration: `engine/calibration.test.ts` pins 22.9 → 26.8 meals. Reseeding re-anchors dates to now (same numbers).

## Open (LOW, not fixed)
- `impact:log` accepts any `photoStorageId` (a PIN holder could attach a receipt file); lowercase invented names pass the guard; 30-day token TTL with no revocation; donor first name goes to Anthropic in the facts.

## Vercel owner-commit rule
Vercel Hobby blocks deployments for commits not authored by you. After a teammate pushes to `main`, push an owner-authored commit (`git commit --allow-empty -m "Redeploy" && git push`).
