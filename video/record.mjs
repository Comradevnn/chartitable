// Records the live demo scenes against the DEV deployment with a headless browser.
// Usage: node record.mjs <scene>   scenes: d1 d2a d2b d2c
import { chromium } from 'playwright';
import { renameSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = process.env.CT_REPO || join(HERE, '..');
const { PIN, callAction, sleep } = await import(`${REPO}/scripts/demo-lib.mjs`);
const SITE = 'https://chartitable.vercel.app';
const W = 1920, H = 1080;
const scene = process.argv[2];
mkdirSync(join(HERE, 'clips'), { recursive: true }); mkdirSync(join(HERE, 'shots'), { recursive: true });

const CURSOR_JS = `(() => {
  const mk = () => {
    if (document.getElementById('__cur')) return;
    const c = document.createElement('div'); c.id='__cur';
    c.style.cssText='position:fixed;z-index:2147483647;width:26px;height:26px;margin:-4px 0 0 -4px;pointer-events:none;left:-50px;top:-50px;transition:transform .08s;';
    c.innerHTML='<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 2 L3 20 L8 15.5 L11.5 23 L14.5 21.6 L11 14.2 L18 14 Z" fill="#fff" stroke="#111" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(c);
    addEventListener('mousemove', e => { c.style.left=e.clientX+'px'; c.style.top=e.clientY+'px'; }, true);
    addEventListener('mousedown', e => { const r=document.createElement('div'); r.style.cssText='position:fixed;z-index:2147483646;pointer-events:none;border:3px solid rgba(255,190,0,.9);border-radius:50%;width:12px;height:12px;left:'+(e.clientX-6)+'px;top:'+(e.clientY-6)+'px;transition:all .45s ease-out;opacity:1'; document.documentElement.appendChild(r); requestAnimationFrame(()=>{ r.style.width='70px';r.style.height='70px';r.style.left=(e.clientX-35)+'px';r.style.top=(e.clientY-35)+'px';r.style.opacity='0'; }); setTimeout(()=>r.remove(),600); }, true);
  };
  if (document.documentElement) mk(); document.addEventListener('DOMContentLoaded', mk);
})();`;

function demoInbox() {
  // First address in DEMO_INBOXES, read in memory only; never printed. Falls back to a placeholder (still masked).
  try {
    const out = spawnSync('npx', ['convex', 'env', 'get', 'DEMO_INBOXES'], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60000 }).stdout || '';
    const first = out.split(',')[0].trim();
    return first.includes('@') ? first : 'mira@example.org';
  } catch { return 'mira@example.org'; }
}
async function newScene(name) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: join(HERE, 'clips', '_raw'), size: { width: W, height: H } }, reducedMotion: 'no-preference' });
  await ctx.addInitScript(CURSOR_JS);
  const page = await ctx.newPage();
  return { browser, ctx, page, name };
}
async function finish(s) {
  const v = s.page.video();
  await s.ctx.close(); // flushes the video
  const p = await v.path();
  renameSync(p, join(HERE, 'clips', `${s.name}.webm`));
  await s.browser.close();
  console.log('saved clip', s.name);
}
async function glide(page, x, y, steps = 28) { await page.mouse.move(x, y, { steps }); }
async function clickEl(page, loc) {
  await loc.scrollIntoViewIfNeeded();
  await sleep(500);
  const b = await loc.boundingBox();
  await glide(page, b.x + b.width / 2, b.y + b.height / 2);
  await sleep(350);
  await page.mouse.down(); await sleep(90); await page.mouse.up();
}
async function smoothScrollTo(page, y, ms = 1800) {
  await page.evaluate(([y, ms]) => new Promise(res => { const y0 = scrollY, t0 = performance.now(); const f = t => { const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2*k*k : 1 - Math.pow(-2*k+2,2)/2; scrollTo(0, y0 + (y - y0) * e); k < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); }), [y, ms]);
}
async function mira() {
  const r = await callAction('demo:link', { pin: PIN, personaId: 'a-first-impact' }, 30000);
  if (!r.ok || !r.value?.ok) throw new Error('could not get the Mira link');
  return r.value.url; // never printed
}
async function waitActive(page, ms = 25000) { await page.waitForSelector('html[data-impact-active]', { timeout: ms }); }
async function annotate(page, text) {
  await page.evaluate(t => { let n = document.getElementById('__note'); if (!n) { n = document.createElement('div'); n.id='__note'; n.style.cssText='position:fixed;right:28px;bottom:28px;z-index:2147483647;background:#111;color:#fff;font:600 22px/1.3 system-ui,sans-serif;padding:16px 22px;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.35);max-width:460px;border-left:8px solid #f5b400'; document.documentElement.appendChild(n);} n.textContent=t; }, text);
}

if (scene === 'd1') {
  const s = await newScene('d1'); const { page } = s;
  await page.goto(`${SITE}/sites/cinderwell/`); await sleep(2200);
  await page.screenshot({ path: join(HERE, 'shots', 'before-stranger.png') });
  await smoothScrollTo(page, 420, 1200); await sleep(400); await smoothScrollTo(page, 0, 900); await sleep(300);
  await clickEl(page, page.locator('a[data-impact-donate]:visible').first());
  await page.waitForURL(/\/staff\/donate/, { timeout: 20000 });
  await page.waitForSelector('#donate-form:not([hidden])', { timeout: 20000 }); await sleep(800);
  await clickEl(page, page.locator('label.chip:has(input[value="25"])'));
  await sleep(400); await clickEl(page, page.locator('#firstName'));
  await page.keyboard.type('Mira', { delay: 140 }); await sleep(500);
  // The email is typed for real (the demo inbox) but shown as dots, so no address appears in the video.
  await page.addStyleTag({ content: '#email{-webkit-text-security:disc}' });
  await clickEl(page, page.locator('#email'));
  await page.keyboard.type(demoInbox(), { delay: 70 }); await sleep(700);
  await clickEl(page, page.locator('#submit'));
  await page.waitForURL(/\/sites\/cinderwell\//, { timeout: 30000 });
  await waitActive(page); await sleep(3200);
  await finish(s);
} else if (scene === 'd2a') {
  const s = await newScene('d2a'); const { page } = s; const url = await mira();
  await page.goto(url); await waitActive(page); await sleep(3500);
  const est = page.locator('.ct-estimate, [data-ct-each="estimates"], :text("estimate")').first();
  try { await est.scrollIntoViewIfNeeded(); } catch {}
  await sleep(4500); await smoothScrollTo(page, 0, 1200); await sleep(1000);
  await finish(s);
} else if (scene === 'd2b') {
  const s = await newScene('d2b'); const { page } = s; const url = await mira();
  await page.goto(url); await waitActive(page); await sleep(2500);
  await page.screenshot({ path: join(HERE, 'shots', 'before-mira.png') });
  await annotate(page, "Pantry staff page: tapped 'Served 80 meals'");
  const r = await callAction('demo:post', { pin: PIN, charityId: 'demo-pantry-a', preset: 'meals80' }, 60000);
  if (!r.ok || !r.value?.ok) throw new Error('post failed: ' + (r.reason || JSON.stringify(r.value)));
  await page.waitForFunction(() => /Just logged/i.test(document.body.innerText), null, { timeout: 40000 });
  await page.evaluate(() => document.getElementById('__note')?.remove());
  await sleep(3500);
  await page.screenshot({ path: join(HERE, 'shots', 'after-mira.png') });
  await sleep(3500);
  await finish(s);
} else if (scene === 'd2c') {
  const s = await newScene('d2c'); const { page } = s; const url = await mira();
  await page.goto(url); await waitActive(page); await sleep(2500);
  await clickEl(page, page.locator('a[data-impact-donate]:visible', { hasText: /give again/i }).first());
  await page.waitForURL(/\/staff\/donate/, { timeout: 20000 });
  await page.waitForSelector('#welcome:not([hidden])', { timeout: 20000 }); await sleep(4500);
  await finish(s);
} else if (scene === 'd3') {
  const s = await newScene('d3'); const { page } = s;
  await page.goto(`${SITE}/dashboard/`); await sleep(1200);
  await clickEl(page, page.locator('input[type=password]'));
  await page.keyboard.type('6767', { delay: 160 }); await sleep(500);
  await page.keyboard.press('Enter');
  await page.waitForSelector('text=Overview', { timeout: 20000 }); await page.waitForSelector('text=Cost per meal', { timeout: 20000 }); await sleep(3000);
  await clickEl(page, page.getByRole('button', { name: 'See who' }));
  await page.waitForSelector('text=Mark thanked', { timeout: 20000 }); await sleep(2600);
  await clickEl(page, page.locator('button', { hasText: 'Mark thanked' }).first());
  await page.waitForSelector('text=/Marked .* as thanked/', { timeout: 20000 }); await sleep(2800);
  await finish(s);
} else { console.log('unknown scene'); process.exit(2); }
