# One prompt for Teammate 1: charity dashboard

Setup (once, in your terminal):
```bash
git clone https://github.com/Comradevnn/chartitable.git && cd chartitable
git checkout -b dashboard
```
(You need collaborator access to the private repo; ask Revnn for the invite.) Open the folder in Cursor or Claude Code, then paste everything below the line as your first message. Install Impeccable when the prompt tells you to.

---

You are helping Teammate 1 build the **charity dashboard** for Chartitable at Cal Hacks 13.0 (deadline: Devpost submission Sun Oct 25, 9:00 AM PT). Teammate 1 designs in **Figma first**, then implements in code.

READ FIRST, in this order: `PROGRESS.md` (decisions, contract v1, task board, handoff log), `docs/DASHBOARD_SPEC.md` (the spec you are building, including the mock-data contract and MVP screens M1–M3), `docs/demo-site-reference.md` (visual directions for the two fictional charities), `PRIZE_RULES.md` §3 and §12 (Figma tracks and judging criteria).

WHAT TO BUILD: the staff dashboard described in `docs/DASHBOARD_SPEC.md`. MVP = Overview, Donors (with top donors), Expenses. Next/stretch items are listed there; do them only after the MVP is polished, in the listed order.

WORKFLOW
1. **Install Impeccable** (https://github.com/pbakaus/impeccable): from the repo root run `npx impeccable install`, then `/impeccable init` in your AI tool. It writes `PRODUCT.md`; fill it from the spec (audience: pantry coordinator and grant writer; purpose: see who gave, what was spent, what it did; constraint: honest labels, fictional data only).
2. **Figma first.** Use `/impeccable shape` to plan the three MVP screens, then design them in Figma (desktop-first, tablet-usable): overview, donors table + donor detail, expenses ledger + quick-add. Design empty and sparse states too. Record the Figma file link in `docs/DASHBOARD_SPEC.md` under a new "Figma" heading and add the design tokens (colors, type, spacing) to `DESIGN.md` via `/impeccable document` once code exists.
3. **Implement in `/dashboard`** (new folder you own): Vite + React + TypeScript, no heavy UI kit. Build against **mock JSON** that follows the "Data contract" in the spec (put it in `dashboard/src/mock/`); put all data access behind one small adapter file (`dashboard/src/data.ts`) so Revnn can swap in Convex queries without touching components. Use `/impeccable craft`, then `critique`, `audit`, `harden`, `polish` per screen.
4. Run it locally, check at 1280px and 768px, keyboard navigation, and the empty state for each screen.

HARD RULES
- **Honesty:** any computed number (cost per meal, status, totals derived from estimates) shows the word "estimate" or "about" and its formula on hover/tap; logged facts are visually separate. Show less when data is missing.
- **Fictional only:** invented charity and donor names (not resembling real orgs), generated or placeholder images. No real donor data, no real logos. Never put donor names/emails in URLs.
- **File ownership:** you may edit `/dashboard`, `docs/DASHBOARD_SPEC.md`, and add files under `/demo-sites/*` if asked. Do **not** edit `/convex`, `/engine`, `/layer`, `/staff/update*` (Revnn/Cursor). If you need a data shape change or a new query, add a row to PROGRESS.md **Blockers** and keep working with mock data.
- **No secrets** in code or commits. Do not commit `.env*`.
- Reuse over novelty: a small fixed component set (stat tile, table, simple chart, timeline). Tables beat charts for small data. Avoid generic AI-template tells (Impeccable's detector will flag them).

GIT
- Work on branch `dashboard`. Commit small and often, push (`git push -u origin dashboard`), and pull `main` regularly (`git pull --rebase origin main`). Revnn merges to `main`; only touch files you own so merges are clean.
- After each finished piece, append ONE line to the PROGRESS.md **Handoff log** (`- [Sat 3:10 PM PT] Teammate1/<tool>: what changed, files, what's next`) and update the T18 row status. Never rewrite others' log lines.

TIME BOX (PT): Sat by 1 PM: Figma for M1–M3 done. By 7 PM: all three MVP screens built on mock data and critiqued. 10 PM feature freeze (design polish only after that). If behind, cut in this order: donor detail preview, expense receipt photos, Next items, extra charts. Never cut the record-vs-estimate labels.

FIRST STEPS NOW: (1) read the files above, (2) run the Impeccable install and init, (3) tell me the plan for the Figma screens and any question that blocks you, (4) start designing. Ask me before doing anything outside this prompt.
