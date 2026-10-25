# Facecam edit (real recordings)

Builds the edited demo section from the two facecam recordings plus the silent demo recording. Raw footage is not in the repo (large, and it has faces); the paths are at the top of `edit.py` (`D=`).

What it does: per section it picks a speaker (`PICKS` in `edit.py`, or pass a JSON file), removes gaps between words (gaps over 0.3 s keep 0.2 s), speeds the demo footage up to match (up to 2.4x), and places a circular facecam over the quietest part of the picture. If a scene has no empty area big enough, it shrinks the demo and puts the facecam beside it instead.

```bash
cd video && npm install            # ffmpeg-static
python3 -m venv ../.venv && ../.venv/bin/pip install numpy
cd edit && ../../.venv/bin/python edit.py [picks.json]   # writes sec/*.mp4 and edited/demo-section-edited.mp4
./finish.sh                                               # joins the slide parts, loudness pass, writes the deliverables
```
`picks.json` example: `{"d1": "nat", "dash": "huey"}`. `place.py` also reports the best facecam spot for any slide image: `python place.py image slide3.png`.

## Flow-first picks
`score.py` re-scores both takes per section on stumbles (repeats, mid-phrase hesitations, unclear words), pace and smoothness, not on script adherence, and writes `picks_flow.json`. Render it with `SECDIR=sec_flow OUTNAME=demo-section-flow ../../.venv/bin/python edit.py picks_flow.json` then `TAG=-flow SECDIR=sec_flow ./finish.sh`. Note: the transcriber can invent repeats at its 30 s chunk boundaries (0, 30, 60 s); verify a flagged stumble by re-transcribing a short slice before cutting it.

## Balanced version and cut points
`ranges.py` recomputes each section's cut range from where the speech really ends (energy-based), so no word is clipped; the first edit cut Huey's live-update line 0.45 s early ("progress"). `picks_balanced.json` splits the demo between both speakers. `cuts_balanced.json` removes a filler "uh" (found as an untranscribed 0.3 s voiced burst). Render: `RNGFILE=ranges_fixed.json CUTS=cuts_balanced.json SECDIR=sec_bal OUTNAME=demo-section-balanced ../../.venv/bin/python edit.py picks_balanced.json`, then `TAG=-bal SECDIR=sec_bal ./finish.sh`.
