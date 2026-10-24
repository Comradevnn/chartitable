(function () {
  "use strict";
  var CHARITIES = ["demo-pantry-a", "demo-pantry-b"];
  var MIN = 1, MAX = 500;
  var cfg = window.CHARTITABLE_CONFIG || {};
  var convexUrl = String(cfg.convexUrl || "").replace(/\/+$/, "");

  var $ = function (id) { return document.getElementById(id); };
  var form = $("donate-form"), notice = $("notice"), errEl = $("error"), btn = $("submit");
  var custom = $("custom"), customField = $("custom-field");

  var charityId = new URLSearchParams(location.search).get("charity");
  var MESSAGES = {
    charity: "This donation link isn't valid.",
    amount: "Please choose an amount from $1 to $500 in whole dollars.",
    firstName: "First name can use letters, spaces, hyphens and apostrophes only (40 characters max).",
    email: "That email address doesn't look right.",
    generic: "Something went wrong. Please try again.",
    unavailable: "Donations aren't available right now."
  };

  function showNotice(msg) { notice.textContent = msg; notice.hidden = false; }
  function showError(msg) { errEl.textContent = msg; errEl.hidden = false; }
  function clearError() { errEl.hidden = true; errEl.textContent = ""; }

  function call(kind, path, args) {
    return fetch(convexUrl + "/api/" + kind, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path, args: args, format: "json" })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.status === "success") return j.value;
      throw new Error("call failed");
    });
  }

  function selectedRadio() {
    var r = form.querySelector('input[name="amount"]:checked');
    return r ? r.value : "25";
  }
  // Whole dollars 1-500, or null.
  function currentDollars() {
    var sel = selectedRadio();
    var raw = sel === "custom" ? custom.value.trim() : sel;
    if (!/^\d{1,3}$/.test(raw)) return null;
    var n = parseInt(raw, 10);
    return n >= MIN && n <= MAX ? n : null;
  }
  function updateButton() {
    var d = currentDollars();
    btn.textContent = d === null ? "Give (test)" : "Give $" + d + " (test)";
  }

  // Mirrors engine/donate.ts validateDonation (server re-validates).
  function validate() {
    var dollars = currentDollars();
    if (dollars === null) return { error: "amount" };
    var first = $("firstName").value.trim();
    if (first !== "" && (first.length > 40 || !/^[\p{L} '-]+$/u.test(first))) return { error: "firstName" };
    var email = $("email").value.trim().toLowerCase();
    if (email !== "" && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: "email" };
    var args = { charityId: charityId, amountCents: dollars * 100, hideFromTopDonors: $("hide").checked };
    if (first !== "") args.firstName = first;
    if (email !== "") args.email = email;
    return { args: args };
  }

  function onSubmit(e) {
    e.preventDefault();
    clearError();
    var v = validate();
    if (v.error) { showError(MESSAGES[v.error]); return; }
    btn.disabled = true;
    call("mutation", "donations:create", v.args).then(function (res) {
      if (res && res.ok && typeof res.redirectUrl === "string") {
        location.replace(res.redirectUrl);
        return;
      }
      var code = res && res.error;
      showError(MESSAGES[code] || MESSAGES.generic);
      btn.disabled = false;
    }).catch(function () {
      showError(MESSAGES.generic);
      btn.disabled = false;
    });
  }

  function onAmountChange() {
    var isCustom = selectedRadio() === "custom";
    customField.hidden = !isCustom;
    if (isCustom) custom.focus();
    updateButton();
  }

  function init() {
    if (CHARITIES.indexOf(charityId) === -1) { showNotice(MESSAGES.charity); return; }
    if (!convexUrl) {
      showNotice("Not configured: set convexUrl in config.js.");
      form.hidden = false;
      btn.disabled = true;
      return;
    }
    form.hidden = false;
    form.addEventListener("submit", onSubmit);
    form.addEventListener("change", onAmountChange);
    custom.addEventListener("input", updateButton);
    updateButton();
    call("query", "donations:charityInfo", { charityId: charityId }).then(function (info) {
      if (!info || typeof info.name !== "string") {
        form.hidden = true;
        showNotice(MESSAGES.charity);
        return;
      }
      $("title").textContent = "Give to " + info.name;
      document.title = "Give to " + info.name + " (test mode)";
    }).catch(function () { showNotice(MESSAGES.generic); });
  }

  init();
})();
