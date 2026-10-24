// Variant harness: shows the demo hosts in every donor state with no token or backend.
//   node layer/test/variant-server.mjs
//   http://localhost:5592/cinderwell/?ct=fx.a.news     (states: first_impact news repeat just_gave; a = pantry A, b = pantry B)
//   http://localhost:5592/brindlecote/?ct=fx.b.repeat
//   any other ?ct= (e.g. fx.reset) answers recognized:false, so the layer forgets the token → stranger view
// Ports: 5174 serves /layer.js (a snapshot by default, see below; API = this harness),
// 5198 is the fake API (/donor-view, /donor-pulse), 5592 serves demo-sites/hosts as static files.
// Live updates: GET http://127.0.0.1:5198/__bump?ct=fx.a.first_impact&to=a.live makes that token
// answer with the a.live fixture (an extra "80 meals" log → new rev) from then on, as if staff had just logged it.
// Fixtures are generated from engine + fictional seed by layer/test/fixtures/make.ts on start.
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { build, buildSync } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const fixturesDir = join(root, "layer", "dist", "fixtures");
mkdirSync(fixturesDir, { recursive: true });

const maker = join(root, "layer", "dist", "make-fixtures.mjs");
buildSync({ entryPoints: [join(here, "fixtures", "make.ts")], bundle: true, platform: "node", format: "esm", outfile: maker, logLevel: "error" });
console.log("fixtures:", execFileSync("node", [maker, fixturesDir], { encoding: "utf8" }).trim());

const overrides = new Map(); // token -> fixture name
function fixtureFor(token) {
  const name = overrides.get(token) ?? (token.startsWith("fx.") ? token.slice(3) : "");
  const file = join(fixturesDir, `${name}.json`);
  return name && /^[ab]\.[a-z_]+$/.test(name) && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store",
};
const json = (res, status, body) => {
  res.writeHead(status, { ...CORS, "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1:5198");
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (url.pathname === "/__bump") {
    const token = url.searchParams.get("ct") || "";
    const to = url.searchParams.get("to") || "";
    if (!fixtureFor("fx." + to)) return json(res, 400, { error: "unknown fixture" });
    overrides.set(token, to);
    return json(res, 200, { ok: true, token, to });
  }
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/, "");
  const view = fixtureFor(token);
  const peek = url.searchParams.get("peek") === "1";
  console.log(`${url.pathname}${peek ? " (peek)" : ""} ${token || "-"} -> ${view ? "fixture" : "recognized:false"}`);
  if (url.pathname === "/donor-view") return json(res, 200, view ?? { recognized: false });
  if (url.pathname === "/donor-pulse") return json(res, 200, view ? { recognized: true, rev: view.rev } : { recognized: false });
  json(res, 404, {});
}).listen(5198, "127.0.0.1");

// Default: serve a fixed snapshot (layer/dist/layer.variant.js, built on first start) so host work
// isn't broken by layer edits in progress. CT_LAYER_LIVE=1 rebuilds from layer/src on every request;
// CT_LAYER_REBUILD=1 refreshes the snapshot on start.
const snapshot = join(root, "layer", "dist", "layer.variant.js");
const buildLayer = () =>
  build({
    entryPoints: [join(root, "layer", "src", "layer.ts")],
    bundle: true,
    format: "iife",
    target: "es2019",
    write: false,
    loader: { ".css": "text" },
    define: { CT_API_BASE: '"http://127.0.0.1:5198"', CT_DONATE_URL: '"https://chartitable.vercel.app/staff/donate"' },
    logLevel: "error",
  }).then((out) => out.outputFiles[0].text);
if (!process.env.CT_LAYER_LIVE && (process.env.CT_LAYER_REBUILD || !existsSync(snapshot))) {
  writeFileSync(snapshot, await buildLayer());
}
console.log("layer:", process.env.CT_LAYER_LIVE ? "live rebuild per request" : "snapshot " + snapshot);

createServer(async (req, res) => {
  if (!(req.url || "").startsWith("/layer.js")) {
    res.writeHead(404);
    return res.end();
  }
  try {
    const text = process.env.CT_LAYER_LIVE ? await buildLayer() : readFileSync(snapshot, "utf8");
    res.writeHead(200, { ...CORS, "Content-Type": "text/javascript" });
    res.end(text);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(String(e));
  }
}).listen(5174); // all interfaces: hosts load http://localhost:5174/layer.js

const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".json": "application/json", ".woff2": "font/woff2" };
const hosts = join(root, "demo-sites", "hosts");
createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url || "/", "http://x").pathname);
  let file = normalize(join(hosts, path));
  if (!file.startsWith(hosts)) {
    res.writeHead(403);
    return res.end();
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
  res.end(readFileSync(file));
}).listen(5592);

console.log("variant harness: hosts http://localhost:5592/  layer :5174  api :5198");
