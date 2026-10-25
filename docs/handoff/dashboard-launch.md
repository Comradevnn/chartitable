# Dashboard launch guide (Lane B staff dashboard)

For Revnn (Lane A lead; owns Convex and Vercel). Written Sat Oct 24, 8:15 PM PT. Devpost deadline: Sun Oct 25, 9:00 AM PT. Run the steps top to bottom. Never paste the PIN or any key in chat, commits or files.

## 1. Where we are

Dashboard v2 is merged into `main` (`0a62e9b`, same as `origin/dashboard`) but Vercel has not deployed it, so the live [/dashboard/](https://chartitable.vercel.app/dashboard/) is the older build. Five of the Convex functions v2 calls are not built yet (see section 6), so a launch today ships the existing features live and leaves the new controls switched off.

## 2. Pre-flight checklist

- [ ] Dashboard is on `main`. First fetch. Expect fetch progress lines or no output:

```bash
git fetch origin
```

  Then the ancestor check. Expect no output:

```bash
git merge-base --is-ancestor origin/dashboard origin/main
```

  Then read its exit code. Expect `0` (anything else means the dashboard is not on `main`):

```bash
echo $?
```

- [ ] The deploying commit must be authored by the Vercel owner (D16 in [PROGRESS.md](../../PROGRESS.md)). Today's `main` head is authored by `naelqdl`, which Vercel Hobby blocks. Your push must come from the owner account (`Comradevnn` per git history; confirm in Vercel, unverified). On the owner's machine, expect the owner's name:

```bash
git config user.name
```

- [ ] Secret scan over tracked files (file names only). Expect `0` (run on 2026-10-24: `0`). It does not scan history or untracked `.env`:

```bash
git grep -IlE 're_[A-Za-z0-9]{16,}|sk-ant-[A-Za-z0-9]|xai-[A-Za-z0-9]{16,}|(TOKEN_SECRET|STAFF_PIN)=[A-Za-z0-9]{6,}' | wc -l
```

- [ ] Convex login works. Expect your email, or a login prompt (human step, see [CLAUDE.md](../../CLAUDE.md)):

```bash
npx convex login
```

## 3. Step-by-step launch

1. Switch to `main`. Expect `Switched to branch 'main'` or `Already on 'main'`:

```bash
git checkout main
```

   Then pull. Expect `Already up to date.` or a list of updated files:

```bash
git pull origin main
```

2. Install root deps. `scripts/build-site.mjs` installs `dashboard/` deps itself (`npm ci`), so do not run `npm install` there:

```bash
npm install
```

3. Build exactly as Vercel does:

```bash
node scripts/build-site.mjs
```

   Expect the last line to end with `dashboard: yes`. If it prints `build-site WARNING: dashboard build failed`, the build still exits 0 and Vercel would ship without `/dashboard`. Stop and fix.

4. Check the asset paths. Expect two lines, both starting `/dashboard/assets/`:

```bash
grep -oE '(src|href)="[^"]*"' dist-site/dashboard/index.html
```

5. Deploy Convex functions. Dev deployment `acoustic-donkey-399` is the only one found; a prod deployment is unverified. The dashboard build defaults to the dev URL, so dev is what the live site calls. Human step:

```bash
npx convex dev --once
```

   For prod instead (unverified, none exists in the repo): run `npx convex deploy`, then set `VITE_CONVEX_URL` in Vercel to the prod `.convex.cloud` URL.

6. Set Convex env vars. Names only here. Type values in your terminal, never in chat. `STAFF_PIN` already exists on dev ([revnn.md](revnn.md)); set it only if missing. The email vars are unverified (no Convex login on the Lane B machine):

```bash
npx convex env set STAFF_PIN <value>
```

```bash
npx convex env set RESEND_API_KEY <value>
```

```bash
npx convex env set DEMO_INBOXES <comma-separated demo inbox addresses>
```

```bash
npx convex env set RESEND_FROM <value>
```

   `RESEND_FROM` is optional. Default sender when unset: `Chartitable Demo <onboarding@resend.dev>`. Per Resend docs, that sandbox sender only delivers to the Resend account owner's own address (unverified; check the Resend dashboard).

7. Confirm names are set. `env list` prints values, so cut them off. Expect `STAFF_PIN`, `RESEND_API_KEY`, `DEMO_INBOXES` (and `TOKEN_SECRET`):

```bash
npx convex env list | cut -d= -f1
```

8. Push an owner-authored commit (D16). Only from the owner's git identity:

```bash
git commit --allow-empty -m "Redeploy dashboard v2"
```

```bash
git push origin main
```

9. Confirm the author, expect the owner's name:

```bash
git log -1 --format='%an %h'
```

10. In Vercel, open the latest deployment. Expect Ready (green), not Blocked. Then check the new bundle. First the status line. Expect `HTTP/2 200`:

```bash
curl -sI https://chartitable.vercel.app/dashboard/ | head -1
```

   Next, count the dev deployment name in the bundle. Expect `1`:

```bash
curl -s "https://chartitable.vercel.app$(curl -s https://chartitable.vercel.app/dashboard/ | grep -oE '/dashboard/assets/index-[A-Za-z0-9_-]+\.js' | head -1)" | grep -c acoustic-donkey-399
```

   Last, count `sendThankYou`, which proves v2 shipped. Expect `1` (the stale build gives `0`):

```bash
curl -s "https://chartitable.vercel.app$(curl -s https://chartitable.vercel.app/dashboard/ | grep -oE '/dashboard/assets/index-[A-Za-z0-9_-]+\.js' | head -1)" | grep -c sendThankYou
```

## 4. Demo vs live

- The mode is fixed at build time by `VITE_CONVEX_URL`. In [dashboard/src/data.ts](../../dashboard/src/data.ts) line 29, no URL means no client, so demo mode (any non-empty PIN works).
- You cannot get demo mode by unsetting `VITE_CONVEX_URL` in Vercel. [scripts/build-site.mjs](../../scripts/build-site.mjs) line 124 uses `process.env.VITE_CONVEX_URL || "https://acoustic-donkey-399.convex.cloud"`, so an unset or empty value falls back to the dev URL. Changing that line is a code edit (not done here).
- Badges in the app: `Live data · Convex` (live) or `Demo data`. Fallback mode (backend failed) also shows `Demo data`, plus the line "Live data couldn't load, showing sample data. Changes can't be saved until it loads. Refresh to try again." Writes are refused in fallback.
- The PIN is typed in the browser only. It is held in memory (`data.ts` line 21) and sent to Convex on each call. Never paste it in chat, commit it, or put it in any env file. The only place it lives is Convex `STAFF_PIN`.

## 5. Verification checklist

Do this in a browser after step 10. Rows marked (needs Lane A) cannot pass until section 6 functions are deployed.

| Step | Expected |
|---|---|
| Open https://chartitable.vercel.app/dashboard/ | Sign-in page loads, no console errors, copy "Staff sign-in. Enter the pantry's staff PIN." |
| Badge after sign-in | `Live data · Convex`. If `Demo data`, see troubleshooting row 5 |
| Wrong PIN | "That PIN didn't work. Try again." Stays signed out |
| Right PIN | Overview, Donors and Expenses tabs load with numbers |
| Add expense, attach a receipt | Row appears; Receipt link opens; totals change |
| Remove, then Undo (needs Lane A) | Row leaves and returns; Overview totals and cost per meal reconcile both ways |
| Open a donor, thank-you preview (needs Lane A) | Gift history and draft load; address hidden |
| Send one test thank-you to a `DEMO_INBOXES` donor (needs Lane A) | Result "sent"; email arrives; donor shows thanked |
| Send to a donor not on the allowlist (needs Lane A) | `skipped_not_allowlisted` ("Not sent"), no email |
| Before Lane A ships | Thank-you and donor-detail controls say "Needs a backend update that isn't deployed yet."; Remove is hidden |

## 6. Known gaps / NOT verified

- Not built (Lane A work, contract in the [PROGRESS.md](../../PROGRESS.md) Blockers row "Lane B dashboard v2", line 190): `dashboard:removeExpense`, `restoreExpense`, `donorDetail`, `previewThankYou`, `sendThankYou`; the `thankYouEmails` table; `expenses.removedAt`. `convex/dashboard.ts` has only `overview`, `donors`, `expenses`, `addExpense`, `markThanked`, `generateReceiptUploadUrl`.
- The dashboard turns the controls on by itself once the functions are deployed. Its capability probe calls each with only `{pin, charityId}`. Keep `id` and `donorId` REQUIRED in the validators, or the probe will misread a missing arg.
- Live mutations and a real-PIN sign-in have not been verified in a browser (PROGRESS.md `[B]` lines, Sat 3:00 PM and 7:45 PM).
- Email env on Convex (`RESEND_API_KEY`, `DEMO_INBOXES`) is unverified; no Convex login from the Lane B machine.
- Dashboard queries have no PIN lockout. Only `convex/demo.ts` has one, so the "Too many wrong tries" message cannot come from the dashboard functions today.
- `thankedAt` is per donor, not per charity.
- The live bundle is stale: no receipt, remove or thank-you calls.
- The live bundle at https://chartitable.vercel.app/dashboard/ contains the dev deployment name `acoustic-donkey-399` (checked with curl on Sat Oct 24), so it is built in live mode, but it is a stale build without the v2 controls. PROGRESS.md line ~279 says demo mode; that note predates this check.
- `npm run typecheck` fails: observed on Sat Oct 24 on Nael's Windows machine (cmd.exe can't expand `ls convex/*.ts`). In Git Bash run `npx tsc --noEmit -p tsconfig.json` and `npx tsc --noEmit -p convex/tsconfig.json`.
- Root `npm test`: layer tests need `happy-dom` (6 layer errors if missing; [teammate1.md](teammate1.md)).

## 7. Rollback (under a minute)

- Vercel dashboard, Deployments tab: open the last good deployment and promote it ("Instant Rollback"). Unverified; not in repo docs.
- CLI alternative: `npx vercel rollback` (unverified).
- Force demo mode: edit `scripts/build-site.mjs` line 124 so the fallback is an empty string instead of the dev URL. Needs an owner-authored commit (step 8) to deploy.

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Vercel shows "Blocked" | Commit not authored by the owner (D16) | Step 8 from the owner's identity (`--allow-empty`) |
| Blank page, or 404 on `/dashboard/assets/...` | Wrong Vite base, or the dashboard build failed and `/dashboard` was dropped | Live today: `/dashboard` and `/dashboard/` both return 200 with no redirect (`cleanUrls` does not interfere); a missing asset returns 404. Rerun steps 3 and 4; asset URLs must start with `/dashboard/` |
| "Could not find public function", or controls say "Needs a backend update that isn't deployed yet." | Convex functions not deployed (section 6) | Build them (Lane A), run step 5, click Refresh in the app |
| Thank-you returns `not_configured` or `failed` | `not_configured`: `RESEND_API_KEY` or `DEMO_INBOXES` missing. The reason text "Email is not configured (set RESEND_API_KEY and DEMO_INBOXES)." comes from the existing demo control `convex/demo.ts:429`; the dashboard `sendThankYou` that would return `not_configured` is not built yet. `failed`: Resend sandbox sender only delivers to the account owner (per Resend docs; unverified; check the Resend dashboard) | Step 6 and 7; verify a sending domain and set `RESEND_FROM`, or send to the Resend account owner's address |
| Badge stuck on `Demo data`, CORS error, or wrong backend | Backend unreachable, wrong `VITE_CONVEX_URL`, or Convex not pushed | Run the bundle check in step 10 (expect `1`); open the browser console; rerun step 5 |
