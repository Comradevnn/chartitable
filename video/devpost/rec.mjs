// Records the Devpost demo scenes against the DEV deployment. Usage: node rec.mjs A|B|C|D|E
import { chromium } from 'playwright';
import { renameSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = process.env.CT_REPO || join(HERE, '..', '..');
const { PIN, callAction, sleep } = await import(`${REPO}/scripts/demo-lib.mjs`);
const SITE = 'https://chartitable.vercel.app', W = 1920, H = 1080;
mkdirSync(join(HERE, 'clips', '_raw'), { recursive: true });
const CURSOR_JS = `(() => { const mk = () => { if (document.getElementById('__cur')) return; const c = document.createElement('div'); c.id='__cur'; c.style.cssText='position:fixed;z-index:2147483647;width:26px;height:26px;margin:-4px 0 0 -4px;pointer-events:none;left:-50px;top:-50px;'; c.innerHTML='<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 2 L3 20 L8 15.5 L11.5 23 L14.5 21.6 L11 14.2 L18 14 Z" fill="#fff" stroke="#111" stroke-width="1.8" stroke-linejoin="round"/></svg>'; document.documentElement.appendChild(c); addEventListener('mousemove', e => { c.style.left=e.clientX+'px'; c.style.top=e.clientY+'px'; }, true); addEventListener('mousedown', e => { const r=document.createElement('div'); r.style.cssText='position:fixed;z-index:2147483646;pointer-events:none;border:3px solid rgba(255,190,0,.9);border-radius:50%;width:12px;height:12px;left:'+(e.clientX-6)+'px;top:'+(e.clientY-6)+'px;transition:all .45s ease-out;opacity:1'; document.documentElement.appendChild(r); requestAnimationFrame(()=>{ r.style.width='70px';r.style.height='70px';r.style.left=(e.clientX-35)+'px';r.style.top=(e.clientY-35)+'px';r.style.opacity='0'; }); setTimeout(()=>r.remove(),600); }, true); }; if (document.documentElement) mk(); document.addEventListener('DOMContentLoaded', mk); })();`;
async function scene(name) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: join(HERE, 'clips', '_raw'), size: { width: W, height: H } } });
  await ctx.addInitScript(CURSOR_JS);
  const page = await ctx.newPage(); const t0 = Date.now(); const marks = {};
  return { browser, ctx, page, name, t0, marks, mark: (k) => { marks[k] = +((Date.now() - t0) / 1000).toFixed(2); } };
}
async function done(s) {
  const v = s.page.video(); await s.ctx.close(); const p = await v.path();
  renameSync(p, join(HERE, 'clips', `${s.name}.webm`)); writeFileSync(join(HERE, 'clips', `${s.name}.json`), JSON.stringify(s.marks));
  await s.browser.close(); console.log('saved', s.name, JSON.stringify(s.marks));
}
async function clickEl(page, loc) { await loc.scrollIntoViewIfNeeded(); await sleep(450); const b = await loc.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 26 }); await sleep(320); await page.mouse.down(); await sleep(90); await page.mouse.up(); }
async function smooth(page, y, ms = 1800) { await page.evaluate(([y, ms]) => new Promise(res => { const y0 = scrollY, t0 = performance.now(); const f = t => { const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2*k*k : 1 - Math.pow(-2*k+2,2)/2; scrollTo(0, y0 + (y - y0) * e); k < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); }), [y, ms]); }
async function link(personaId) { const r = await callAction('demo:link', { pin: PIN, personaId }, 30000); if (!r.ok || !r.value?.ok) throw new Error('no link for ' + personaId); return r.value.url; }
const active = (page) => page.waitForSelector('html[data-impact-active]', { timeout: 25000 });
const which = process.argv[2];

if (which === 'A') { // stranger -> donate (Sam) -> thanks
  const s = await scene('dpA'); const { page } = s;
  await page.goto(`${SITE}/sites/cinderwell/`); await sleep(1800); s.mark('stranger');
  await smooth(page, 520, 1600); await sleep(500); await smooth(page, 0, 1200); await sleep(400); s.mark('strangerEnd');
  await clickEl(page, page.locator('a[data-impact-donate]:visible').first());
  await page.waitForURL(/\/staff\/donate/, { timeout: 20000 }); await page.waitForSelector('#donate-form:not([hidden])'); await sleep(900); s.mark('donateForm');
  await clickEl(page, page.locator('label.chip:has(input[value="25"])')); await sleep(300);
  await clickEl(page, page.locator('#firstName')); await page.keyboard.type('Sam', { delay: 150 }); await sleep(600); s.mark('typed');
  await clickEl(page, page.locator('#submit'));
  await page.waitForURL(/\/sites\/cinderwell\//, { timeout: 30000 }); await active(page); s.mark('thanks'); await sleep(3800);
  await done(s);
} else if (which === 'B') { // Mira's page (recorded) while staff post an update through the real staff page (recorded)
  const mira = await scene('dpMira'); const staff = await scene('dpStaff');
  const url = await link('a-first-impact');
  await mira.page.goto(url); await active(mira.page); mira.mark('active'); await sleep(1500);
  const est = mira.page.locator('.ct-estimate, :text("estimate")').first();
  await smooth(mira.page, 420, 1800); await sleep(1500); mira.mark('scrolled'); await smooth(mira.page, 0, 1200); await sleep(1000);
  // staff side (concurrently recorded)
  const sp = staff.page;
  await sp.goto(`${SITE}/staff/update?charity=demo-pantry-a`); await sp.waitForSelector('#form:not([hidden])', { timeout: 20000 }); await sleep(1200); staff.mark('form');
  await clickEl(sp, sp.locator('#pin')); await sp.keyboard.type('6767', { delay: 170 }); await sleep(500);
  await clickEl(sp, sp.locator('label.kind:has(input[value="meals"])')); await sleep(300);
  await clickEl(sp, sp.locator('#count')); await sp.keyboard.type('80', { delay: 190 }); await sleep(300);
  await clickEl(sp, sp.locator('#note')); await sp.keyboard.type('Evening distribution, 80 meals handed out.', { delay: 45 }); await sleep(400);
  await sp.setInputFiles('#photo', join(HERE, 'staff-photo.png')); await sleep(1300); staff.mark('filled');
  mira.mark('beforeSubmit');
  await clickEl(sp, sp.locator('#submit')); staff.mark('submitted');
  await sp.waitForSelector('#success:not([hidden])', { timeout: 40000 }); staff.mark('success'); await sleep(2200);
  await mira.page.waitForFunction(() => /Just logged/i.test(document.body.innerText), null, { timeout: 45000 }); mira.mark('updated');
  await smooth(mira.page, 250, 1200); await sleep(3500);
  await done(staff); await done(mira);
} else if (which === 'C') { // give again as Mira
  const s = await scene('dpC'); const { page } = s; const url = await link('a-first-impact');
  await page.goto(url); await active(page); await sleep(1800);
  await clickEl(page, page.locator('a[data-impact-donate]:visible', { hasText: /give again/i }).first());
  await page.waitForURL(/\/staff\/donate/, { timeout: 20000 }); await page.waitForSelector('#welcome:not([hidden])'); s.mark('welcome'); await sleep(3800);
  await done(s);
} else if (which === 'D') { // second site, a returning donor
  const s = await scene('dpD'); const { page } = s; const url = await link('b-repeat');
  await page.goto(url); await active(page); s.mark('active'); await sleep(2200);
  await smooth(page, 600, 2200); await sleep(1800); await smooth(page, 0, 1500); await sleep(1500);
  await done(s);
} else if (which === 'E') { // dashboard: overview, how we got this, donors, mark thanked, expenses
  const s = await scene('dpE'); const { page } = s;
  await page.goto(`${SITE}/dashboard/`); await sleep(900);
  await clickEl(page, page.locator('input[type=password]')); await page.keyboard.type('6767', { delay: 160 }); await sleep(400); await page.keyboard.press('Enter');
  await page.waitForSelector('text=Cost per meal', { timeout: 25000 }); await sleep(2000); s.mark('overview');
  await clickEl(page, page.getByRole('button', { name: 'How we got this' })); await sleep(2800); s.mark('howWeGot');
  await clickEl(page, page.getByRole('button', { name: /See who/ })); await page.waitForSelector('text=Mark thanked', { timeout: 20000 }); await sleep(2200); s.mark('donors');
  await clickEl(page, page.locator('button', { hasText: 'Mark thanked' }).first()); await page.waitForSelector('text=/Marked .* thanked/', { timeout: 20000 }); await sleep(2200); s.mark('thanked');
  await clickEl(page, page.getByRole('button', { name: 'Expenses' })); await page.waitForSelector('text=Where the money went', { timeout: 20000 }); await sleep(2200); s.mark('expenses');
  await clickEl(page, page.locator('input[placeholder="0.00"]')); await page.keyboard.type('42.50', { delay: 150 }); await sleep(300);
  await clickEl(page, page.locator('input[placeholder="Optional"]')); await page.keyboard.type('Rice and beans for the weekend', { delay: 45 }); await sleep(400);
  await clickEl(page, page.getByRole('button', { name: 'Add expense' })); await page.waitForSelector('text=/Added \\$42/', { timeout: 20000 }); s.mark('added'); await sleep(2500);
  await done(s);
} else { console.log('unknown'); process.exit(2); }
