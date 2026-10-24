# Handoff: Revnn (Lane A: product)

Last updated: Sat Oct 24, ~3:40 AM PT (Opus prompt #3). Update this file whenever you stop or switch tools. Team-wide status lives in `PROGRESS.md`.

## Where things stand (Sat ~3:40 AM PT)
- **Everything on the donor path is live and gated:** Convex dev `acoustic-donkey-399` (283 tests), Vercel https://chartitable.vercel.app. T8 `layer.js` and T4 staff page passed the formal gate (Haiku 9/9; live browser test). Screenshots: `docs/qa/lane-a/`.
- **Live check (Sat 3:32 AM):** first-time visitor on Cinderwell → 0 API requests, empty slots, donate link rewritten, no console errors. donor_a01 link → Claude story, 12 records, 6 photos, "about 22 meals (estimate)", `ct` stripped.
- **Email:** Resend + DEMO_INBOXES set; donor_a01 has the demo inbox. Live dry run: 0 would send now. `engine/demo-email.test.ts` proves the post-80-meal email (meals:25, "about 26 meals (estimate)", link with only `ct`). Real send happens at demo step 2; none tested yet.
- **Fixed today from the gate:** seed photos served (`/seed/photos`, `ASSET_BASE_URL`); host `preview.js` symlinks (console 404s on Vercel); `impact:log` server photo check + optional `requestId`; reseed no longer wipes the demo inbox; `seed:resetDemo` for rehearsals.
- Decided by lead: D17 keep the name, D18 keep the 4-digit PIN (no rotation).
- Open for Cursor/Teammate 1: Blockers row "T8/T4 gate follow-ups" (all LOW), `/frontend` Tansy rename, `dashboard:donorDetail` query (Revnn, T19).

## Demo-day commands (in order)
```bash
cd "~/Claude Code/Chartitable" && git pull --rebase --autostash
STAFF_PIN="$(npx convex env get STAFF_PIN)" node scripts/e2e-smoke.mjs        # 8/8 PASS; run it BEFORE, never during, the demo
npx convex run seed:resetDemo '{"confirm":"reset-demo"}'                      # only between rehearsals: clears non-seed rows + fired milestones
npx convex run seed:load                                                      # re-anchor seed dates to now (keeps the demo inbox)
npx convex run narrative:getOrGenerate '{"donorId":"donor_a01","charityId":"demo-pantry-a"}'   # pre-warm: should print source "claude"
```
Then on stage: (1) donate $25 at https://chartitable.vercel.app/staff/donate?charity=demo-pantry-a → back on Cinderwell with the short first view; (2) staff page https://chartitable.vercel.app/staff/update?charity=demo-pantry-a (type the PIN) → "served 80 meals" + photo → email to the demo inbox within seconds; (3) open the email link → hero story, records, labeled estimates, next step; (4) post another update → reload → "since your last visit"; (5) private window → plain site; (6) same embed on Brindlecote (`/sites/regional-bank/`). Health: https://chartitable.vercel.app/staff/health.
Watch-outs: a smoke run during step 2 makes the milestone check skip (smoke data present) → no email; step 1's new donor dilutes donor_a01's share a little (margin holds up to ~$450 of extra pantry-A gifts); each rehearsal burns meals:25 until `seed:resetDemo`.

## Next, in order
1. Rehearse the six steps once on Vercel (T13 with Teammate 2), then `seed:resetDemo` + `seed:load` + pre-warm.
2. `dashboard:donorDetail(pin, donorId)` for Lane B (T19 Blockers row) if time.
3. X Premium / Grok Bot at the SpaceXSI booth; Anthropic track entry.
4. Before T17 (public repo): secret scan (tree + history).

## Resume commands
```bash
cd "~/Claude Code/Chartitable" && git pull --rebase --autostash && npm install && npm test && npm run typecheck
STAFF_PIN="$(npx convex env get STAFF_PIN)" node scripts/e2e-smoke.mjs   # dev only; never prints the PIN or tokens
```

## Gotchas
- `npx convex run` runs the DEPLOYED code: push first with `npx convex dev --once` after editing `convex/`, `engine/` or `seed/`.
- Don't push Convex while another agent is mid-edit on `engine/` (the push bundles the working tree).
- Smoke rows carry `smoke: true`; `npx convex run seed:cleanSmoke '{}'` removes them. The milestone check skips while a smoke log exists (small race: a cron run already in progress when the smoke log lands is not skipped; email IS configured now, but smoke donors have no email and donor_a01 can't cross 25 from a 3-meal smoke log).
- Cursor edits this checkout at the same time: stage explicit paths only; never `git add -A`, stash, reset or checkout files.
- `/donor-view` never waits on Claude: the first view after a data change is the template; pre-warm the demo donor (`npx convex run narrative:getOrGenerate '{"donorId":"donor_a01","charityId":"demo-pantry-a"}'`).
- Calibration: `engine/calibration.test.ts` pins 22.9 → 26.8 meals. Reseeding re-anchors dates to now (same numbers).

## Open (LOW, not fixed)
- `impact:log` accepts any `photoStorageId` (a PIN holder could attach a receipt file); lowercase invented names pass the guard; 30-day token TTL with no revocation; donor first name goes to Anthropic in the facts.

## Vercel owner-commit rule
Vercel Hobby blocks deployments for commits not authored by you. After a teammate pushes to `main`, push an owner-authored commit (`git commit --allow-empty -m "Redeploy" && git push`).
