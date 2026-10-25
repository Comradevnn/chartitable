# Devpost demo video (silent, with subtitles)

Records the live demo scenes against the DEV deployment and assembles a 3-minute silent video paced for a voice-over (about 138 words per minute). Outputs in `out/` (gitignored): `devpost-demo-subtitled.mp4` (voice-over script burned in, for recording), `devpost-demo-clean.mp4` (no subtitles, for the final upload), `devpost-demo.srt` (captions for Devpost/YouTube), `voiceover-script.md`.

```bash
cd video && npm install && npx playwright install chromium
# slides must exist in video/slides (see video/README.md) and the "one week later" clip in video/clips/t1.webm
(cd .. && npm run demo:reset)
cd devpost && mkdir -p clips cards shots out
node photo.mjs && node cards-dp.mjs
for s in A B C D E; do node rec.mjs $s; done   # B submits the staff form, which sends the milestone email to the demo inbox
node build-dp.mjs
(cd ../.. && npm run demo:reset)
```
Edit the scene list and the voice-over text at the top of `build-dp.mjs`. Scene durations follow reading time; clips are sped up or slowed (0.85x to 2.4x) to fit.
