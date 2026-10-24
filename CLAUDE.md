# CLAUDE.md — Chartitable (Cal Hacks 13.0)

Personalization layer that shows returning donors their impact on a small charity's own website, plus a staff dashboard. **Deadline: Devpost submission Sun Oct 25, 9:00 AM PT (hard).** Prefer a working narrow product over a broad broken one.

## Read map (read with intention; skip what isn't yours)
Always, every session, every lane: this file → your handoff file in `docs/handoff/` → `PROGRESS.md` **only these parts**: Snapshot, Blockers, the integration contract, Decisions you need, the task rows for **your lane** (see the Tasks row below), and the last ~20 lines of the Handoff log. Don't read the whole log or other lanes' task rows unless a blocker points there.

| Role | Also read | Do not read (unless a blocker points there) |
|---|---|---|
| Lane A (Revnn, Opus orchestrator and its Sonnet/Haiku subagents) | `docs/PRODUCT_SPEC.md`, `engine/types.ts`, `PROMPTS.md` (the task you're delegating), `convex/CONVEX_NOTES.md` when touching Convex; `/frontend` only when wiring pages to the API (T7b/T8/T19) | `docs/DASHBOARD_SPEC.md` (except its data contract when working on T19), `docs/handoff/teammate1.md`, `docs/TEAMMATE_DASHBOARD_PROMPT.md`, `/frontend` styling |
| Lane B (Teammate 1 and its agents) | `docs/DASHBOARD_SPEC.md`, `docs/TEAMMATE_DASHBOARD_PROMPT.md`, `docs/demo-site-reference.md`, the contract in `PROGRESS.md` | `docs/PRODUCT_SPEC.md`, `PROMPTS.md`, `engine/`, `convex/`, `docs/handoff/revnn.md`. Static HTML in `/frontend` is read as a UI reference only |
| Teammate 2 (QA, Devpost, video, pitch) | `README.md`, `PRIZE_RULES.md` §12, the demo-done checklist and T13–T15 rows in `PROGRESS.md`, both handoff docs, `docs/PRODUCT_SPEC.md` §10 | Source code, `PROMPTS.md` |
| Haiku research agent | Only the files named in its prompt; shared research (`docs/research/README.md` index) | Everything else; it never edits |
| Sonnet coding agent | `PROGRESS.md` task row, the files it may edit, and the excerpt of the spec/contract pasted into its prompt | Other lanes, other tasks, the full spec unless the prompt says so |

Orchestrators should paste the relevant spec excerpt into a Sonnet prompt instead of telling it to read whole documents.

**Log tags:** start every Handoff log line with the lane: `[A]` product, `[B]` dashboard/demo sites, `[C]` docs/pitch/QA, `[ALL]` cross-cutting. To see your lane's recent progress: `grep -E '^\- \[.*\] (\[A\]|\[ALL\])' PROGRESS.md | tail -15`. Older untagged lines belong to the whole team. Task rows already carry an Owner; task ids map to lanes in the table above.


## Two lanes, one repo
| | Lane A: Product (Revnn) | Lane B: Dashboard (Teammate 1) |
|---|---|---|
| Scope | Engine, Convex backend, `layer.js`, donate/staff pages, narrative + guard, tokens, email, seed, deploys | Charity dashboard: Figma design first, then implementation on mock data |
| Owns | `/convex`, `/engine`, `/layer`, `/staff`, `/seed` | `/frontend` (first-pass pages, GitHub user `naelqdl`), `/dashboard`, `/demo-sites`, `docs/DASHBOARD_SPEC.md` |
| Tasks | T1–T9, T12, T16, T17, T19 | T10, T11, T18 |
| Branch | `main` | `dashboard` (merged to `main` by Revnn) |
| Spec | `docs/PRODUCT_SPEC.md` | `docs/DASHBOARD_SPEC.md` |
| Handoff doc | `docs/handoff/revnn.md` | `docs/handoff/teammate1.md` |
| Tools | Claude Code (Opus orchestrator + subagents) and Cursor/Grok | Figma, Cursor or Claude Code, Impeccable |

Teammate 2 (arrives Sat afternoon) owns `/docs` write-ups for T13–T15 (QA, Devpost, video, pitch) and reads both handoff docs first.

**Shared by everyone, read and write:** `docs/research/` and the research files it indexes (`PRIZE_RULES.md`, `docs/demo-site-reference.md`, new notes). Research is append-and-correct: add dated lines, don't rewrite others' findings; label anything inferred vs. verified.

**Never edit a file owned by the other lane.** If you need a change there, add a row to PROGRESS.md **Blockers** and keep working against mocks. The integration contract (below) is the only shared surface between lanes.

## Agent roles (Claude Code sessions)
- **Opus 5.5 = orchestrator** (`claude-opus-5-5`, high effort). Plans, decomposes, reviews every diff, runs the acceptance check itself, integrates, commits, keeps PROGRESS.md true. Writes code only for shared types/interfaces and small glue or precise fixes. Delegates everything else.
- **Sonnet 5.5 = coding agent** (`model: "sonnet"`). One scoped task per prompt: one module, endpoint or screen. Edits only the files it is given.
- **Haiku 5.5 = research and verification, read-only** (`model: "haiku"`). Docs/SDK lookups, web research, summarizing files, diff-vs-contract checks, acceptance verification, secret/PII scans, honesty audits. **Haiku never edits files and never changes git or account state.** Research results go into `docs/research/` via the orchestrator or a human.
- Prompt templates for every task and role: `PROMPTS.md` (Part B Sonnet template, Part B2 Haiku template, Part C task prompts). Every delegation names: goal, files it may touch, files it must not touch, interface, acceptance check, "read PROGRESS.md first; append one Handoff log line when done."
- Run subagents in parallel only when their file sets are disjoint.
- Model for the product's narrative feature is `claude-sonnet-5-5` (D8).

### After every subagent returns (gate)
1. Read the diff (`git diff`); reject anything outside its file list.
2. Run the acceptance check yourself (`npm test`, `npm run typecheck`, `npm run build`). Don't trust the report.
3. Haiku check: diff vs integration contract, no secrets, no real org names, no PII in URLs.
4. Commit small and descriptive. Update PROGRESS.md (task status, Last updated, one Handoff log line).

## Non-negotiable rules
1. **Honesty (D1/D8):** donations are pooled, so gifts are credited proportionally and every computed number is labeled "estimate"/"about". Records (logged facts) and estimates are visually separate. Claude only narrates facts from the facts payload; the deterministic guard rejects anything else and a template takes over. If data is missing, say less. Next steps are never guilt-based. Dashboard numbers follow the same labels.
2. **Fictional only (D5):** charities, donors, names, photos, logos. No real organization names, branding or data. Do not copy real sites' code, copy or images; use them as structural reference only.
3. **Fresh code (hackathon rule):** all implementation happens during the hackathon. Never copy or vendor code from In Good Company or Recryption.
4. **Secrets:** only in `.env` (gitignored). Never commit, paste or print keys. Run a secret/PII scan before every public step.
5. **Privacy (D6):** donor links carry only a signed opaque `?ct=` token. No names, emails or personal data in URLs, logs or screenshots.
6. **First-time visitors see the unmodified site.** Layer slots are empty by default.
7. **Email** is sent only to addresses in `DEMO_INBOXES` (D4). Payments are test mode only.
8. **GitHub:** the repo is private until task T17 (public before Devpost; secret scan first). Don't make it public, invite collaborators or force-push without the lead's say.

## Integration contract v1 (locked; only shared surface between the lanes)
See `PROGRESS.md` → *Integration contract*. Slots: `data-impact-slot="hero" | "since-last-visit" | "next-step"`, `data-impact-donate`, state hooks `data-impact-active` / `data-impact-state="ready"`, class prefix `ct-`, storage key `chartitable:<charity-id>`, token param `?ct=`, theming vars `--ct-*`. Charity ids `demo-pantry-a`, `demo-pantry-b`. Any change: bump the version, log it, tell the other lane immediately.

## Stack and commands
Monorepo, npm workspaces (no pnpm). `engine` is pure TypeScript (no Convex imports) tested with Vitest; `layer` bundles to one IIFE via esbuild; Convex for backend (D2); Vercel for static hosting (D3); Resend for email (D4).
```bash
npm install
npm test            # Vitest (engine + seed)
npm run typecheck
npm run build       # layer/dist/layer.js
npm run dev:layer   # serves layer on http://localhost:5174 (CORS on)
```
`npx convex dev` is interactive (login) and is a human step.

## Handoffs and logs
- **PROGRESS.md** is the team-wide source of truth: Decisions, Task board, Blockers, Handoff log. Claim a task by setting Owner before starting. Append to the log (`- [Sat 10:42 AM PT] <who/tool>: what changed, files, what's next`); never rewrite others' lines.
- **Personal handoff docs** (`docs/handoff/<name>.md`): each person keeps their own current-state note: what's done, in progress, next steps, exact commands to resume, open questions, and gotchas. Update it whenever you stop working or switch tools (Claude Code ↔ Cursor ↔ Figma). A fresh session or a teammate should be able to continue from it plus PROGRESS.md alone.
- **Research** goes in `docs/research/` (index in `docs/research/README.md`).

## Cut order if behind (drop from the bottom first)
Cartesia → dashboard Next/stretch items → site #2 visual polish → photos in email → CSV import → staff page photo upload (use seeded photos). **Never cut:** the guard, labeled estimates, first-time-visitor behavior.

## Hackathon requirements to keep in mind
Devpost needs: project image, public GitHub repo, demo (video recommended), team. Pitch is 3 min + 2 min Q&A. Be at the venue by Sun 8 AM. Details and sponsor-track rules: `PRIZE_RULES.md` (§12 is the official Devpost page and wins on conflicts).

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
