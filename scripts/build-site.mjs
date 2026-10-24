// Assembles the static site Vercel serves: dist-site/
//   /layer.js            the embeddable layer (built from /layer)
//   /staff/*             hosted donate page (and the staff update page when it exists)
//   /sites/<name>/*      fictional demo/test host sites from /demo-sites/test-hosts
//   /app/*               Lane B static pages from /frontend (landing, donor dashboard, staff donors)
// Only these folders are published. Docs, source, .env and the backend are never copied.
// Test hosts reference http://localhost:5174/layer.js for local dev; the copy is rewritten to /layer.js.
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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

if (existsSync(join(root, "frontend"))) {
  cpSync(join(root, "frontend"), join(out, "app"), { recursive: true });
}

const hosts = join(root, "demo-sites", "test-hosts");
const siteNames = [];
if (existsSync(hosts)) {
  for (const name of readdirSync(hosts)) {
    const dir = join(hosts, name);
    if (!statSync(dir).isDirectory()) continue;
    cpSync(dir, join(out, "sites", name), { recursive: true });
    siteNames.push(name);
  }
}

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

const links = siteNames.filter((n) => !n.startsWith("_")).map((n) => `<li><a href="/sites/${n}/">${n}</a> (<a href="/sites/${n}/?preview=1">preview</a>)</li>`).join("\n");
writeFileSync(
  join(out, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Chartitable demo</title>
<h1>Chartitable demo hosts</h1>
<p>Fictional charities for testing a donor personalization layer. Test mode only.</p>
<ul>${links}
<li><a href="/app/">Lane B frontend pages</a></li>
<li><a href="/staff/donate.html?charity=demo-pantry-a">Test-mode donate page</a></li></ul>`,
);

console.log(`dist-site ready: layer.js, staff/, ${siteNames.length} site(s)`);
