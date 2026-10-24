# Handoff: Teammate 1 (Lane B: dashboard + demo sites)

Last updated: Sat Oct 24, ~12:50 AM PT. Update this file whenever you stop or switch tools (Figma ↔ Cursor ↔ Claude Code). Team-wide status lives in `PROGRESS.md`.

## Where things stand
- Not started on the dashboard yet. Spec is in `docs/DASHBOARD_SPEC.md`; your one starting prompt is `docs/TEAMMATE_DASHBOARD_PROMPT.md`.
- Demo sites T10/T11 (fictional pantries `demo-pantry-a`, `demo-pantry-b`) follow integration contract v1 in PROGRESS.md. Visual directions and homepage order are in `docs/demo-site-reference.md`.

## Next, in order
1. Clone, create branch `dashboard`, read CLAUDE.md, PROGRESS.md, the dashboard spec, `docs/demo-site-reference.md`.
2. `npx impeccable install` then `/impeccable init`.
3. Figma: MVP screens M1 Overview, M2 Donors, M3 Expenses, with empty and sparse states. Put the Figma link in the spec.
4. Build in `/dashboard` on mock data behind `dashboard/src/data.ts`.
5. Demo sites: slots must be empty by default and the site must look complete without them.

## Resume commands
```bash
git fetch && git checkout dashboard && git pull --rebase origin main
```

## Gotchas
- Do not edit `/convex`, `/engine`, `/layer`, `/staff/update*`. Add a row to PROGRESS.md Blockers instead.
- Names, photos and logos must be fictional and not resemble real orgs. Check placeholder names (e.g. Juniper Row, Northmere) against a live search first.
- Every computed number must say "estimate" or "about".

## Open questions
- Which Figma track to target (criteria unseen).
- Own neutral dashboard chrome vs the charity's palette.
