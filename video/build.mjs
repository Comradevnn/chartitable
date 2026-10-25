// Assembles the demo video from slides, cards, recorded clips and synthesized voice-over.
// Outputs (in ./out): practice versions with captions, a voiced clean version, a silent clean version,
// per-speaker audio stems, captions (.srt) and a cue sheet.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const FF = require('ffmpeg-static');
const cfg = JSON.parse(readFileSync(join(HERE, 'script.json'), 'utf8'));
const OUT = process.env.CT_OUT || join(HERE, 'out'); const WORK = join(HERE, 'work');
const HEAD_TRIM = { d2a: 1.2, d2b: 2.2, d2c: 1.5, d1: 0, t1: 0, d3: 5.8 };
const SPEED = { d1: 1.5 };
const CLIP_MAX = { d2a: 11, d2c: 8 };   // seconds of un-personalized load to cut
const LEAD_IN = 0.3, TAIL = { slide: 0.55, card: 0.45, clip: 0.2 };
for (const d of [OUT, WORK, join(WORK, 'seg'), join(WORK, 'aud'), join(WORK, 'ov')]) mkdirSync(d, { recursive: true });
const ff = (...a) => execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: ['ignore', 'inherit', 'inherit'] });
const probeDur = f => { const r = spawnSync(FF, ['-hide_banner', '-i', f], { encoding: 'utf8' }); const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(r.stderr); return +m[1] * 3600 + +m[2] * 60 + +m[3]; };

// ---- 1. voice-over ----
for (const s of cfg.segments) {
  const sp = cfg.speakers[s.speaker], aiff = join(WORK, 'aud', `${s.id}.aiff`), wav = join(WORK, 'aud', `${s.id}.wav`);
  execFileSync('say', ['-v', sp.voice, '-r', String(sp.rate), '-o', aiff, s.text]);
  ff('-i', aiff, '-ar', '48000', '-ac', '1', wav);
  s.audio = wav; s.audioDur = probeDur(wav);
}
// ---- 2. durations + visual sources ----
const slideImg = n => join(HERE, 'slides', `slide${n}.png`);
for (const s of cfg.segments) {
  const [kind, name] = s.visual.split(':'); s.kind = kind; s.name = name;
  if (kind === 'clip') { const raw = probeDur(join(HERE, 'clips', `${name}.webm`)); s.clipStart = HEAD_TRIM[name] || 0; s.speed = SPEED[name] || 1; s.clipDur = Math.min((raw - s.clipStart) / s.speed, CLIP_MAX[name] ?? 1e9); s.dur = Math.max(s.audioDur + LEAD_IN + TAIL.clip, s.clipDur); }
  else s.dur = s.audioDur + LEAD_IN + TAIL[kind];
  s.dur = Math.ceil(s.dur * 30) / 30;
}
// ---- 3. practice overlays (badge + caption), transparent PNGs ----
const COLORS = { A: '#f5b400', B: '#3aa0ff' };
const wrap = t => t;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1920, height: 1080 } });
for (const s of cfg.segments) {
  const sp = cfg.speakers[s.speaker];
  const html = `<!doctype html><body style="margin:0;background:transparent;width:1920px;height:1080px;position:relative;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif">
  <div style="position:absolute;left:34px;top:30px;background:rgba(10,10,14,.86);border-left:14px solid ${COLORS[s.speaker]};color:#fff;padding:14px 26px 14px 22px;border-radius:10px;font-size:34px;font-weight:700">${sp.name.toUpperCase()} SPEAKS <span style="font-weight:500;opacity:.8;font-size:26px">(${s.id})</span></div>
  <div style="position:absolute;left:120px;right:120px;bottom:44px;background:rgba(10,10,14,.84);color:#fff;padding:22px 32px;border-radius:14px;font-size:35px;line-height:1.38">${esc(wrap(s.text))}</div></body>`;
  await pg.setContent(html); await pg.screenshot({ path: join(WORK, 'ov', `${s.id}.png`), omitBackground: true });
}
await br.close();
// ---- 4. video segments (clean + practice) ----
const VF = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=white,fps=30,format=yuv420p';
const enc = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-an'];
for (const s of cfg.segments) {
  const clean = join(WORK, 'seg', `${s.id}.mp4`), prac = join(WORK, 'seg', `${s.id}.practice.mp4`);
  if (s.kind === 'slide') ff('-loop', '1', '-framerate', '30', '-t', String(s.dur), '-i', slideImg(s.name), '-vf', VF, ...enc, clean);
  else if (s.kind === 'card' && s.name === 'oneweek') {
    // title card first (35%), then the email (65%)
    const t1 = (s.dur * 0.35).toFixed(3), t2 = (s.dur - s.dur * 0.35).toFixed(3);
    ff('-loop', '1', '-framerate', '30', '-t', t1, '-i', join(HERE, 'cards', 'oneweek.png'), '-loop', '1', '-framerate', '30', '-t', t2, '-i', join(HERE, 'cards', 'email.png'),
      '-filter_complex', `[0:v]${VF}[a];[1:v]${VF}[b];[a][b]concat=n=2:v=1:a=0[v]`, '-map', '[v]', ...enc, clean);
  } else if (s.kind === 'card') ff('-loop', '1', '-framerate', '30', '-t', String(s.dur), '-i', join(HERE, 'cards', `${s.name}.png`), '-vf', VF, ...enc, clean);
  else ff('-ss', String(s.clipStart), '-i', join(HERE, 'clips', `${s.name}.webm`), '-t', String(s.dur), '-vf', `setpts=PTS/${s.speed},${VF},tpad=stop_mode=clone:stop_duration=${Math.max(0, s.dur - s.clipDur + 0.5).toFixed(2)}`, '-t', String(s.dur), ...enc, clean);
  ff('-i', clean, '-i', join(WORK, 'ov', `${s.id}.png`), '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]', '-map', '[v]', ...enc, prac);
}
const list = (suffix) => { const p = join(WORK, `list${suffix}.txt`); writeFileSync(p, cfg.segments.map(s => `file '${join(WORK, 'seg', `${s.id}${suffix ? '.practice' : ''}.mp4`)}'`).join('\n')); return p; };
ff('-f', 'concat', '-safe', '0', '-i', list(''), '-c', 'copy', join(WORK, 'video-clean.mp4'));
ff('-f', 'concat', '-safe', '0', '-i', list('p'), '-c', 'copy', join(WORK, 'video-practice.mp4'));
// ---- 5. audio stems (per speaker, aligned) ----
const stemParts = { A: [], B: [], all: [] };
for (const s of cfg.segments) {
  for (const who of ['A', 'B']) {
    const f = join(WORK, 'aud', `${s.id}.${who}.wav`);
    if (s.speaker === who) ff('-i', s.audio, '-af', `adelay=${Math.round(LEAD_IN * 1000)}:all=1,apad=whole_dur=${s.dur}`, '-t', String(s.dur), '-ar', '48000', '-ac', '1', f);
    else ff('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', String(s.dur), f);
    stemParts[who].push(f);
  }
}
for (const who of ['A', 'B']) { const lp = join(WORK, `stem${who}.txt`); writeFileSync(lp, stemParts[who].map(f => `file '${f}'`).join('\n')); ff('-f', 'concat', '-safe', '0', '-i', lp, '-c:a', 'aac', '-b:a', '160k', join(OUT, who === 'A' ? 'voice-lead.m4a' : 'voice-teammate.m4a')); }
ff('-i', join(OUT, 'voice-lead.m4a'), '-i', join(OUT, 'voice-teammate.m4a'), '-filter_complex', 'amix=inputs=2:duration=longest:normalize=0', '-c:a', 'aac', '-b:a', '160k', join(OUT, 'voice-all.m4a'));
// ---- 6. mux versions ----
const mux = (video, audio, out) => audio ? ff('-i', video, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', out) : ff('-i', video, '-c:v', 'copy', '-movflags', '+faststart', out);
mux(join(WORK, 'video-practice.mp4'), join(OUT, 'voice-all.m4a'), join(OUT, '1-practice-all-voices.mp4'));
mux(join(WORK, 'video-practice.mp4'), join(OUT, 'voice-teammate.m4a'), join(OUT, '2-practice-LEAD-speaks-teammate-voiced.mp4'));
mux(join(WORK, 'video-practice.mp4'), join(OUT, 'voice-lead.m4a'), join(OUT, '3-practice-TEAMMATE-speaks-lead-voiced.mp4'));
mux(join(WORK, 'video-clean.mp4'), join(OUT, 'voice-all.m4a'), join(OUT, '4-final-voiced.mp4'));
mux(join(WORK, 'video-clean.mp4'), null, join(OUT, '5-final-silent.mp4'));
// ---- 7. captions + cue sheet ----
let t = 0; const ts = x => { const h = Math.floor(x / 3600), m = Math.floor(x % 3600 / 60), s = x % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0').replace('.', ',')}`; };
let srt = '', cue = `# Cue sheet: who speaks when\n\n| Start | Speaker | Segment | Words |\n|---|---|---|---|\n`;
cfg.segments.forEach((s, i) => { const a = t + LEAD_IN, b = t + LEAD_IN + s.audioDur; srt += `${i + 1}\n${ts(a)} --> ${ts(b)}\n[${cfg.speakers[s.speaker].name}] ${s.text}\n\n`; cue += `| ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')} | ${cfg.speakers[s.speaker].name} | ${s.id} (${s.visual}) | ${s.text} |\n`; t += s.dur; });
writeFileSync(join(OUT, 'captions.srt'), srt); writeFileSync(join(OUT, 'cue-sheet.md'), cue + `\nTotal length: ${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}\n`);
console.log('built; total', t.toFixed(1), 's');
