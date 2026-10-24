// Local stub for layer.js self-checks. Not part of the embed.
// GET /donor-view reads donor-view.json. Tokens: hostile, bad, junk, slow.
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, "..", "..");
const stub = readFileSync(join(dir, "donor-view.json"));
const hostile = readFileSync(join(dir, "donor-view.hostile.json"));
const layerPath = join(dir, "..", "dist", "layer.smoke.js");
const cratePath = join(root, "demo-sites", "test-hosts", "_preview", "preview-crate.svg");
const hits = [];

function send(res, status, type, body) {
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1:5198");
  if (req.method === "OPTIONS") {
    send(res, 204, "text/plain", "");
    return;
  }
  if (url.pathname === "/donor-view") {
    const auth = String(req.headers.authorization || "");
    hits.push({ auth, charity: url.searchParams.get("charity") || "" });
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token === "slow") {
      setTimeout(() => send(res, 200, "application/json", stub), 5000);
      return;
    }
    if (token === "junk") {
      send(res, 200, "text/html", "<html>nope</html>");
      return;
    }
    if (token === "bad") {
      send(res, 200, "application/json", '{"recognized":false}');
      return;
    }
    if (token === "hostile") {
      send(res, 200, "application/json", hostile);
      return;
    }
    send(res, 200, "application/json", stub);
    return;
  }
  if (url.pathname === "/hits") {
    send(res, 200, "application/json", JSON.stringify(hits));
    return;
  }
  if (url.pathname === "/reset") {
    hits.length = 0;
    send(res, 200, "text/plain", "ok");
    return;
  }
  if (url.pathname === "/layer.js") {
    if (!existsSync(layerPath)) {
      send(res, 404, "text/plain", "missing layer.smoke.js");
      return;
    }
    send(res, 200, "text/javascript", readFileSync(layerPath));
    return;
  }
  if (url.pathname === "/preview-crate.svg" && existsSync(cratePath)) {
    send(res, 200, "image/svg+xml", readFileSync(cratePath));
    return;
  }
  const rel = normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
  const file = join(dir, rel === "/" || rel === "." ? "smoke.html" : rel);
  if (!file.startsWith(dir) || !existsSync(file)) {
    send(res, 404, "text/plain", "not found");
    return;
  }
  const type = file.endsWith(".json") ? "application/json" : "text/html";
  send(res, 200, type, readFileSync(file));
});

server.listen(5198, "127.0.0.1", () => {
  process.stdout.write("smoke server http://127.0.0.1:5198\n");
});
