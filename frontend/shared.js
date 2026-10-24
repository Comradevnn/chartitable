// Chartitable demo pages: shared helpers (index.html, dashboard.html, admin.html).
// Classic script (no modules, no fetch) so every page still works when opened from file://.
// Load order on each page: demo-data.js, shared.js, then the page's own inline script.
// Everything is exposed on ONE global: window.CT. The pages destructure what they need.
window.CT = (function () {
  const DAY = 864e5;
  const ts = s => Date.parse(s + "T12:00:00Z"); // noon UTC so dates never drift across timezones

  // ---- formatting ----
  const money = c => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: c % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(c / 100); // the one money formatter (integer cents in)
  const fmtDate = (t, y) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(y ? { year: "numeric" } : {}), timeZone: "UTC" });
  const monthOf = t => new Date(t).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const dateLabel = t => new Date(t).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isoDate = t => new Date(t).toISOString().slice(0, 10); // for <time datetime="...">
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
  const recText = r => r.kind === "produce" ? `${r.count} ${r.unit} of produce received` : `${r.count} ${r.count === 1 ? "meal" : "meals"} served`;
  const estText = e => `about ${e.approxQuantity} ${e.kind === "produce" ? e.unit + " of produce" : e.approxQuantity === 1 ? "meal" : "meals"}`;
  const setCharityName = name => document.querySelectorAll("[data-charity-name]").forEach(el => el.textContent = name);

  // ---- estimates: the one place the allocation math lives (index and dashboard both call it, so they cannot disagree) ----
  // PRODUCT_SPEC §3 rounding: below 1 shows 0, below 100 rounds down to a whole number, 100 and up rounds down to a multiple of 5. Never overstates.
  const roundEstimate = v => { v += 1e-9; return !(v >= 1) ? 0 : v < 100 ? Math.floor(v) : Math.floor(v / 5) * 5; };
  // the shared gift pool: every donor's gifts (integer cents)
  const poolOf = data => data.donors.flatMap(d => d.gifts.map(g => ({ donor: d.id, at: g.at, cents: g.amountCents, label: g.label })));
  // PRODUCT_SPEC §3 allocation: for each staff log in the 30-day window, this donor's share = their gift cents ÷ everyone's gift cents,
  // counting only gifts inside the window made on or before the log's date. Per-log quantity = share × log count (kept exact, rounded only after summing).
  function allocate(donorId, data = window.DEMO_DATA) {
    const now = data.now, from = now - data.charity.windowDays * DAY, pool = poolOf(data);
    return data.impactLogs.filter(l => l.loggedAt >= from && l.loggedAt <= now).sort((a, b) => a.loggedAt - b.loggedAt).map(log => {
      const elig = pool.filter(g => g.cents > 0 && g.at >= from && g.at <= log.loggedAt);
      const poolCents = sum(elig, g => g.cents), mineCents = sum(elig.filter(g => g.donor === donorId), g => g.cents);
      return { log, poolCents, mineCents, share: poolCents ? mineCents / poolCents : 0, qty: poolCents ? mineCents * log.count / poolCents : 0 };
    }).filter(r => r.poolCents > 0 && r.mineCents > 0);
  }
  const estimatesOf = rows => ["meals", "produce"].map(kind => ({ kind, unit: kind === "meals" ? "meals" : "lb", approxQuantity: roundEstimate(sum(rows.filter(r => r.log.kind === kind), r => r.qty)), marker: "about" })).filter(e => e.approxQuantity > 0);
  const recordOf = l => ({ logId: l.id, kind: l.kind, count: l.count, unit: l.unit, dateLabel: dateLabel(l.loggedAt), note: l.note, hasPhoto: false, loggedAt: l.loggedAt });
  // the one computed result for a donor: gifts, records, estimates, since-last-visit. `dv` needs { id, lastVisitAt }.
  function donorResult(dv, data = window.DEMO_DATA) {
    const now = data.now, rows = allocate(dv.id, data);
    const gifts = poolOf(data).filter(g => g.donor === dv.id).sort((a, b) => b.at - a.at).map(g => ({ at: g.at, amountCents: g.cents, label: g.label })); // newest first
    const firstAt = gifts.length ? gifts[gifts.length - 1].at : now, from = now - data.charity.windowDays * DAY;
    const records = data.impactLogs.filter(l => l.loggedAt >= Math.max(from, firstAt) && l.loggedAt <= now).sort((a, b) => b.loggedAt - a.loggedAt).map(recordOf);
    const sRecords = dv.lastVisitAt ? records.filter(r => r.loggedAt > dv.lastVisitAt) : [], sRows = dv.lastVisitAt ? rows.filter(r => r.log.loggedAt > dv.lastVisitAt) : [];
    return { gifts, rows, records, estimates: estimatesOf(rows),
      sinceLastVisit: sRecords.length ? { sinceDateLabel: fmtDate(dv.lastVisitAt), records: sRecords, rows: sRows, estimates: estimatesOf(sRows) } : null };
  }

  // ---- formula tooltip: markup + behavior ----
  let tipN = 0;
  const tipHtml = (label, bodyHtml) => { const id = "tip" + ++tipN; return `<span class="ct-tip"><button type="button" class="ct-why" aria-expanded="false" aria-describedby="${id}">${label}</button><span role="tooltip" id="${id}" class="ct-tip-body" hidden>${bodyHtml}</span></span>`; };
  const tip = (label, text) => tipHtml(label, esc(text));
  // hover, keyboard focus and tap/click (click pins it open); Escape or an outside tap closes. `root` is the element (or document) whose tips it manages.
  function initTooltips(root) {
    const place = b => { b.style.left = "0"; const r = b.getBoundingClientRect(), over = r.right - (document.documentElement.clientWidth - 12); if (over > 0) b.style.left = -over + "px"; };
    const parts = t => ({ b: t.querySelector(".ct-why"), body: t.querySelector(".ct-tip-body") });
    const open = t => { const { b, body } = parts(t); body.hidden = false; b.setAttribute("aria-expanded", "true"); place(body); };
    const close = t => { const { b, body } = parts(t); body.hidden = true; b.setAttribute("aria-expanded", "false"); delete t.dataset.pinned; };
    const tipOf = e => e.target.closest && e.target.closest(".ct-tip");
    root.addEventListener("mouseover", e => { const t = tipOf(e); if (t) open(t); });
    root.addEventListener("mouseout", e => { const t = tipOf(e); if (t && !t.contains(e.relatedTarget) && !t.dataset.pinned && !t.contains(document.activeElement)) close(t); });
    root.addEventListener("focusin", e => { const t = tipOf(e); if (t) open(t); });
    root.addEventListener("focusout", e => { const t = tipOf(e); if (t && !t.contains(e.relatedTarget)) close(t); });
    root.addEventListener("click", e => { const t = tipOf(e); if (!t) return; if (t.dataset.pinned) close(t); else { t.dataset.pinned = "1"; open(t); } });
    document.addEventListener("click", e => { root.querySelectorAll(".ct-tip[data-pinned]").forEach(t => { if (!t.contains(e.target)) close(t); }); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") root.querySelectorAll(".ct-tip").forEach(t => { if (!parts(t).body.hidden) close(t); }); });
  }

  // ---- demo path: the guided pitch route, rendered into the demo bar / ribbon's <nav data-demo-path> ----
  // 1 first-time home -> 2 returning-donor home -> 3 impact page -> 4 staff view. Plain links; the page says which step it is. Not shown when the real layer script is present.
  const layerPresent = () => !!document.querySelector('script[src*="layer"]'); // the one "real layer is here" check (index.html also uses it to hide the whole demo bar)
  function initDemoPath(step) {
    const nav = document.querySelector("[data-demo-path]"), none = { set() {} };
    if (!nav) return none;
    if (layerPresent()) { nav.hidden = true; return none; }
    const d = window.DEMO_DATA, owner = d.donors.find(x => x.id === d.demo.returningDonorId), tok = owner && owner.viewToken;
    const steps = [ // step 1 uses ?view=stranger (index.html clears a remembered returning view); step 2 uses the page's existing ?ct= handling
      ["First visit", "index.html?view=stranger"], ["Returning donor", tok ? "index.html?ct=" + encodeURIComponent(tok) : "index.html"],
      ["Impact page", "dashboard.html"], ["Staff view", "admin.html"]];
    nav.innerHTML = `<span class="dp-title"></span><ol>${steps.map(([l, h], i) => `<li><a href="${h}"><span class="dp-n">${i + 1}</span><span class="dp-l">${l}</span></a></li>`).join("")}</ol><a class="dp-next" href="${steps[0][1]}"></a>`;
    const links = nav.querySelectorAll("ol a"), title = nav.querySelector(".dp-title"), next = nav.querySelector(".dp-next");
    const set = n => { // n = 1..4: highlight the step, say "Step n of 4", and point "Next" at the following page (the last step offers a restart)
      links.forEach((a, i) => { if (i + 1 === n) a.setAttribute("aria-current", "step"); else a.removeAttribute("aria-current"); });
      title.textContent = `Demo path · step ${n} of ${steps.length}`;
      const to = steps[n % steps.length];
      next.href = to[1]; next.textContent = n < steps.length ? `Next: ${to[0]} →` : "Start over ↺";
    };
    set(step);
    return { set };
  }

  // illustration (authored SVG, shared by the home page hero / latest update and the dashboard hero)
  const ART_SVG = '<svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration of a crate of fresh produce"><circle cx="290" cy="110" r="52" fill="#ffc94d"/><path d="M0 330q110-70 220-20t180-30v220H0z" fill="#24543a"/><g fill="#7bc47f"><ellipse cx="150" cy="238" rx="16" ry="38" transform="rotate(-24 150 238)"/><ellipse cx="190" cy="226" rx="16" ry="42" transform="rotate(4 190 226)"/><ellipse cx="228" cy="236" rx="16" ry="38" transform="rotate(26 228 236)"/></g><circle cx="118" cy="296" r="32" fill="#f08a2b"/><circle cx="186" cy="288" r="36" fill="#f5a03a"/><circle cx="256" cy="298" r="30" fill="#8d2f4c"/><circle cx="304" cy="306" r="26" fill="#f08a2b"/><rect x="52" y="312" width="296" height="22" rx="8" fill="#cf9650"/><rect x="62" y="334" width="276" height="130" rx="10" fill="#b9803f"/><path d="M62 378h276M62 420h276" stroke="#8f5f2b" stroke-width="5"/></svg>';

  return { DAY, ts, isoDate, layerPresent, initDemoPath, money, fmtDate, monthOf, dateLabel, esc, sum, recText, estText, setCharityName,
    roundEstimate, allocate, estimatesOf, recordOf, donorResult, tipHtml, tip, initTooltips, ART_SVG };
})();
