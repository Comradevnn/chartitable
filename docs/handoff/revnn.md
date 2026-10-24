# Handoff: Revnn (Lane A: product)

Last updated: Sat Oct 24, ~12:50 AM PT. Update this file whenever you stop or switch tools. Team-wide status lives in `PROGRESS.md`.

## Where things stand
- Done in code: T1 scaffold, T5 allocation, T7a signed tokens, T2+T12 schema + seed, T6a facts/prompt/guard/template. 156 tests green.
- Repo: https://github.com/Comradevnn/chartitable (private). `.env` exists locally (gitignored).
- Blocked on you: `npx convex dev` login (live deploy + `seed:load`), Vercel login (needed by ~Sat 2 PM), Resend inbox name, Grok Bot / X Premium pickup.

## Next, in order
1. Convex login and first deploy; run the seed loader.
2. T6b `convex/narrative.ts` (Claude call + guard + template fallback, cache by factsHash) → checkpoint C2.
3. T7b tokens/visits + `/donor-view` endpoint; T3 donate page; T9 milestone email.
4. T4 staff page and T8 `layer.js` in Cursor (SpaceXSI paper trail: screenshots, commits, notes → `docs/` log, T16).
5. T19 dashboard backend once Teammate 1's mock contract is stable.
6. T17 before Sun 8:30 AM: secret scan, README, make repo public.

## Resume commands
```bash
cd "~/Claude Code/Chartitable" && git pull --rebase && npm install && npm test
```
Start a Claude Code session here with Opus 5.5; it should read CLAUDE.md, PROGRESS.md, this file, and `PROMPTS.md` Part A.

## Gotchas
- Don't edit a file claimed by Cursor (T4, T8) from Claude Code, and vice versa.
- Teammate 1 works on branch `dashboard`; merge it into `main` when they report, after the gate in CLAUDE.md.
- Cartesia is a stretch only (D11); no Grok Voice.

## Open questions
- Dashboard login: PIN stub (recommended) vs magic link.
- Which Figma track the dashboard targets.
