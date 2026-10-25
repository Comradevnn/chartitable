// Extra slide (not in the .pptx): the same pantry page twice, before the black-hole slide. Output: slides/slide1b.png
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const shot = pathToFileURL(join(HERE, 'shots', 'before-stranger.png')).href;
const html = `<!doctype html><meta charset=utf-8><body style="margin:0;width:1920px;height:1080px;background:#fff;position:relative;overflow:hidden;font-family:'Comic Sans MS',cursive">
<div style="position:absolute;left:80px;top:34px;font-size:104px;font-weight:700;color:#f00;-webkit-text-stroke:4px #000;paint-order:stroke fill;transform:rotate(-2deg)">the SAME page. twice.</div>
<div style="position:absolute;left:90px;top:176px;width:780px;height:12px;background:repeating-linear-gradient(90deg,#00f 0 8px,transparent 8px 14px);transform:rotate(-.5deg)"></div>
<div style="position:absolute;left:70px;top:236px;font-size:58px;font-weight:700;color:#00b000;-webkit-text-stroke:2px #000;paint-order:stroke fill;transform:rotate(-2deg)">DAY 1</div>
<img src="${shot}" style="position:absolute;left:60px;top:330px;width:830px;height:467px;object-fit:cover;object-position:top;border:7px dashed #000;border-radius:6px;transform:rotate(-1deg)">
<div style="position:absolute;left:80px;top:830px;font-size:56px;color:#00f;transform:rotate(-1deg)">*donates $25*  feels great</div>
<svg style="position:absolute;left:905px;top:470px" width="110" height="120" viewBox="0 0 110 120"><path d="M6 70 Q50 20 90 62 M70 40 L92 64 L62 80" fill="none" stroke="#00f" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>
<div style="position:absolute;left:1010px;top:226px;background:#ff0;border:5px solid #000;padding:6px 22px;font-size:56px;font-weight:700;transform:rotate(2deg)">1 MONTH LATER</div>
<img src="${shot}" style="position:absolute;left:1000px;top:330px;width:830px;height:467px;object-fit:cover;object-position:top;border:7px dashed #000;border-radius:6px;transform:rotate(1deg)">
<div style="position:absolute;left:1030px;top:830px;font-size:56px;color:#00f;transform:rotate(1deg)">...the exact same page. hello??</div>
<div style="position:absolute;right:50px;bottom:36px;font-size:34px;transform:rotate(-1deg)">graphic design is my passion</div></body>`;
writeFileSync(join(HERE, 'cards', 'doublepage.html'), html);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto(pathToFileURL(join(HERE, 'cards', 'doublepage.html')).href); await p.waitForTimeout(500);
await p.screenshot({ path: join(HERE, 'slides', 'slide1b.png') }); await b.close(); console.log('slide1b done');
