# Demo video pipeline

Builds the pitch/demo video from the slide deck, the live demo (recorded in a headless browser against the DEV deployment), a notification animation and synthesized voice-over. Not part of the product. Output goes to `video/out/` (gitignored).

## Versions produced
| File | Use |
|---|---|
| `1-practice-all-voices.mp4` | Both voices plus speaker badge and caption bar. Listen to the whole pitch. |
| `2-practice-LEAD-speaks-teammate-voiced.mp4` | Only the teammate's voice is audible; the lead says their own parts over it. |
| `3-practice-TEAMMATE-speaks-lead-voiced.mp4` | Only the lead's voice is audible; the teammate says their parts. |
| `4-final-voiced.mp4` | Clean (no badges or captions) with synthesized voice. Usable as the Devpost backup demo. |
| `5-final-silent.mp4` | Clean and silent. Present live over it once you know your parts. |
| `voice-lead.m4a`, `voice-teammate.m4a`, `voice-all.m4a` | Audio stems. |
| `captions.srt`, `cue-sheet.md` | Who speaks when, with timestamps. |

## Edit the script or the speaker split
Change `script.json` (each segment has `speaker`: `A` = lead, `B` = teammate, and `text`), then run `node build.mjs`. Voices are macOS `say` voices (`speakers` block in the same file). Placeholders to fill: team name, the donation amount, business model.

## Re-run everything
```bash
cd video && mkdir -p cards clips shots && npm install && npx playwright install chromium
# 1. slides: unzip the deck and render it (Keynote scripting is not needed)
mkdir x && (cd x && unzip -oq ../../docs/presentation/Chartitable.pptx)
python3 -I pptx2html.py x slides && node shot-slides.mjs "$PWD/slides"
# 2. reset the demo to its start state, then record the live scenes (needs the Convex dev login or STAFF_PIN)
(cd .. && npm run demo:reset)
node record.mjs d1 && node record.mjs d2a && node record.mjs d2b && node record.mjs d2c && node record.mjs d3
node fetch-view.mjs && node cards.mjs && node anim.mjs
# 3. assemble
node build.mjs
(cd .. && npm run demo:reset)   # leave the demo clean
```
`record.mjs d2b` posts "Served 80 meals" through the demo panel's function, which really sends the milestone email to the configured demo inbox (once; later runs report `already_sent` until a reset).

## Notes and caveats
- Scene `d3` records the live dashboard (it clicks "Mark thanked", which saves for real on the dev deployment).
- The "one week later" notification and email are an animation rendered from the product's email template; the real email is sent but its contents are not screen-captured.
- Slides are rendered by our own converter from the deck's XML, so line breaks may differ slightly from PowerPoint. The "CapCut.com" and "Activate Windows" marks on slide 3 are intentional jokes.
- Never show tokens: the scripts do not print them and no link is on screen.
