import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const base = `margin:0;width:1920px;height:1080px;background:#fff;position:relative;overflow:hidden;font-family:'Comic Sans MS',cursive`;
const embed = `<!doctype html><meta charset=utf-8><body style="${base}">
<div style="position:absolute;left:90px;top:50px;font-size:108px;font-weight:700;color:#f00;-webkit-text-stroke:4px #000;paint-order:stroke fill;transform:rotate(-2deg)">install = 1 line</div>
<div style="position:absolute;left:100px;top:200px;width:820px;height:12px;background:repeating-linear-gradient(90deg,#00f 0 8px,transparent 8px 14px)"></div>
<div style="position:absolute;left:90px;top:270px;width:1740px;border:7px dashed #000;border-radius:8px;padding:34px 44px;box-sizing:border-box;background:#fbfbf8;font-family:Menlo,Consolas,monospace;font-size:39px;line-height:1.55;color:#14213d">
<div style="color:#777">&lt;!-- on the charity's own website --&gt;</div>
<div>&lt;<b style="color:#c1121f">script</b> src=<span style="color:#2a7d2e">"https://chartitable.vercel.app/layer.js"</span></div>
<div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;data-charity=<span style="color:#2a7d2e">"demo-pantry-a"</span> defer&gt;&lt;/<b style="color:#c1121f">script</b>&gt;</div>
<div style="margin-top:22px;color:#777">&lt;!-- marked regions: empty for visitors we don't know --&gt;</div>
<div>&lt;<b style="color:#c1121f">section</b> data-impact-region=<span style="color:#2a7d2e">"hero"</span>&gt;&lt;/<b style="color:#c1121f">section</b>&gt;</div>
<div>&lt;<b style="color:#c1121f">a</b> data-impact-donate href=<span style="color:#2a7d2e">"#donate"</span>&gt;Donate&lt;/<b style="color:#c1121f">a</b>&gt;</div></div>
<div style="position:absolute;left:100px;top:760px;font-size:54px;color:#00f;line-height:1.3">first-time visitors: <u>nothing changes</u>.<br>returning donors: the page rearranges around them.</div>
<div style="position:absolute;right:50px;bottom:36px;font-size:34px;transform:rotate(-1deg)">graphic design is my passion</div></body>`;
const box = (x,y,w,h,col,txt,sub='',fs=50) => `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border:7px dashed #000;border-radius:10px;background:${col};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:12px;box-sizing:border-box"><div style="font-size:${fs}px;font-weight:700;color:#000;line-height:1.1">${txt}</div><div style="font-size:30px;color:#223;margin-top:8px;line-height:1.2">${sub}</div></div>`;
const arrow = (x,y,w=110) => `<svg style="position:absolute;left:${x}px;top:${y}px" width="${w}" height="70" viewBox="0 0 ${w} 70"><path d="M6 36 L${w-24} 36 M${w-52} 12 L${w-14} 36 L${w-52} 60" fill="none" stroke="#00f" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const guard = `<!doctype html><meta charset=utf-8><body style="${base}">
<div style="position:absolute;left:80px;top:40px;font-size:100px;font-weight:700;color:#00b000;-webkit-text-stroke:4px #000;paint-order:stroke fill;transform:rotate(-1.5deg)">no made-up impact</div>
<div style="position:absolute;left:90px;top:176px;width:900px;height:12px;background:repeating-linear-gradient(90deg,#00f 0 8px,transparent 8px 14px)"></div>
${box(70,310,360,230,'#fff6a8','logged facts','what staff recorded')}
${arrow(440,390)}
${box(560,310,400,230,'#ffd9e8','Claude','writes the donor story from those facts only')}
${arrow(970,390)}
${box(1090,310,420,230,'#d7ecff','fact-check','every number and name must be in the facts')}
${arrow(1520,380,100)}
${box(1625,230,265,170,'#c8f5c8','✓ shown','to the donor',42)}
${box(1625,430,265,200,'#ffe0c8','✗ plain template','takes over',38)}
<div style="position:absolute;left:100px;top:640px;font-size:52px;color:#00f;line-height:1.35;width:1700px">records are facts. estimates say <u>about</u>.<br>and when the data is thin, we say less.</div>
<div style="position:absolute;right:50px;bottom:36px;font-size:34px;transform:rotate(-1deg)">graphic design is my passion</div></body>`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
for (const [n, h] of [['embed', embed], ['guard', guard]]) { writeFileSync(join(HERE, 'cards', n + '.html'), h); await p.goto(pathToFileURL(join(HERE, 'cards', n + '.html')).href); await p.waitForTimeout(400); await p.screenshot({ path: join(HERE, 'cards', n + '.png') }); }
await b.close(); console.log('cards ok');
