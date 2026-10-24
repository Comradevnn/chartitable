# Convex cheat sheet (H1, Haiku from docs.convex.dev, Fri Oct 23 10:55 PM PT; package convex ^1.48)

Items marked (unconfirmed) were not verified against the docs.

- **Schema:** `import { defineSchema, defineTable } from "convex/server"; import { v } from "convex/values";` · `.index("by_x", ["x"])` · `v.union(v.id("_storage"), v.null())`
- **Functions:** `query/mutation/action` and `internal*` from `./_generated/server`; refs via `api.<module>.<fn>` / `internal.<module>.<fn>` from `./_generated/api`.
  - Actions have no `ctx.db`: use `ctx.runQuery` / `ctx.runMutation`. Each run* call is its own transaction. Actions are not retried.
- **Runtime:** the default runtime has `fetch`, Web Crypto (`crypto.subtle`), and `process.env`; no `node:crypto` / `Buffer`. A `"use node"` file may contain actions only.
- **HTTP:** `convex/http.ts`:
  ```ts
  const http = httpRouter();
  http.route({ path, method, handler: httpAction(async (ctx, req) => new Response(...)) });
  export default http;
  ```
  - Parse `new URL(req.url).searchParams` and `req.headers` yourself (no arg validation).
  - CORS: set `Access-Control-Allow-Origin` (+ `Vary: Origin`) on every response, and add a separate `OPTIONS` route returning Allow-Origin/Methods/Headers and `Max-Age`.
  - Served at `https://<deployment>.convex.site` (NOT `.convex.cloud`).
- **Storage:** `ctx.storage.generateUploadUrl()` (1 h expiry). The client POSTs the file and gets `{ storageId }` back; save it via a mutation with `v.id("_storage")`. `ctx.storage.getUrl(id)` gives an unauthenticated URL (null case unconfirmed).
- **Scheduling:** `ctx.scheduler.runAfter(ms, internal.x.y, args)`. `convex/crons.ts`:
  ```ts
  const crons = cronJobs();
  crons.interval("name", { minutes: 5 }, internal.x.y);
  export default crons;
  ```
  Cron times are UTC.
- **Env:** `npx convex env set NAME value` (per deployment; dev and prod are separate); read with `process.env.NAME`.
- **CLI:**
  - `npx convex run seed:load '{}'` (`--prod`, `--push`)
  - `npx convex dev --once` (codegen + push, then exit)
  - `npx convex deploy` (prod)
- **Generic builders before codegen:** `internalMutationGeneric`, `httpActionGeneric`, etc. from `"convex/server"`. Switch to `./_generated/server` after the first `npx convex dev`.
- **Newer API form:** `ctx.db.patch("table", id, {...})` / `ctx.db.delete("table", id)` take the table name first. The older id-only form may be outdated (which version changed it is unconfirmed).
