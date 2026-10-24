# Cursor follow-up message: finish T8/T4, apply the pre-gate fixes, rename hosts, commit

Paste into the **same Cursor chat** that is building `layer.js` and the staff page (or a new one; then first say "continue Part 1 and Part 2 of `docs/CURSOR_LAYER_STAFF_PROMPT.md`; read it and `docs/cursor-grok-log.md`"). Model: Grok 4.7, Fast off. Composer 2.5 for the renames.

---

Your T8 `layer.js` and T4 staff page are uncommitted work in progress. A read-only review (Haiku, Sat 2:55 AM) found that contract v1, no `innerHTML`, first-time-visitor-makes-no-request, labeled estimates and the API base all PASS. Do the following, in order, self-checking each, then commit and push.

**A. Fix these six items**
1. `staff/update.js` (~line 246): if `loadRecent` fails after a successful `impact:log`, the generic error shows and staff may log twice. Use `return loadRecent(pin).catch(function(){})` so a logged update always shows success.
2. `layer/src/layer.ts` (~lines 66–71): `takeUrlToken()` runs after the unknown-charity / no-slots early returns, so `?ct=` stays in the address bar there. Strip and store the token **first**, before any early return.
3. `layer/src/layer.ts` `safeUrl` (~line 405): it lets `/\host` through (protocol-relative). Reject a leading `/\` as well as `//`; only allow `https:`/`http:` absolute URLs and same-origin paths starting with a single `/`.
4. `layer/src/fallback-styles.ts` (~line 16): `!important` on animation/transition overrides host styles. Scope to `.ct-*` selectors, no `!important` on the host's elements.
5. Donate URL: production is `https://chartitable.vercel.app/staff/donate` (clean URL); `donate.html` is only for local dev ports. Make the build default `CT_DONATE_URL` accordingly; keep the local override.
6. Size: report `dist/layer.js` gzip bytes (`gzip -c layer/dist/layer.js | wc -c`); target < 8 KB. If over, say by how much and where.

Also: if `docs/design/ct-slots.css` exists (Teammate 1's design, task T22), bundle it as the default styles (`--loader:.css=text`); if it doesn't, keep the fallback styles.

**B. Rename the test hosts** (task T21, you own `demo-sites/test-hosts/**`). Replace in all HTML, JSON and JS inside that folder, including the README and `_preview` samples: Trestlebin Regional Food Bank → **Brindlecote Food Bank**; Pellam Street Pantry → **Quillon Street Pantry**; optionally Osier Court Community Center → **Wrenfield Lane Pantry**. Keep Cinderwell Pantry. Do not touch `/frontend` (Teammate 1 renames Tansy Street Pantry there). Run a final search that none of the old names remain anywhere you own.

**C. Verify** (Agent mode, real browser or screenshots into `docs/cursor-shots/`):
- Local: `npm run build`, `npm test`, `npm run typecheck`.
- First-time visitor on all four hosts: zero requests to the API, zero console output, page identical.
- Returning donor: get a link with `npx convex run tokens:issue '{"donorId":"donor_a01","charityId":"demo-pantry-a"}'` (do not print or save the token) and open it on a `demo-pantry-a` host. First view shows a template story; reload once for Claude's.
- Hostile story text renders as literal text.
- Staff page: PIN login (type it; never store it), log "served 80 meals" is **not** to be done against donor_a01's data right now; use the smoke tag or ask Revnn. Test validation errors and the double-submit guard instead.

**D. Commit and report.** Commit in small pieces with plain messages (no Claude attribution; author is Cursor/Grok). `git pull --rebase --autostash` then push. Update `docs/cursor-grok-log.md` (models used, what ran) and append one `[A]` line to PROGRESS.md; set T8 and T4 to `review` and T21 hosts to done. Report: files changed, gzip size, screenshots, anything still failing.
