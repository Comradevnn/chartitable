// Demo control panel (staff). Static page, no framework.
// Backend calls are plain Convex HTTP calls (same as health.js). The PIN lives only
// in the `pin` variable below: never stored, never put in a URL, never logged.
// All dynamic text goes in through textContent. URLs from demo:link are used only as
// a navigation target and are never displayed or logged.
(function () {
  "use strict";
  var cfg = window.CHARTITABLE_CONFIG || {};
  var convexUrl = String(cfg.convexUrl || "").replace(/\/+$/, "");
  var $ = function (id) { return document.getElementById(id); };

  var lockEl = $("lock"), appEl = $("app"), pinForm = $("pin-form"), pinInput = $("pin");
  var lockErr = $("lock-error"), unlockBtn = $("unlock");
  var readyEl = $("ready"), readyIco = $("ready-ico"), readyTitle = $("ready-title"), readyAge = $("ready-age");
  var checksEl = $("checks"), recheckBtn = $("recheck");
  var personasEl = $("personas"), personasMsg = $("personas-msg"), updatesEl = $("updates");
  var emailBtn = $("send-email"), emailOut = $("email-out");
  var resetBtn = $("reset"), warmBtn = $("warm"), resetOut = $("reset-out"), resetDlg = $("reset-dialog");
  var runsheet = $("runsheet");

  var CHARITIES = [
    { id: "demo-pantry-a", name: "Cinderwell" },
    { id: "demo-pantry-b", name: "Brindlecote" }
  ];
  var STATES = [
    { id: "stranger", title: "First-time visitor" },
    { id: "first_impact", title: "First impact" },
    { id: "just_gave", title: "Just gave" },
    { id: "news", title: "News" },
    { id: "repeat", title: "Repeat donor" },
    { id: "lapsed", title: "Lapsed donor" }
  ];
  var PRESETS = [
    { id: "meals80", label: "Served 80 meals" },
    { id: "produce120", label: "Received 120 lb produce" },
    { id: "volunteer3", label: "3 volunteer shifts" }
  ];
  var EMAIL_STATUS = {
    sent: "Sent", already_sent: "Already sent", not_crossed: "Not crossed yet", not_configured: "Not configured",
    smoke_active: "Test rows present", not_email_persona: "Not an email persona", no_email: "No email on file",
    failed: "Failed", skipped: "Skipped"
  };
  var CHECK_WORD = { green: "OK", amber: "Warning", red: "Problem" };

  // The PIN lives only in this variable.
  var pin = null;
  var resetting = false;
  var preflightBusy = false, checkedAt = null, lastOverall = "unknown";
  var personaList = [], emailPersona = null;
  var postIds = {}; // requestId per charity+preset, kept until that click succeeds so a retry is idempotent

  // ---------- helpers ----------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function setMsg(node, kind, text, sub) {
    node.className = "msg" + (kind ? " " + kind : "");
    node.textContent = text;
    if (sub) node.appendChild(el("span", "sub", sub));
    node.hidden = false;
  }
  function clearMsg(node) { node.hidden = true; node.textContent = ""; }
  function newRequestId() { return crypto.randomUUID().replace(/-/g, ""); }
  function firstName(label) {
    var head = String(label || "").split(" · ")[0].trim();
    return head.split(/\s+/)[0] || "";
  }

  // Convex HTTP call. Rejects with an Error whose .code is the server's errorData
  // string ("unauthorized", "locked"), or "network" / "failed".
  function call(kind, path, args) {
    return fetch(convexUrl + "/api/" + kind, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path, args: args, format: "json" })
    }).then(function (r) { return r.json(); }, function () {
      throw codeError("network");
    }).then(function (j) {
      if (j && j.status === "success") return j.value;
      var e = j && j.errorData;
      throw codeError(typeof e === "string" ? e : "failed");
    });
  }
  function codeError(code) { var e = new Error(code); e.code = code; return e; }

  // Returns true when the error was an auth problem and we went back to the PIN screen.
  function handleAuth(err) {
    if (!err) return false;
    if (err.code === "unauthorized") { lock("That PIN didn't work."); return true; }
    if (err.code === "locked") { lock("Too many wrong PINs. Try again in 10 minutes."); return true; }
    return false;
  }
  function lock(message) {
    pin = null;
    stopTimers();
    if (resetDlg.open) resetDlg.close();
    appEl.hidden = true;
    lockEl.hidden = false;
    unlockBtn.disabled = false;
    unlockBtn.textContent = "Unlock";
    if (message) { lockErr.textContent = message; lockErr.hidden = false; }
    pinInput.value = "";
    pinInput.focus();
  }

  // ---------- readiness ----------
  function ago(ms) {
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return s + " s ago";
    return Math.round(s / 60) + " min ago";
  }
  function setOverall(state, title) {
    lastOverall = state;
    readyEl.setAttribute("data-state", state);
    readyIco.className = "ico " + state;
    readyTitle.textContent = title;
  }
  function renderAge() {
    if (preflightBusy) readyAge.textContent = "Checking now...";
    else if (checkedAt === null) readyAge.textContent = "Not checked yet.";
    else readyAge.textContent = "Checked " + ago(checkedAt);
  }
  function measureReady() {
    document.documentElement.style.setProperty("--ready-h", readyEl.offsetHeight + "px");
  }
  function renderReady(r) {
    var overall = r && (r.overall === "green" || r.overall === "amber" || r.overall === "red") ? r.overall : "unknown";
    var title = overall === "green" ? "Ready for the demo"
      : overall === "amber" ? "Ready, with warnings"
      : overall === "red" ? "Not ready" : "Status unknown";
    setOverall(overall, title);
    checksEl.textContent = "";
    ((r && r.checks) || []).forEach(function (c) {
      var st = CHECK_WORD[c.status] ? c.status : "unknown";
      var li = el("li", "check st-" + st);
      li.appendChild(el("span", "ico " + st));
      var lab = el("span", "check-label", c.label);
      lab.appendChild(el("span", "word", CHECK_WORD[st] || "Unknown"));
      li.appendChild(lab);
      if (c.detail) li.appendChild(el("span", "check-detail", c.detail));
      checksEl.appendChild(li);
    });
    measureReady();
  }
  function renderUnknown() {
    setOverall("unknown", "Status unknown");
    checksEl.textContent = "";
    checksEl.appendChild(el("li", "check", "Could not reach the backend. Try Check again."));
    checkedAt = null;
    measureReady();
  }

  // Resolves true on success, false on failure. Never overlaps itself.
  function runPreflight() {
    if (pin === null || preflightBusy) return Promise.resolve(false);
    preflightBusy = true;
    recheckBtn.disabled = true;
    renderAge();
    return call("action", "demo:preflight", { pin: pin }).then(function (r) {
      preflightBusy = false;
      recheckBtn.disabled = false;
      checkedAt = Date.now();
      renderReady(r);
      renderAge();
      return true;
    }).catch(function (err) {
      preflightBusy = false;
      recheckBtn.disabled = false;
      if (handleAuth(err)) return false;
      renderUnknown();
      renderAge();
      return false;
    });
  }

  var autoTimer = null, ageTimer = null;
  function startTimers() {
    stopTimers();
    autoTimer = setInterval(function () {
      if (document.visibilityState === "visible" && !resetting) runPreflight();
    }, 30000);
    ageTimer = setInterval(renderAge, 1000);
  }
  function stopTimers() {
    if (autoTimer) clearInterval(autoTimer);
    if (ageTimer) clearInterval(ageTimer);
    autoTimer = ageTimer = null;
  }
  document.addEventListener("visibilitychange", function () {
    if (pin !== null && document.visibilityState === "visible" && !resetting &&
        (checkedAt === null || Date.now() - checkedAt > 30000)) runPreflight();
  });
  window.addEventListener("resize", function () { if (!appEl.hidden) measureReady(); });
  recheckBtn.addEventListener("click", function () { runPreflight(); });

  // ---------- unlock ----------
  pinForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    lockErr.hidden = true;
    if (!convexUrl) { setMsg(lockErr, "err", "Not configured: set convexUrl in config.js."); return; }
    var v = pinInput.value;
    if (!v) { setMsg(lockErr, "err", "Enter the demo PIN."); return; }
    pin = v;
    pinInput.value = "";
    unlockBtn.disabled = true;
    unlockBtn.textContent = "Checking...";
    runPreflight().then(function (ok) {
      if (pin === null) return; // handleAuth already went back to the PIN screen
      if (!ok) {
        pin = null;
        unlockBtn.disabled = false;
        unlockBtn.textContent = "Unlock";
        setMsg(lockErr, "err", "Could not reach the backend. Try again.");
        return;
      }
      lockEl.hidden = true;
      appEl.hidden = false;
      runsheet.open = window.matchMedia("(min-width: 960px)").matches;
      measureReady();
      startTimers();
      loadPersonas();
    });
  });

  // ---------- personas ----------
  function loadPersonas() {
    clearMsg(personasMsg);
    call("query", "demo:personas", {}).then(function (list) {
      personaList = Array.isArray(list) ? list : [];
      emailPersona = null;
      personaList.forEach(function (p) { if (p.email && !emailPersona) emailPersona = p; });
      renderPersonas();
      renderEmailButton();
    }).catch(function () {
      personasEl.textContent = "";
      setMsg(personasMsg, "err", "Could not load the donor list.");
      var retry = el("button", "btn secondary", "Try again");
      retry.type = "button";
      retry.addEventListener("click", loadPersonas);
      personasEl.appendChild(retry);
    });
  }
  function findPersona(state, charityId) {
    for (var i = 0; i < personaList.length; i++) {
      var p = personaList[i];
      if (p.state === state && p.charityId === charityId) return p;
    }
    return null;
  }
  function renderPersonas() {
    personasEl.textContent = "";
    STATES.forEach(function (st) {
      var first = findPersona(st.id, CHARITIES[0].id) || findPersona(st.id, CHARITIES[1].id);
      if (!first) return;
      var card = el("article", "persona");
      var h = el("h3", null, st.title);
      var hero = false;
      CHARITIES.forEach(function (c) { var p = findPersona(st.id, c.id); if (p && p.hero) hero = true; });
      if (hero) h.appendChild(el("span", "tag", "Story donor"));
      card.appendChild(h);
      var desc = el("p", "persona-desc");
      desc.appendChild(el("strong", null, first.label));
      desc.appendChild(document.createTextNode(". " + (first.description || "")));
      card.appendChild(desc);
      var note = el("p", "msg err");
      note.hidden = true;
      note.setAttribute("role", "status");
      var opens = el("div", "opens");
      CHARITIES.forEach(function (c) {
        var p = findPersona(st.id, c.id);
        if (!p) return;
        var who = st.id === "stranger" ? "a first-time visitor" : (firstName(p.label) || "this donor");
        var btn = el("button", "btn secondary");
        btn.type = "button";
        var text = "Open " + c.name + " as " + who;
        btn.textContent = text;
        btn.addEventListener("click", function () { openPersona(btn, text, p, note); });
        opens.appendChild(btn);
      });
      card.appendChild(opens);
      card.appendChild(note);
      personasEl.appendChild(card);
    });
  }
  // A blank window that nothing has loaded into yet (safe to close on failure).
  function isBlank(w) {
    try { return w.location.href === "about:blank"; } catch (e) { return false; }
  }
  function openPersona(btn, text, p, note) {
    if (btn.disabled || pin === null) return;
    clearMsg(note);
    // Open synchronously inside the click so popup blockers allow it; the named target
    // means a second click reuses the same tab.
    var w = window.open("", "ct-" + p.id);
    if (!w) {
      setMsg(note, "warn", "Popup blocked. Allow popups for this site, then click again.");
      return;
    }
    btn.disabled = true;
    call("action", "demo:link", { pin: pin, personaId: p.id }).then(function (r) {
      btn.disabled = false;
      if (r && r.ok && typeof r.url === "string") {
        try { w.opener = null; } catch (e) { /* cross-origin tab being reused */ }
        w.location.replace(r.url);
        btn.textContent = "Opened ✓";
        btn.classList.add("done");
        setTimeout(function () { btn.textContent = text; btn.classList.remove("done"); }, 2500);
      } else {
        if (isBlank(w)) w.close();
        setMsg(note, "err", "Could not open: " + ((r && r.error) || "unknown error"));
      }
    }).catch(function (err) {
      btn.disabled = false;
      if (isBlank(w)) w.close();
      if (handleAuth(err)) return;
      setMsg(note, "err", "Could not open the link. Try again.");
    });
  }

  // ---------- staff updates ----------
  var presetButtons = [];
  function renderUpdates() {
    updatesEl.textContent = "";
    CHARITIES.forEach(function (c) {
      var row = el("div", "charity-row");
      row.appendChild(el("h3", null, c.name));
      var grid = el("div", "presets");
      var out = el("p", "msg");
      out.hidden = true;
      out.setAttribute("role", "status");
      PRESETS.forEach(function (pr) {
        var primary = c.id === CHARITIES[0].id && pr.id === "meals80";
        var btn = el("button", "btn " + (primary ? "primary" : "secondary"), pr.label);
        btn.type = "button";
        btn.addEventListener("click", function () { postUpdate(c, pr, out); });
        presetButtons.push(btn);
        grid.appendChild(btn);
      });
      row.appendChild(grid);
      row.appendChild(out);
      updatesEl.appendChild(row);
    });
  }
  function setPresetsDisabled(v) { presetButtons.forEach(function (b) { b.disabled = v; }); }
  function postUpdate(c, pr, out) {
    if (pin === null || presetButtons.some(function (b) { return b.disabled; })) return;
    var key = c.id + ":" + pr.id;
    if (!postIds[key]) postIds[key] = newRequestId();
    setPresetsDisabled(true);
    setMsg(out, "", "Logging...");
    call("action", "demo:post", { pin: pin, charityId: c.id, preset: pr.id, requestId: postIds[key] }).then(function (r) {
      setPresetsDisabled(false);
      if (r && r.ok) {
        delete postIds[key];
        setMsg(out, "", "Just logged ✓ " + r.label + " · " + r.donorsCredited + " donors credited",
          "Open donor tabs update within about 6 seconds.");
      } else {
        setMsg(out, "err", "Not logged: " + ((r && r.error) || "unknown error"));
      }
    }).catch(function (err) {
      setPresetsDisabled(false);
      if (handleAuth(err)) return;
      setMsg(out, "err", "Not logged. Check the connection and click again (it will not log twice).");
    });
  }

  // ---------- milestone email ----------
  function renderEmailButton() {
    if (!emailPersona) { emailBtn.disabled = true; return; }
    var name = firstName(emailPersona.label) || "Mira";
    emailBtn.textContent = "Send " + name + "'s milestone email";
    emailBtn.disabled = false;
  }
  emailBtn.addEventListener("click", function () {
    if (!emailPersona || pin === null || emailBtn.disabled) return;
    emailBtn.disabled = true;
    setMsg(emailOut, "", "Sending...");
    call("action", "demo:sendEmail", { pin: pin, personaId: emailPersona.id }).then(function (r) {
      emailBtn.disabled = false;
      var status = r && r.status;
      var good = r && r.ok && (status === "sent" || status === "already_sent");
      var line = "Status: " + (EMAIL_STATUS[status] || String(status || "unknown"));
      setMsg(emailOut, good ? "" : (r && r.ok ? "warn" : "err"), line, r && r.detail ? String(r.detail) : "");
    }).catch(function (err) {
      emailBtn.disabled = false;
      if (handleAuth(err)) return;
      setMsg(emailOut, "err", "Could not send. Try again.");
    });
  });

  // ---------- reset + warm ----------
  function storiesLine(w) {
    if (!w) return "";
    var s = (w.claude || 0) + " of " + (w.total || 0) + " stories ready (Claude).";
    if (w.template) s += " " + w.template + " using the template.";
    if (w.failed) s += " " + w.failed + " failed.";
    return s;
  }
  function setBusy(v) {
    resetting = v;
    resetBtn.disabled = v;
    warmBtn.disabled = v;
  }
  function runLong(label, path, doneText) {
    if (pin === null || resetting) return;
    setBusy(true);
    var started = Date.now();
    function tick() { setMsg(resetOut, "", label + " " + Math.round((Date.now() - started) / 1000) + " s"); }
    tick();
    var t = setInterval(tick, 1000);
    call("action", path, { pin: pin }).then(function (r) {
      clearInterval(t);
      setBusy(false);
      var warm = path === "demo:reset" ? r && r.warm : r;
      var parts = [doneText + " " + storiesLine(warm)];
      if (path === "demo:reset" && r && r.emailSet === false) parts.push("Demo inbox not set.");
      setMsg(resetOut, warm && warm.failed ? "warn" : "", parts.join(" ").replace(/\s+/g, " ").trim());
      runPreflight();
    }).catch(function (err) {
      clearInterval(t);
      setBusy(false);
      if (handleAuth(err)) return;
      setMsg(resetOut, "err", "That did not finish. Check readiness above, then try again.");
      runPreflight();
    });
  }
  resetBtn.addEventListener("click", function () {
    if (resetting) return;
    if (typeof resetDlg.showModal === "function") { resetDlg.returnValue = ""; resetDlg.showModal(); }
    else if (window.confirm("Reset the demo? This removes gifts and updates made since the last reset and restores every persona. Takes about a minute.")) {
      runLong("Resetting...", "demo:reset", "Reset done.");
    }
  });
  resetDlg.addEventListener("close", function () {
    if (resetDlg.returnValue === "reset") runLong("Resetting...", "demo:reset", "Reset done.");
  });
  warmBtn.addEventListener("click", function () { runLong("Warming stories...", "demo:warm", "Warm done."); });

  renderUpdates();
})();
