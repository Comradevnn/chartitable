import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
const dir = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
for (let i = 1; i <= 6; i++) {
  await p.goto(pathToFileURL(`${dir}/slide${i}.html`).href);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${dir}/slide${i}.png` });
}
await b.close(); console.log('shots done');
