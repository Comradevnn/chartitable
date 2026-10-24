# Cursor prompt: `layer.js` (T8) and staff update page (T4)

Use: open the repo in Cursor and paste **one part at a time** (Part 1 for T8, Part 2 for T4) as the first message of a new chat. Each part runs in stages with self-checks, like `docs/CURSOR_TEST_SITES_PROMPT.md`. Owner: Revnn/Cursor.

## Model and settings
- **Grok 4.7** (Fast off, effort high) for the code. **Composer 2.5** for mechanical steps (README, log entries, repeated checks).
- Mode: **Agent**. One chat per part. Record the model names and what ran in `docs/cursor-grok-log.md` (SpaceXSI evidence).
- The backend these pages call is already built and tested in Claude Code (Lane A): `GET /donor-view` (`convex/http.ts`), `impact:log` / `impact:generateUploadUrl` / `impact:recent` (`convex/impact.ts`). **Do not edit `/convex`, `/engine`, `/seed`, `/staff/donate*`, `/frontend`, `/dashboard`, or `/demo-sites/*` outside what a part allows.** If the API looks wrong, write a row in `PROGRESS.md` → Blockers and keep going against the sample JSON.

## Deployed values (use these; updated Sat ~4 AM PT)
- **Do Part 1 (T8) first. It is the critical path.** Part 2 only after Part 1 passes its self-checks.
- `CT_API_BASE` = `https://acoustic-donkey-399.convex.site` (dev deployment; verified live: `GET /donor-view?charity=demo-pantry-a` with a valid Bearer token returns the JSON below; a bad token returns `{"recognized":false}`).
- `CT_DONATE_URL` = `https://chartitable.vercel.app/staff/donate` (the Vercel build uses clean URLs; locally use `http://localhost:5175/donate.html`).
- Staff pages talk to Convex at `https://acoustic-donkey-399.convex.cloud` (already in `staff/config.js`). The staff PIN is a Convex env var; **never hardcode or print it**; the page asks the user to type it.
- Test hosts are live at `https://chartitable.vercel.app/sites/<name>/` (`warm-pantry`, `regional-bank`, `volunteer-run`, `church-community`). On Vercel the layer loads from `/layer.js`; locally from `http://localhost:5174/layer.js`.
- **Demo-donor link for manual testing:** run `npx convex run tokens:issue '{"donorId":"donor_a01","charityId":"demo-pantry-a"}'` and open the returned link's `?ct=` token on a test host. The first view shows a template story; the second shows Claude's (by design: `/donor-view` never waits on Claude).
- Vercel blocks deployments of commits not authored by Revnn; push your work to `main` as usual and tell Revnn to ship it. Commit with the repo's git identity (already set); do not change it.
- If `docs/design/ct-slots.css` exists (Teammate 1's returning-donor design, task T22), bundle it as the default styles instead of writing your own: `--loader:.css=text`, inject once in a `<style>`. If it does not exist, use a minimal fallback and keep the styles in one string so it is easy to swap.

---

## Part 1 — T8 `layer.js` (writes `/layer/src/**`, `/layer/test/**`, `/layer/package.json` scripts only)

You are Cursor's agent (Grok/Composer, not Claude) building **`layer.js`** for Chartitable at Cal Hacks 13.0 (Devpost deadline Sun Oct 25, 9:00 AM PT). It is a tiny dependency-free script that charity websites include with one tag. It shows a returning donor their impact in empty slots and does **nothing at all** for everyone else.

### Read first (only these)
1. `CLAUDE.md`, then `PROGRESS.md`: Snapshot, **Integration contract v1** (exact markup and hooks), Blockers.
2. `docs/PRODUCT_SPEC.md` §13 (layer behavior; this is the spec, follow every bullet) and §8 (failure modes).
3. `engine/types.ts`: the `DonorView`, `RecordFact`, `EstimateFact` types only.
4. `/demo-sites/test-hosts/` (README, `_preview/donor-view.sample.json`, `_preview/preview.js`) to see the test pages and the sample data. `preview.js` is a dev harness; `layer.js` replaces it and must not depend on it.

### The API (already built)
```
GET  <CT_API_BASE>/donor-view?charity=<charity-id>
     Authorization: Bearer <token>
→ 200 application/json, CORS *, always one of:
  { "recognized": false }
  { "recognized": true,
    "hero": { "firstName": string|null, "story": string, "source": "claude"|"template" },
    "sinceLastVisit": { "sinceDateLabel": string, "records": RecordFact[], "estimates": EstimateFact[] } | null,
    "nextStep": { "kind": "give_again"|"give_monthly"|"volunteer"|"share", "text": string, "href": string|null },
    "records":   RecordFact[],    // { logId, kind, count, unit, dateLabel, note|null, hasPhoto }
    "estimates": EstimateFact[],  // { kind, unit, approxQuantity, marker: "about" }
    "photos": { "logId": string, "url": string }[] }
```
`CT_API_BASE` is the Convex HTTP actions origin, `https://<deployment>.convex.site` (not `.convex.cloud`). Do **not** add a new attribute to the script tag (that would change contract v1). Inject it at build time with esbuild `--define`, with a localhost fallback for dev:
```bash
esbuild src/layer.ts --bundle --format=iife --target=es2019 --minify --outfile=dist/layer.js \
  --define:CT_API_BASE='"https://<deployment>.convex.site"' --define:CT_DONATE_URL='"https://<host>/donate.html"'
```
Declare `declare const CT_API_BASE: string; declare const CT_DONATE_URL: string;` in the source and keep `npm run build` working with defaults (`""` → layer exits silently).

### Stage A — behavior (stop and self-check after)
Implement `layer/src/layer.ts` exactly per §13:
- Runs on `DOMContentLoaded`. Reads `data-charity` from its own `<script>` (`document.currentScript`, captured at load). Unknown id (not `demo-pantry-a`/`demo-pantry-b`) or no slots → do nothing.
- **Donate link:** on init, token or not, rewrite every `[data-impact-donate]` `href` to `CT_DONATE_URL?charity=<id>` (only if `CT_DONATE_URL` is set).
- **Token:** `?ct=` in the URL wins → store under `localStorage["chartitable:<id>"]` (try/catch; fall back to an in-memory variable) → remove `ct` from the address bar with `history.replaceState` (keep other params and the hash). Otherwise read `localStorage`. **No token → exit: no DOM change, no network call.**
- **Fetch:** one `GET`, `Authorization: Bearer <token>`, 4 s timeout (`AbortController`), no retries, no cookies (`credentials: "omit"`). `recognized:false` → delete the stored token. Network error/timeout/bad JSON → leave everything untouched. **No `console.error` / `console.warn`** in normal failure paths.
- Self-check A: write `layer/test/smoke.html` (+ a tiny static JSON stub served next to it) and confirm: no token → slots stay empty and no request is made (Network tab); with a token and the stub → one request with the header.

### Stage B — rendering
- Build DOM with `document.createElement` + `textContent` only. **Never `innerHTML`** with API strings.
- `hero` slot: the story (a `<p class="ct-story">`), then a records list (`.ct-record`, e.g. "Tue, Oct 20 · 80 meals"), then an estimates list (`.ct-estimate`, text always includes the visible word "about", e.g. "about 22 meals (estimate)") with a one-line note: "Estimates are your proportional share of pooled gifts, not traced dollars." Records and estimates in **separate** lists with separate headings ("Logged by the pantry" / "Your share (estimate)"). Photos as `<img class="ct-photo" alt="<that record's note or unit>" loading="lazy">` only for URLs in `photos`.
- `since-last-visit` slot: only if `sinceLastVisit` is non-null **and** it has at least one record or estimate; heading "Since your last visit (<sinceDateLabel>)".
- `next-step` slot: the `text`, plus a link to `href` when non-null.
- Fill all slots in one `requestAnimationFrame`. Then set `data-impact-state="ready"` on each filled slot and `data-impact-active` on `<html>`. Slots become `role="region"` with an `aria-label`. No animation by default; respect `prefers-reduced-motion`.
- Default styles: one `<style>` element injected once, every selector wrapped in `:where(...)` (zero specificity), all colors and fonts from `var(--ct-accent)`, `--ct-fg`, `--ct-bg`, `--ct-muted`, `--ct-font`, `--ct-radius` with sensible fallbacks. `.ct-` class prefix everywhere.
- Self-check B: on every test host (`/demo-sites/test-hosts/*`), with the stub, the filled state reads well at 1280 and 390 px; site CSS still wins over defaults.

### Stage C — size, safety, evidence
- `npm run build`; report `dist/layer.js` size min and gzip (`gzip -c dist/layer.js | wc -c`); target < 8 KB gzip. No dependencies.
- Try a hostile stub (story containing `<img src=x onerror=alert(1)>`): it must render as literal text.
- First-time visitor check on all four hosts: open in a private window with no `ct` → page identical to the original, zero requests to the API, zero console output.
- Screenshots (empty vs filled) to `docs/cursor-shots/`, notes to `docs/cursor-grok-log.md`. Append one line to `PROGRESS.md` Handoff log: `- [Sat <time> PT] [A] Cursor/T8: ...`. Do not edit other parts of PROGRESS.md.

---

## Part 2 — T4 staff update page (writes `/staff/update.html`, `/staff/update.js`, `/staff/update.css` only)

You are Cursor's agent building the **staff impact update page** for Chartitable: a pantry volunteer posts "served 80 meals" with an optional photo from a phone, in under 30 seconds.

### Read first (only these)
`CLAUDE.md`; `PROGRESS.md` Snapshot and Blockers; `docs/PRODUCT_SPEC.md` §14 (the staff paragraph) and §15 (PIN, env); `staff/donate.html` and `staff/donate.js` (same folder, same config pattern: `staff/config.js` sets `window.CHARTITABLE_CONFIG.convexUrl`; reuse that file, do not edit it).

### The API (already built, Convex public HTTP API)
Call `POST <convexUrl>/api/mutation` or `/api/query` with JSON `{ "path": "...", "args": {...}, "format": "json" }`; the response is `{ "status": "success", "value": ... }` or `{ "status": "error", "errorMessage": ... }`.
- `impact:generateUploadUrl` (mutation) `{ pin }` → upload URL string. Then `POST` the image file to that URL with `Content-Type: <file.type>` → `{ "storageId": "..." }`.
- `impact:log` (mutation) `{ pin, charityId, kind: "meals"|"produce"|"volunteer_shifts", count, note?, photoStorageId? }` → `{ ok: true, logId, donorsCredited }` or `{ ok: false, error: "kind"|"count"|"note" }`. An `unauthorized` error means a wrong PIN.
- `impact:recent` (query) `{ pin, charityId }` → last 10 updates `{ id, kind, count, unit, note, hasPhoto, loggedAt }`.

### Stage A — form
- URL `update.html?charity=demo-pantry-a` (validate the id; else show "This link isn't valid.").
- PIN field first (type password, `autocomplete="off"`), kept in memory only (never in `localStorage`, never in the URL). It's a fictional shared demo PIN, not a real credential.
- Fields: kind (three large buttons/radios: Meals / Produce / Volunteer shifts), count (numeric keypad, integer 1–10,000), unit shown read-only from kind ("meals", "pounds of produce", "volunteer shifts"), note (≤ 200 chars with a live counter and the warning "Visible to donors. Don't include names or personal info."), optional photo (image only, ≤ 5 MB, resized client-side to max 1600 px on the long edge via `<canvas>` → JPEG 0.85 before upload).
- Submit: disable the button, upload the photo first if present, then `impact:log`. Success → "Recorded. Shared across N donors' estimates." (N = `donorsCredited`; no names) and refresh the recent list. Error → plain message, form kept.
- Mobile-first, works one-handed at 390 px, large tap targets, accessible labels, visible focus, `prefers-reduced-motion`.

### Stage B — checks and evidence
- Validation mirrors the server: count bounds; note length; reject `<`, `>`, `@`, `http` in the note client-side too (the server rejects them anyway).
- With `convexUrl` empty, the page shows "Not configured" and disables submit (same as the donate page).
- Screenshots to `docs/cursor-shots/`, notes to `docs/cursor-grok-log.md`, one `[A] Cursor/T4` Handoff log line in `PROGRESS.md`.
