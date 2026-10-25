import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
const svg=new URL('../../seed/photos/meals-1.svg', import.meta.url).pathname;
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(pathToFileURL(svg).href); await p.waitForTimeout(300);
await p.screenshot({path:'staff-photo.png'}); await b.close(); console.log('photo ok');
