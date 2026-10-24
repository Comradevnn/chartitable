// Assembles the static site Vercel serves: dist-site/
//   /                    landing/ (static, or its `npm run build` dist/) when it exists; otherwise the generated demo link list
//   /demo-hosts/         generated link list of demo hosts, test fixtures and tools (always written)
//   /dashboard/          charity dashboard (Vite app from /dashboard, built with base /dashboard/); skipped with a loud warning if its build fails
//   /layer.js            the embeddable layer (built from /layer)
//   /staff/*             hosted donate page (and the staff update page when it exists)
//   /sites/<name>/*      fictional host sites: the demo hosts from /demo-sites/hosts (cinderwell, brindlecote)
//                        and the older test fixtures from /demo-sites/test-hosts (kept so old email links work)
//   /seed/photos/*       fictional placeholder photos for seeded logs (ASSET_BASE_URL)
//   /app/*               Lane B static pages from /frontend (landing, donor dashboard, staff donors)
// Landing files may not overwrite paths the build wrote (layer.js, staff, sites, seed, app, dashboard, demo-hosts): the build fails instead.
// CT_LANDING_DIR overrides the landing folder (testing only; default "landing").
// A safety scan fails the build if dist-site holds .env*, TS sources, node_modules, .git, lockfiles or PROGRESS/CLAUDE.md.
// Only these folders are published. Docs, source, .env and the backend are never copied.
// Hosts reference http://localhost:5174/layer.js for local dev; the copy is rewritten to /layer.js.
// Dev notes (NOTES.md) and donor-view.empty.json are not published from the demo hosts.
import { execSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
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

// ---- Dashboard (Vite app) at /dashboard ----
let dashboardBuilt = false;
const dashboardDir = join(root, "dashboard");
if (existsSync(join(dashboardDir, "package.json"))) {
  const t0 = Date.now();
  try {
    const cwd = dashboardDir;
    const env = {
      ...process.env,
      VITE_CONVEX_URL: process.env.VITE_CONVEX_URL || "https://acoustic-donkey-399.convex.cloud",
      VITE_BASE: "/dashboard/",
    };
    execSync(existsSync(join(cwd, "package-lock.json")) ? "npm ci" : "npm install", { cwd, stdio: "inherit", env });
    rmSync(join(cwd, "dist"), { recursive: true, force: true });
    execSync("npm run build -- --base=/dashboard/", { cwd, stdio: "inherit", env });
    const indexPath = join(cwd, "dist", "index.html");
    if (!existsSync(indexPath)) throw new Error("dashboard/dist/index.html missing after build");
    const html = readFileSync(indexPath, "utf8");
    const refs = [...html.matchAll(/(?:src|href)="(\/[^"]*assets\/[^"]*)"/g)].map((m) => m[1]);
    if (!refs.length || refs.some((r) => !r.startsWith("/dashboard/"))) {
      throw new Error(`dashboard asset URLs are not under /dashboard/ (${refs.join(", ") || "none found"})`);
    }
    cpSync(join(cwd, "dist"), join(out, "dashboard"), { recursive: true });
    dashboardBuilt = true;
    console.log(`build-site: dashboard built in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (err) {
    rmSync(join(out, "dashboard"), { recursive: true, force: true });
    console.warn("\n!!!!!!!!!! build-site WARNING: dashboard build failed: skipped /dashboard !!!!!!!!!!");
    console.warn(String(err && err.message ? err.message : err));
  }
}

// ---- Generated link list: always at /demo-hosts/, and at / when there is no landing ----
const linkListHtml = `<!doctype html><meta charset="utf-8"><title>Chartitable demo</title>
<h1>Chartitable demo hosts</h1>
<p>Fictional charities for testing a donor personalization layer. Test mode only.</p>
<h2>Demo hosts</h2>
<ul>${demoLinks}</ul>
<h2>Test fixtures</h2>
<ul>${testLinks}</ul>
<h2>Other</h2>
<ul>
<li><a href="/staff/demo">Demo control (PIN)</a></li>
${dashboardBuilt ? '<li><a href="/dashboard/">Charity dashboard</a></li>\n' : ""}<li><a href="/demo-hosts/">Demo hosts list</a></li>
<li><a href="/app/">Lane B frontend pages</a></li>
<li><a href="/staff/donate.html?charity=demo-pantry-a">Test-mode donate page</a></li></ul>`;
mkdirSync(join(out, "demo-hosts"), { recursive: true });
writeFileSync(join(out, "demo-hosts", "index.html"), linkListHtml);

// ---- Landing at the site root ----
let landingPublished = false;
const landingDir = resolve(root, process.env.CT_LANDING_DIR || "landing");
if (existsSync(landingDir) && statSync(landingDir).isDirectory()) {
  let landingSrc = landingDir;
  if (existsSync(join(landingDir, "package.json"))) {
    const pkg = JSON.parse(readFileSync(join(landingDir, "package.json"), "utf8"));
    if (pkg.scripts && pkg.scripts.build) {
      execSync(existsSync(join(landingDir, "package-lock.json")) ? "npm ci" : "npm install", { cwd: landingDir, stdio: "inherit", env: process.env });
      execSync("npm run build", { cwd: landingDir, stdio: "inherit", env: process.env });
      landingSrc = join(landingDir, "dist");
      if (!existsSync(landingSrc)) {
        console.error("build-site: landing has a build script but produced no dist/ folder.");
        process.exit(1);
      }
    }
  }
  const skip = (src) => {
    if (src === landingSrc) return true;
    const b = basename(src);
    return !(b.startsWith(".") || b === "node_modules" || b.toLowerCase().endsWith(".md"));
  };
  const clashes = readdirSync(landingSrc).filter((n) => skip(join(landingSrc, n)) && existsSync(join(out, n)));
  if (clashes.length) {
    console.error(`build-site: landing would overwrite path(s) the build already wrote: ${clashes.join(", ")}. Rename them in landing/ (reserved: layer.js, staff, sites, seed, app, dashboard, demo-hosts).`);
    process.exit(1);
  }
  cpSync(landingSrc, out, { recursive: true, filter: skip });
  landingPublished = existsSync(join(out, "index.html"));
}
if (!existsSync(join(out, "index.html"))) writeFileSync(join(out, "index.html"), linkListHtml);

// ---- Safety scan ----
const forbidden = [];
(function scan(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const rel = p.slice(out.length + 1);
    const isDir = lstatSync(p).isDirectory();
    if (
      entry.startsWith(".env") ||
      entry === "node_modules" ||
      entry === ".git" ||
      entry === "package-lock.json" ||
      entry === "PROGRESS.md" ||
      entry === "CLAUDE.md" ||
      (!isDir && /\.(ts|tsx)$/.test(entry) && !rel.startsWith(join("dashboard", "assets") + "/"))
    ) forbidden.push(rel);
    if (isDir && entry !== "node_modules" && entry !== ".git") scan(p);
  }
})(out);
if (forbidden.length) {
  console.error(`build-site: refusing to publish; forbidden file(s) in dist-site: ${forbidden.join(", ")}`);
  process.exit(1);
}

console.log(
  `dist-site ready: layer.js, staff/, ${demoSiteNames.length} demo host(s), ${testSiteNames.length} test host(s); landing: ${landingPublished ? "yes" : "no"}; dashboard: ${dashboardBuilt ? "yes" : "no"}`,
);
