import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mira = JSON.parse(readFileSync(join(HERE, 'mira-view.json'), 'utf8'));
const meals = (mira.estimates || []).find(e => e.kind === 'meals');
const share = meals ? `Your share so far: about ${meals.approxQuantity} meals (estimate)` : '';

const oneweek = `<!doctype html><meta charset=utf-8><body style="margin:0;width:1920px;height:1080px;background:#fff;position:relative;overflow:hidden;font-family:'Comic Sans MS',cursive">
<div style="position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;flex-direction:column;transform:rotate(-3deg)">
<div style="font-size:210px;font-weight:700;letter-spacing:4px;-webkit-text-stroke:6px #000;paint-order:stroke fill;line-height:1">
<span style="color:#ff0000">ONE</span> <span style="color:#ff8000">WEEK</span></div>
<div style="font-size:210px;font-weight:700;letter-spacing:4px;-webkit-text-stroke:6px #000;paint-order:stroke fill;line-height:1.05">
<span style="color:#00c000">LA</span><span style="color:#0000ff">TER</span><span style="color:#8000ff">...</span></div></div>
<div style="position:absolute;right:60px;bottom:50px;font-size:34px;transform:rotate(2deg)">graphic design is my passion</div></body>`;

const email = `<!doctype html><meta charset=utf-8><body style="margin:0;width:1920px;height:1080px;background:#e9edf0;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;display:flex;align-items:center;justify-content:center">
<div style="width:1180px;background:#fff;border-radius:18px;box-shadow:0 20px 70px rgba(0,0,0,.22);overflow:hidden">
<div style="background:#1f3a34;color:#fff;padding:26px 44px;font-size:30px;font-weight:600">New message in the demo inbox</div>
<div style="padding:30px 44px 6px;color:#556;font-size:26px;line-height:1.55;border-bottom:1px solid #e3e6ea">
<div><b style="color:#223">From:</b> Chartitable Demo</div><div><b style="color:#223">To:</b> Mira (fictional donor, demo inbox)</div>
<div style="margin-top:6px;font-size:36px;color:#111;font-weight:700;padding-bottom:18px">${esc('See where your donation has gone')}</div></div>
<div style="padding:34px 44px 40px;font-size:31px;line-height:1.5;color:#1d2530">
<p style="margin:0 0 20px">Hi ${esc(mira.firstName || 'Mira')},</p>
<p style="margin:0 0 20px">${esc(mira.story || '')}</p>
${share ? `<p style="margin:0 0 20px;font-weight:600">${esc(share)}</p>` : ''}
<p style="margin:0 0 20px;color:#5b4a14;background:#fff6d6;border:2px dashed #d9a400;border-radius:10px;padding:14px 20px;font-size:27px">Estimates are proportional shares of pooled gifts, not a trace of your dollars.</p>
<p style="margin:0 0 24px"><span style="display:inline-block;background:#2f6b4f;color:#fff;border-radius:8px;padding:14px 26px;font-weight:700">See the full update</span></p>
<p style="margin:0;color:#667;font-size:22px">Fictional demo — no real payment was made.</p></div></div>
<div style="position:absolute;bottom:34px;left:0;right:0;text-align:center;color:#667;font-size:24px">The real email was sent to the demo inbox when the staff update crossed the milestone. Shown here from the product's email template.</div></body>`;

const compare = `<!doctype html><meta charset=utf-8><body style="margin:0;width:1920px;height:1080px;background:#fff;position:relative;overflow:hidden;font-family:'Comic Sans MS',cursive">
<div style="position:absolute;left:60px;top:40px;font-size:88px;font-weight:700;color:#ff0000;-webkit-text-stroke:3px #000;paint-order:stroke fill;transform:rotate(-2deg)">BEFORE</div>
<div style="position:absolute;left:1000px;top:40px;font-size:88px;font-weight:700;color:#00b000;-webkit-text-stroke:3px #000;paint-order:stroke fill;transform:rotate(2deg)">AFTER</div>
<img src="${pathToFileURL(join(HERE, 'shots', 'before-stranger.png')).href}" style="position:absolute;left:50px;top:190px;width:880px;height:495px;object-fit:cover;object-position:top;border:6px dashed #000;border-radius:6px">
<img src="${pathToFileURL(join(HERE, 'shots', 'after-mira.png')).href}" style="position:absolute;left:990px;top:190px;width:880px;height:495px;object-fit:cover;object-position:top;border:6px dashed #000;border-radius:6px">
<div style="position:absolute;left:50px;top:720px;width:880px;font-size:44px;color:#0000ff;line-height:1.2">a page that never changes. same photo, same button.</div>
<div style="position:absolute;left:990px;top:720px;width:880px;font-size:44px;color:#0000ff;line-height:1.2">what the pooled gifts did, my share (an <u>estimate</u>), one next step.</div>
<div style="position:absolute;right:60px;bottom:40px;font-size:34px;color:#000">graphic design is my passion</div></body>`;

const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
for (const [name, html] of [['oneweek', oneweek], ['email', email], ['compare', compare]]) {
  writeFileSync(join(HERE, 'cards', `${name}.html`), html);
  await p.goto(pathToFileURL(join(HERE, 'cards', `${name}.html`)).href); await p.waitForTimeout(500);
  await p.screenshot({ path: join(HERE, 'cards', `${name}.png`) });
}
await b.close(); console.log('cards done');
