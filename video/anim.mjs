// Records the "one week later" notification animation (pure HTML/CSS) to clips/t1.webm
import { chromium } from 'playwright';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mira = JSON.parse(readFileSync(join(HERE, 'mira-view.json'), 'utf8'));
const meals = (mira.estimates || []).find(e => e.kind === 'meals');
const share = meals ? `Your share so far: about ${meals.approxQuantity} meals (estimate)` : '';
const preview = (mira.story || '').slice(0, 96) + '…';
const html = `<!doctype html><meta charset=utf-8><style>
*{box-sizing:border-box} body{margin:0;width:1920px;height:1080px;overflow:hidden;position:relative;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;background:linear-gradient(135deg,#dfe8ee,#f4efe6)}
.title{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;background:#fff;font-family:'Comic Sans MS',cursive;transform:rotate(0);animation:titleout .5s ease-in 1.8s forwards}
.title .t{font-size:200px;font-weight:700;letter-spacing:4px;-webkit-text-stroke:6px #000;paint-order:stroke fill;line-height:1.02;transform:rotate(-3deg)}
@keyframes titleout{to{opacity:0;visibility:hidden}}
.cal{position:absolute;left:120px;top:130px;font-size:44px;color:#445;opacity:0;animation:fadein .6s 2.2s forwards,calout .3s 5.5s forwards}
@keyframes calout{to{opacity:0}}
.cal b{display:block;font-size:150px;line-height:1;color:#223}
@keyframes fadein{to{opacity:1}}
.toast{position:absolute;right:70px;top:-260px;width:760px;background:rgba(255,255,255,.96);border-radius:26px;box-shadow:0 24px 70px rgba(0,0,0,.28);padding:26px 30px;display:flex;gap:22px;align-items:flex-start;animation:slidein .55s cubic-bezier(.2,.9,.3,1.2) 2.7s forwards,toastout .3s ease-in 5.5s forwards}
@keyframes slidein{to{top:70px}} @keyframes toastout{to{opacity:0;transform:scale(.96)}}
.ico{width:72px;height:72px;border-radius:18px;background:#2f6b4f;color:#fff;display:flex;align-items:center;justify-content:center;font-size:42px;font-weight:700;flex:none}
.toast .from{font-size:24px;color:#667;display:flex;justify-content:space-between}.toast .sub{font-size:31px;font-weight:700;color:#111;margin:4px 0}.toast .pre{font-size:25px;color:#334;line-height:1.35}
.badge{position:absolute;right:56px;top:56px;width:40px;height:40px;border-radius:50%;background:#e5322d;color:#fff;font-weight:700;font-size:24px;display:flex;align-items:center;justify-content:center;opacity:0;animation:fadein .2s 3.0s forwards,badgeout .2s 5.5s forwards}
@keyframes badgeout{to{opacity:0}}
.card{position:absolute;left:370px;top:90px;width:1180px;background:#fff;border-radius:18px;box-shadow:0 20px 70px rgba(0,0,0,.25);overflow:hidden;opacity:0;transform:scale(.92) translateY(30px);animation:cardin .55s ease-out 5.6s forwards}
@keyframes cardin{to{opacity:1;transform:none}}
.card .hd{background:#1f3a34;color:#fff;padding:24px 44px;font-size:30px;font-weight:600}.card .meta{padding:26px 44px 4px;color:#556;font-size:25px;line-height:1.5;border-bottom:1px solid #e3e6ea}.card .meta .s{margin:6px 0 0;font-size:35px;color:#111;font-weight:700;padding-bottom:16px}
.card .bd{padding:30px 44px 34px;font-size:30px;line-height:1.48;color:#1d2530}.card p{margin:0 0 18px}.est{color:#5b4a14;background:#fff6d6;border:2px dashed #d9a400;border-radius:10px;padding:12px 20px;font-size:26px}
.btn{display:inline-block;background:#2f6b4f;color:#fff;border-radius:8px;padding:13px 26px;font-weight:700}
.foot{position:absolute;bottom:26px;left:0;right:0;text-align:center;color:#667;font-size:23px;opacity:0;animation:fadein .5s 6.6s forwards}
.cur{position:absolute;left:1500px;top:640px;width:30px;height:30px;opacity:0;animation:curmove 1.3s ease-in-out 4.2s forwards}
@keyframes curmove{0%{opacity:1;left:1500px;top:660px}70%{opacity:1;left:1380px;top:150px}100%{opacity:1;left:1380px;top:150px}}
.ripple{position:absolute;left:1370px;top:140px;width:20px;height:20px;border:4px solid #f5b400;border-radius:50%;opacity:0;animation:rip .6s ease-out 5.5s}
@keyframes rip{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(5)}}
</style><body>
<div class="cal"><span>Saturday, one week later</span><b>7 days</b></div>
<div class="badge">1</div>
<div class="toast"><div class="ico">C</div><div><div class="from"><span>Mail · Chartitable Demo</span><span>now</span></div><div class="sub">See where your donation has gone</div><div class="pre">${esc('Hi ' + (mira.firstName || 'Mira') + ', ' + preview)}</div></div></div>
<svg class="cur" viewBox="0 0 26 26"><path d="M3 2 L3 20 L8 15.5 L11.5 23 L14.5 21.6 L11 14.2 L18 14 Z" fill="#fff" stroke="#111" stroke-width="1.8" stroke-linejoin="round"/></svg><div class="ripple"></div>
<div class="card"><div class="hd">Demo inbox</div><div class="meta"><div><b>From:</b> Chartitable Demo</div><div><b>To:</b> Mira (fictional donor)</div><div class="s">See where your donation has gone</div></div>
<div class="bd"><p>Hi ${esc(mira.firstName || 'Mira')},</p><p>${esc(mira.story || '')}</p>${share ? `<p style="font-weight:600">${esc(share)}</p>` : ''}<p class="est">Estimates are proportional shares of pooled gifts, not a trace of your dollars.</p><p><span class="btn">See the full update</span></p><p style="color:#667;font-size:21px;margin:0">Fictional demo — no real payment was made.</p></div></div>
<div class="foot">Notification animation. The real email was sent to the demo inbox when the staff update crossed the milestone.</div>
<div class="title"><div class="t"><span style="color:#f00">ONE</span> <span style="color:#ff8000">WEEK</span></div><div class="t"><span style="color:#00c000">LA</span><span style="color:#00f">TER</span><span style="color:#8000ff">...</span></div></div>
</body>`;
writeFileSync(join(HERE, 'cards', 't1.html'), html);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: join(HERE, 'clips', '_raw'), size: { width: 1920, height: 1080 } } });
const p = await ctx.newPage(); const v = p.video();
await p.goto(pathToFileURL(join(HERE, 'cards', 't1.html')).href);
await p.waitForTimeout(10000);
await ctx.close(); renameSync(await v.path(), join(HERE, 'clips', 't1.webm')); await b.close(); console.log('t1 saved');
