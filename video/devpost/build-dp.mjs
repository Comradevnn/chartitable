// Assembles the silent Devpost demo video: scenes (clips, slides, cards) with reading-paced durations,
// plus a subtitled copy (the voice-over script burned in) and an .srt.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
const HERE = dirname(fileURLToPath(import.meta.url)); const require = createRequire(import.meta.url);
const FF = require('ffmpeg-static'); const SL = join(HERE, '..', 'slides'); const OUT = process.env.DP_OUT || join(HERE, 'out');
for (const d of [OUT, join(HERE, 'work'), join(HERE, 'work', 'ov')]) mkdirSync(d, { recursive: true });
const ff = (...a) => execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: ['ignore', 'inherit', 'inherit'] });
const dur = f => { const r = spawnSync(FF, ['-hide_banner', '-i', f], { encoding: 'utf8' }).stderr; const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(r); return +m[1] * 3600 + +m[2] * 60 + +m[3]; };
const mk = n => JSON.parse(readFileSync(join(HERE, 'clips', n + '.json'), 'utf8'));
const clip = n => join(HERE, 'clips', n + '.webm');
const A = mk('dpA'), M = mk('dpMira'), S = mk('dpStaff'), E = mk('dpE');
const WPS = 2.3; // reading speed (words per second) the video is paced for
// kind: slide|card|clip; clip range = [from, to] seconds in the source
const scenes = [
  { id: 'intro', kind: 'slide', src: join(SL, 'slide1.png'), text: "Chartitable helps small charities keep their donors. This is a walkthrough of how it works, first from the donor's side, then from the charity's." },
  { id: 'same', kind: 'slide', src: join(SL, 'slide1b.png'), text: "Normally a donor gives to a small pantry, comes back later, and finds the exact same page. Nothing shows them what their gift did." },
  { id: 'fix', kind: 'slide', src: join(SL, 'slide4.png'), text: "Chartitable adds a layer to the charity's own website that remembers donors, plus a dashboard that shows the charity who to thank." },
  { id: 'stranger', kind: 'clip', src: clip('dpA'), range: [0.5, A.strangerEnd + 0.4], text: "A first-time visitor sees the pantry's normal website. Nothing is personalized." },
  { id: 'donate', kind: 'clip', src: clip('dpA'), range: [A.strangerEnd + 0.4, A.thanks - 0.2], text: "They give through a hosted test-mode page, so no real money moves. A first name and an email are both optional." },
  { id: 'thanks', kind: 'clip', src: clip('dpA'), range: [A.thanks - 0.2, A.thanks + 3.6], text: "Back on the site, the page thanks them by name." },
  { id: 'week', kind: 'clip', src: join(HERE, '..', 'clips', 't1.webm'), range: [0, 10], text: "Meet Mira, who gave a week ago. When her share of what the pantry has done crosses a milestone, she gets an email." },
  { id: 'mira', kind: 'clip', src: clip('dpMira'), range: [M.active - 0.3, M.scrolled + 5.2], text: "Her link opens the pantry's own website, rearranged around her: what the pantry has done since she gave, and her share, clearly marked as an estimate." },
  { id: 'staff', kind: 'clip', src: clip('dpStaff'), range: [S.form - 0.6, S.success + 1.6], text: "On the other side, pantry staff log what happened in seconds: a count, a short note, and an optional photo." },
  { id: 'live', kind: 'clip', src: clip('dpMira'), range: [M.beforeSubmit - 1.2, M.updated + 4.5], text: "Mira's page updates by itself, with no reload, and shows the eighty meals." },
  { id: 'again', kind: 'clip', src: clip('dpC'), range: [1.2, mk('dpC').welcome + 3.4], text: "If she wants to give again, one click opens the donate page, and it welcomes her back." },
  { id: 'second', kind: 'clip', src: clip('dpD'), range: [mk('dpD').active - 0.2, 99], text: "The same one-line embed works on any website. Here is a completely different pantry, showing a returning donor." },
  { id: 'dash', kind: 'clip', src: clip('dpE'), range: [E.overview - 1.0, E.howWeGot + 2.4], text: "On the charity's side, a dashboard shows who needs a thank-you, what has been spent, and what a meal costs. Cost per meal is marked as an estimate, and one click explains how it's worked out." },
  { id: 'donors', kind: 'clip', src: clip('dpE'), range: [E.howWeGot + 2.4, E.thanked + 2.0], text: "The donors view shows who to thank and who has gone quiet, and one click marks a donor as thanked." },
  { id: 'expenses', kind: 'clip', src: clip('dpE'), range: [E.expenses - 0.8, 99], text: "Expenses are logged right here, with a simple view of where the money went." },
  { id: 'embed', kind: 'card', src: join(HERE, 'cards', 'embed.png'), text: "Installing it takes one script tag and a few marked regions on the site the charity already has. No redesign." },
  { id: 'guard', kind: 'card', src: join(HERE, 'cards', 'guard.png'), text: "Claude writes the stories, but only from logged facts. A checker rejects any number or name it wasn't given, and a plain template takes over." },
  { id: 'close', kind: 'slide', src: join(SL, 'slide6.png'), text: "Chartitable: donor retention that donors can actually see. Built with Claude, Convex, Vercel, Cursor, Resend and Figma. Thank you." },
];
const VF = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=white,fps=30,format=yuv420p';
const enc = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-an'];
// ---- durations + cues ----
let t = 0;
for (const s of scenes) {
  const words = s.text.split(/\s+/).length; s.words = words;
  s.speak = words / WPS; s.dur = Math.ceil((s.speak + 1.1) * 30) / 30;
  if (s.kind === 'clip') { const raw = dur(s.src); const a = s.range[0], b = Math.min(s.range[1], raw - 0.05); s.a = Math.max(0, a); s.b = b; s.native = b - s.a; s.speed = Math.min(2.4, Math.max(0.85, s.native / s.dur)); s.used = Math.min(s.native, s.dur * s.speed); s.dur = Math.max(s.dur, Math.ceil((s.used / s.speed) * 30) / 30); }
  s.t0 = t; t += s.dur;
  // cues: split on sentence/comma boundaries, then merge to <= 2 lines (about 100 chars)
  const parts = s.text.match(/[^.,:;]+[.,:;]?\s*/g).map(x => x.trim()).filter(Boolean); const cues = []; let cur = '';
  for (const p of parts) { if ((cur + ' ' + p).trim().length > 92 && cur) { cues.push(cur); cur = p; } else cur = (cur + ' ' + p).trim(); } if (cur) cues.push(cur);
  const total = cues.reduce((a, c) => a + c.length, 0); let ct = 0.35; const span = s.dur - 0.7; s.cues = cues.map(c => { const d = Math.max(1.4, span * c.length / total); const o = { text: c, a: ct, b: Math.min(s.dur - 0.1, ct + d) }; ct += d; return o; });
  // last cue must end inside the scene; scale if overflow
  const over = ct - (s.dur - 0.1); if (over > 0) { const k = (s.dur - 0.45) / (ct - 0.35); let x = 0.35; for (const c of s.cues) { const d = (c.b - c.a) * k; c.a = x; c.b = x + d; x += d; } }
}
// ---- subtitle PNGs ----
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1920, height: 1080 } });
for (const s of scenes) for (const [i, c] of s.cues.entries()) {
  await pg.setContent(`<body style="margin:0;background:transparent;width:1920px;height:1080px;position:relative;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif"><div style="position:absolute;left:0;right:0;bottom:46px;display:flex;justify-content:center"><div style="max-width:1560px;background:rgba(8,10,14,.86);color:#fff;font-size:46px;line-height:1.3;font-weight:600;padding:20px 38px;border-radius:16px;text-align:center">${esc(c.text)}</div></div></body>`);
  c.png = join(HERE, 'work', 'ov', `${s.id}_${i}.png`); await pg.screenshot({ path: c.png, omitBackground: true });
}
await br.close();
// ---- scene videos (clean) then subtitled ----
for (const s of scenes) {
  const clean = join(HERE, 'work', `${s.id}.mp4`), subs = join(HERE, 'work', `${s.id}.sub.mp4`);
  if (s.kind !== 'clip') ff('-loop', '1', '-framerate', '30', '-t', String(s.dur), '-i', s.src, '-vf', VF, ...enc, clean);
  else ff('-ss', String(s.a), '-t', String(s.used), '-i', s.src, '-vf', `setpts=PTS/${s.speed.toFixed(4)},${VF},tpad=stop_mode=clone:stop_duration=${Math.max(0, s.dur - s.used / s.speed + 0.2).toFixed(2)}`, '-t', String(s.dur), ...enc, clean);
  const ins = s.cues.flatMap(c => ['-i', c.png]); let g = '[0:v]'; const f = [];
  s.cues.forEach((c, i) => { f.push(`${g}[${i + 1}:v]overlay=0:0:enable='between(t,${c.a.toFixed(2)},${c.b.toFixed(2)})':format=auto[v${i}]`); g = `[v${i}]`; });
  ff('-i', clean, ...ins, '-filter_complex', f.join(';'), '-map', g, ...enc, subs);
}
const list = (suf) => { const p = join(HERE, 'work', `list${suf}.txt`); writeFileSync(p, scenes.map(s => `file '${join(HERE, 'work', `${s.id}${suf ? '.sub' : ''}.mp4`)}'`).join('\n')); return p; };
ff('-f', 'concat', '-safe', '0', '-i', list(''), '-c', 'copy', '-movflags', '+faststart', join(OUT, 'devpost-demo-clean.mp4'));
ff('-f', 'concat', '-safe', '0', '-i', list('s'), '-c', 'copy', '-movflags', '+faststart', join(OUT, 'devpost-demo-subtitled.mp4'));
// ---- srt + voice-over script ----
const ts = x => { const h = Math.floor(x / 3600), m = Math.floor(x % 3600 / 60), s = x % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0').replace('.', ',')}`; };
const fmt = x => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
let srt = '', n = 1; for (const s of scenes) for (const c of s.cues) srt += `${n++}\n${ts(s.t0 + c.a)} --> ${ts(s.t0 + c.b)}\n${c.text}\n\n`;
writeFileSync(join(OUT, 'devpost-demo.srt'), srt);
const label = { intro: 'Title slide', same: 'Slide: the same page twice', fix: 'Slide: the fix', stranger: 'Demo: first-time visitor', donate: 'Demo: donate (test mode)', thanks: 'Demo: thank-you page', week: 'Animation: one week later, the email', mira: 'Demo: Mira\'s personalized page', staff: 'Demo: staff update page', live: 'Demo: live update on Mira\'s page', again: 'Demo: give again', second: 'Demo: second site', dash: 'Dashboard: overview', donors: 'Dashboard: donors', expenses: 'Dashboard: expenses', embed: 'Card: install in one line', guard: 'Card: fact-check', close: 'Closing slide' };
let md = `# Devpost demo: voice-over script\n\nTotal length ${fmt(t)}. Read each block while its scene is on screen (paced for about ${Math.round(WPS * 60)} words per minute, the subtitles follow the same timing).\n\n| Time | On screen | Say |\n|---|---|---|\n` + scenes.map(s => `| ${fmt(s.t0)} | ${label[s.id]} | ${s.text} |`).join('\n') + `\n\nWord count: ${scenes.reduce((a, s) => a + s.words, 0)}.\n`;
writeFileSync(join(OUT, 'voiceover-script.md'), md);
console.log('built', fmt(t), scenes.map(s => `${s.id}:${s.dur.toFixed(1)}${s.speed ? '@' + s.speed.toFixed(2) + 'x' : ''}`).join(' '));
