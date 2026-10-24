// Assembles the static site Vercel serves: dist-site/
//   /layer.js            the embeddable layer (built from /layer)
//   /staff/*             hosted donate page (and the staff update page when it exists)
//   /sites/<name>/*      fictional host sites: the demo hosts from /demo-sites/hosts (cinderwell, brindlecote)
//                        and the older test fixtures from /demo-sites/test-hosts (kept so old email links work)
//   /seed/photos/*       fictional placeholder photos for seeded logs (ASSET_BASE_URL)
//   /app/*               Lane B static pages from /frontend (landing, donor dashboard, staff donors)
// Only these folders are published. Docs, source, .env and the backend are never copied.
// Hosts reference http://localhost:5174/layer.js for local dev; the copy is rewritten to /layer.js.
// Dev notes (NOTES.md) and donor-view.empty.json are not published from the demo hosts.
import { execSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist-site");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

execSync("npm run build -w layer", { cwd: root, stdio: "inherit", env: process.env });
cpSync(join(root, "layer", "dist", "layer.js"), join(out, "layer.js"));

if (existsSync(join(root, "staff"))) {
  cpSync(join(root, "staff"), join(out, "staff"), {
    recursive: true,
    filter: (src) => !/README\.md$/.test(src),
  });
}

// Fictional placeholder photos for seeded impact logs (photoPath "seed/photos/*.svg");
// Convex builds their URLs from ASSET_BASE_URL (= this site's origin).
if (existsSync(join(root, "seed", "photos"))) {
  cpSync(join(root, "seed", "photos"), join(out, "seed", "photos"), { recursive: true });
}

if (existsSync(join(root, "frontend"))) {
  cpSync(join(root, "frontend"), join(out, "app"), { recursive: true });
}

const demoHostsDir = join(root, "demo-sites", "hosts");
const testHostsDir = join(root, "demo-sites", "test-hosts");
const demoSiteNames = [];
const testSiteNames = [];

function hostDirs(base) {
  if (!existsSync(base)) return [];
  return readdirSync(base).filter((name) => statSync(join(base, name)).isDirectory());
}

const testDirs = hostDirs(testHostsDir);
const demoDirs = hostDirs(demoHostsDir).filter((name) => !name.startsWith("_"));
const clash = demoDirs.filter((name) => testDirs.includes(name));
if (clash.length) {
  console.error(`build-site: host name(s) exist in both demo-sites/hosts and demo-sites/test-hosts: ${clash.join(", ")}. Rename one.`);
  process.exit(1);
}

// Test fixtures stay published unchanged so old email links do not 404.
for (const name of testDirs) {
  cpSync(join(testHostsDir, name), join(out, "sites", name), { recursive: true });
  testSiteNames.push(name);
}

// Demo hosts. NOTES.md and donor-view.empty.json are dev-only. preview.js fetches
// donor-view.sample.json in ?preview=1 mode, so that sample stays published.
for (const name of demoDirs) {
  cpSync(join(demoHostsDir, name), join(out, "sites", name), {
    recursive: true,
    filter: (src) => !/(^|\/)NOTES\.md$/.test(src) && !/(^|\/)donor-view\.empty\.json$/.test(src),
  });
  demoSiteNames.push(name);
}

// Each host symlinks preview.js etc. to ../_preview. cpSync keeps them as links to this machine,
// which 404 on Vercel (console errors on every host page), so replace each link with the real file.
function materializeLinks(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = lstatSync(p);
    if (st.isSymbolicLink()) {
      const target = realpathSync(p);
      rmSync(p);
      cpSync(target, p, { recursive: true });
    } else if (st.isDirectory()) materializeLinks(p);
  }
}
if (existsSync(join(out, "sites"))) materializeLinks(join(out, "sites"));

// Point copied HTML at the deployed layer instead of the local dev server.
function rewrite(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) rewrite(p);
    else if (p.endsWith(".html")) {
      const html = readFileSync(p, "utf8");
      const next = html.replaceAll("http://localhost:5174/layer.js", "/layer.js");
      if (next !== html) writeFileSync(p, next);
    }
  }
}
rewrite(join(out, "sites"));

const li = (n) => `<li><a href="/sites/${n}/">${n}</a> (<a href="/sites/${n}/?preview=1">preview</a>)</li>`;
const demoLinks = demoSiteNames.map(li).join("\n");
const testLinks = testSiteNames.filter((n) => !n.startsWith("_")).map(li).join("\n");
writeFileSync(
  join(out, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Chartitable demo</title>
<h1>Chartitable demo hosts</h1>
<p>Fictional charities for testing a donor personalization layer. Test mode only.</p>
<h2>Demo hosts</h2>
<ul>${demoLinks}</ul>
<h2>Test fixtures</h2>
<ul>${testLinks}</ul>
<h2>Other</h2>
<ul>
<li><a href="/app/">Lane B frontend pages</a></li>
<li><a href="/staff/donate.html?charity=demo-pantry-a">Test-mode donate page</a></li></ul>`,
);

console.log(`dist-site ready: layer.js, staff/, ${demoSiteNames.length} demo host(s), ${testSiteNames.length} test host(s)`);
