#!/bin/bash
set -e
F=../node_modules/ffmpeg-static/ffmpeg
OUT=/Users/hueylee/Documents/Demo/edited
V=..
read T1 T6 TOT < cuts.txt || true
ENC=(-c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -ar 48000 -ac 2)
# 1. rebuild the raw demo section from the per-section clips
: > list.txt; for s in d1 t1 d2a d2b d2c dash c1; do echo "file '$PWD/sec/$s.mp4'" >> list.txt; done
$F -hide_banner -loglevel error -y -f concat -safe 0 -i list.txt -c copy demo-raw.mp4
# 2. slide parts from the voiced video (TTS placeholder narration)
$F -hide_banner -loglevel error -y -ss 0 -t "$T1" -i $V/out/4-final-voiced.mp4 "${ENC[@]}" part1.mp4
$F -hide_banner -loglevel error -y -ss "$T6" -i $V/out/4-final-voiced.mp4 "${ENC[@]}" part3.mp4
printf "file '%s'\nfile '%s'\nfile '%s'\n" "$PWD/part1.mp4" "$PWD/demo-raw.mp4" "$PWD/part3.mp4" > full.txt
$F -hide_banner -loglevel error -y -f concat -safe 0 -i full.txt -c copy full-raw.mp4
# 3. loudness pass (video copied, audio re-encoded); write to temp names first
LN="loudnorm=I=-16:TP=-1.5:LRA=11,aformat=sample_rates=48000:channel_layouts=stereo"
$F -hide_banner -loglevel error -y -i demo-raw.mp4 -map 0:v -map 0:a -c:v copy -af "$LN" -c:a aac -b:a 192k -movflags +faststart demo-final.mp4
$F -hide_banner -loglevel error -y -i full-raw.mp4 -map 0:v -map 0:a -c:v copy -af "$LN" -c:a aac -b:a 192k -movflags +faststart full-final.mp4
# only replace the deliverables once both finished
test -s demo-final.mp4 && test -s full-final.mp4
cp demo-final.mp4 "$OUT/demo-section-edited.mp4"
cp full-final.mp4 "$OUT/full-draft-with-tts-slides.mp4"
ls -la "$OUT" | awk '{print $5,$9}'
for f in demo-section-edited full-draft-with-tts-slides; do printf "%s: " $f; $F -hide_banner -i "$OUT/$f.mp4" -af volumedetect -vn -f null - 2>&1 | grep -E 'mean_volume|max_volume' | sed -E 's/.*(mean|max)_volume: /\1 /' | tr '\n' ' '; $F -hide_banner -i "$OUT/$f.mp4" 2>&1 | grep -o 'Duration: [0-9:.]*'; done
