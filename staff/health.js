(function () {
  "use strict";
  var cfg = window.CHARTITABLE_CONFIG || {};
  var convexUrl = String(cfg.convexUrl || "").replace(/\/+$/, "");
  var $ = function (id) { return document.getElementById(id); };
  var pinForm = $("pin-form"), pinInput = $("pin"), errEl = $("error"), loadBtn = $("load");
  var reportEl = $("report"), sectionsEl = $("sections"), updatedEl = $("updated");
  var autoBox = $("auto"), refreshBtn = $("refresh");

  // The PIN lives only in this variable. Never stored, never put in a URL.
  var pin = null;
  var timer = null;
  var busy = false;

  function showError(msg) { errEl.textContent = msg; errEl.hidden = false; }
  function clearError() { errEl.hidden = true; errEl.textContent = ""; }

  function query(path, args) {
    return fetch(convexUrl + "/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path, args: args, format: "json" })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.status === "success") return j.value;
      throw new Error("call failed");
    });
  }

  function rel(ms, now) {
    var s = Math.round((now - ms) / 1000);
    if (s < 0) s = 0;
    if (s < 60) return s + " s ago";
    var m = Math.round(s / 60);
    if (m < 60) return m + " min ago";
    var h = Math.round(m / 60);
    if (h < 48) return h + " h ago";
    return Math.round(h / 24) + " days ago";
  }
  function when(ms, now) {
    if (typeof ms !== "number") return "never";
    return rel(ms, now) + " (" + new Date(ms).toLocaleString() + ")";
  }
  function yn(v) { return v ? "yes" : "no"; }
  function val(v) { return v === null || v === undefined ? "none" : String(v); }

  function section(title, rows, warn) {
    var sec = document.createElement("section");
    sec.className = "card" + (warn ? " warn" : "");
    var h = document.createElement("h2");
    h.textContent = title;
    sec.appendChild(h);
    var dl = document.createElement("dl");
    rows.forEach(function (row) {
      var dt = document.createElement("dt");
      dt.textContent = row[0];
      var dd = document.createElement("dd");
      dd.textContent = row[1];
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
    sec.appendChild(dl);
    return sec;
  }

  function render(d, now) {
    var n = d.narrative || {}, m = d.milestones || {}, e = d.email || {}, s = d.seed || {}, sm = d.smoke || {};
    var run = m.lastRun;
    var vs = d.visitStates || {};
    var STATE_LABELS = [
      ["just_gave", "Just gave"], ["news", "News"], ["first_impact", "First impact"],
      ["repeat", "Repeat"], ["lapsed", "Lapsed"], ["returning", "Returning"], ["unknown", "Unknown"]
    ];
    var smokeCount = (Number(sm.donors) || 0) + (Number(sm.impactLogs) || 0);
    var nodes = [
      section("Narrative", [
        ["Last call outcome", n.lastCallAt ? val(n.lastCallOutcome) + ", " + when(n.lastCallAt, now) : "no calls yet"],
        ["Last source", val(n.lastSource)],
        ["Guard reasons (last call)", val(n.lastGuardReasonCount)],
        ["Calls last hour", val(n.callsLastHour) + " of " + val(n.maxPerHour)],
        ["Minimum interval", typeof n.minIntervalMs === "number" ? (n.minIntervalMs / 1000) + " s" : "none"]
      ]),
      section("Milestones", [
        ["Email configured", yn(m.configured)],
        ["Last run", run ? when(run.at, now) : "never"],
        ["Skipped because of smoke rows", run ? yn(run.smokeSkipped) : "none"],
        ["Checked", run ? val(run.checked) : "none"],
        ["Sent", run ? val(run.sent) : "none"],
        ["Skipped", run ? val(run.skipped) : "none"],
        ["Failed", run ? val(run.failed) : "none"]
      ]),
      section("Email", [
        ["Last status", val(e.lastStatus)],
        ["Last time", typeof e.lastAt === "number" ? when(e.lastAt, now) : "never"],
        ["Total sent", val(e.sentTotal)]
      ]),
      section("Donor states shown (last 24 h)", STATE_LABELS.map(function (p) {
        return [p[1], val(vs[p[0]] === undefined ? 0 : vs[p[0]])];
      })),
      section("Seed data", [
        ["Charities", val(s.charities)],
        ["Donors", val(s.donors)],
        ["Donations", val(s.donations)],
        ["Impact logs", val(s.impactLogs)],
        ["Expenses", val(s.expenses)]
      ]),
      section(smokeCount > 0 ? "Smoke rows present (clean them up)" : "Smoke rows", [
        ["Smoke donors", val(sm.donors)],
        ["Smoke impact logs", val(sm.impactLogs)]
      ], smokeCount > 0)
    ];
    sectionsEl.textContent = "";
    nodes.forEach(function (x) { sectionsEl.appendChild(x); });
    updatedEl.textContent = "Updated " + new Date(now).toLocaleTimeString() + ".";
  }

  function load(showFailure) {
    if (pin === null || busy) return;
    busy = true;
    var now = Date.now();
    query("ops:health", { pin: pin, now: now }).then(function (d) {
      busy = false;
      clearError();
      pinForm.hidden = true;
      reportEl.hidden = false;
      render(d, now);
      schedule();
    }).catch(function () {
      busy = false;
      if (showFailure) showError("Wrong PIN or backend unavailable");
      if (reportEl.hidden) { pin = null; pinForm.hidden = false; }
      else updatedEl.textContent = "Wrong PIN or backend unavailable";
      loadBtn.disabled = false;
    });
  }

  function schedule() {
    if (timer) { clearInterval(timer); timer = null; }
    if (!autoBox.checked) return;
    timer = setInterval(function () {
      if (document.visibilityState === "visible") load(false);
    }, 15000);
  }

  pinForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    clearError();
    if (!convexUrl) { showError("Not configured: set convexUrl in config.js."); return; }
    var v = pinInput.value;
    if (!v) { showError("Enter the staff PIN."); return; }
    pin = v;
    pinInput.value = "";
    loadBtn.disabled = true;
    load(true);
  });
  refreshBtn.addEventListener("click", function () { load(false); });
  autoBox.addEventListener("change", schedule);
})();
