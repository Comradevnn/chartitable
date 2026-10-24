/* Cinderwell Community Pantry: menu, newsletter form, donate form summary. Vanilla JS. */
(function () {
  "use strict";

  // Dev preview only (?preview=1|empty): load a copy of the layer's slot styles, since the
  // real layer bundles them. Plain visitors never load this file.
  if (/[?&]preview=(1|empty)\b/.test(window.location.search)) {
    var ps = document.createElement("link");
    ps.rel = "stylesheet";
    ps.href = "preview-slots.css";
    document.head.appendChild(ps);
  }

  // Region templates are cloned after the layer has rewritten the donate links, so copy the
  // rewritten href (the header button is the reference) onto any donate link that appears later.
  var refDonate = document.querySelector(".hdr .btn-donate");
  var mainEl = document.getElementById("main");
  if (refDonate && mainEl && "MutationObserver" in window) {
    new MutationObserver(function () {
      var href = refDonate.getAttribute("href");
      if (!href) return;
      var links = mainEl.querySelectorAll("a[data-impact-donate]");
      for (var i = 0; i < links.length; i++) {
        if (links[i].getAttribute("href") !== href) links[i].setAttribute("href", href);
      }
    }).observe(mainEl, { childList: true, subtree: true });
  }

  var btn = document.querySelector(".menu-btn");
  var nav = document.getElementById("site-nav");
  var wide = window.matchMedia("(min-width: 980px)");

  function setMenu(open) {
    if (!btn || !nav) return;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    nav.classList.toggle("open", open);
  }

  if (btn && nav) {
    btn.addEventListener("click", function () {
      setMenu(btn.getAttribute("aria-expanded") !== "true");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && btn.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        btn.focus();
      }
    });
    var onChange = function () { if (wide.matches) setMenu(false); };
    if (wide.addEventListener) wide.addEventListener("change", onChange);
    else if (wide.addListener) wide.addListener(onChange);
  }

  var news = document.querySelector(".newsletter-form");
  if (news) {
    news.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = news.querySelector(".status");
      var input = news.querySelector("input[type=email]");
      if (input && !input.checkValidity()) { input.reportValidity(); return; }
      if (status) status.textContent = "Thanks for signing up. Look for our next update in your inbox.";
    });
  }

  var give = document.querySelector(".give-form");
  if (give) {
    var summary = give.querySelector(".summary");
    var other = give.querySelector("#other-amount");
    function amount() {
      var chosen = give.querySelector("input[name=amount]:checked");
      if (!chosen) return "";
      if (chosen.value === "other") return other && other.value ? other.value : "";
      return chosen.value;
    }
    function freq() {
      var f = give.querySelector("input[name=frequency]:checked");
      return f ? f.value : "one-time";
    }
    function update() {
      if (!summary) return;
      var a = amount();
      summary.textContent = a ? "Your " + freq() + " gift: $" + a : "Choose an amount to continue.";
    }
    give.addEventListener("change", function (e) {
      if (e.target && e.target.name === "amount" && e.target.value === "other" && other) other.focus();
      update();
    });
    if (other) {
      other.addEventListener("input", function () {
        var o = give.querySelector("#amt-other");
        if (o) o.checked = true;
        update();
      });
    }
    give.addEventListener("submit", function (e) { e.preventDefault(); });
    update();
  }
})();
