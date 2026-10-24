(function () {
  "use strict";
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("primary-nav");
  if (toggle && nav) {
    var setOpen = function (open) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      nav.classList.toggle("is-open", open);
    };
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("a")) setOpen(false);
    });
    var mq = window.matchMedia("(min-width: 1140px)");
    var onMq = function () { if (mq.matches) setOpen(false); };
    if (mq.addEventListener) mq.addEventListener("change", onMq);
  }

  var news = document.getElementById("newsletter");
  if (news) {
    news.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = document.getElementById("nl-email");
      var status = document.getElementById("nl-status");
      if (!input.value || input.validity.typeMismatch) {
        status.textContent = "Enter a valid email address.";
        input.focus();
        return;
      }
      status.textContent = "Thanks for signing up.";
      news.reset();
    });
  }

  var form = document.getElementById("give-form");
  if (form) {
    var once = document.getElementById("freq-once");
    var monthly = document.getElementById("freq-monthly");
    var submit = document.getElementById("give-submit");
    var other = document.getElementById("other-wrap");
    var otherInput = document.getElementById("other-amt");
    var isMonthly = false;
    var render = function () {
      var checked = form.querySelector('input[name="amount"]:checked');
      var val = checked ? checked.value : "";
      other.hidden = val !== "other";
      var amt = val === "other" ? otherInput.value.replace(/[^0-9.]/g, "") : val;
      var label = amt ? "Give $" + amt : "Give";
      submit.textContent = label + (isMonthly ? " monthly" : " one time");
    };
    var setFreq = function (m) {
      isMonthly = m;
      once.setAttribute("aria-pressed", m ? "false" : "true");
      monthly.setAttribute("aria-pressed", m ? "true" : "false");
      render();
    };
    once.addEventListener("click", function () { setFreq(false); });
    monthly.addEventListener("click", function () { setFreq(true); });
    form.addEventListener("change", render);
    otherInput.addEventListener("input", render);
    form.addEventListener("submit", function (e) { e.preventDefault(); });
    if (/[?&]monthly(=|&|$)/.test(window.location.search)) setFreq(true); else render();
  }

  var filter = document.getElementById("day-filter");
  var rows = document.querySelectorAll("#site-rows tr");
  if (filter && rows.length) {
    var count = document.getElementById("filter-count");
    var apply = function () {
      var day = filter.value, shown = 0;
      rows.forEach(function (row) {
        var match = day === "all" || (" " + row.getAttribute("data-days") + " ").indexOf(" " + day + " ") > -1;
        row.hidden = !match;
        if (match) shown++;
      });
      count.textContent = "Showing " + shown + " of " + rows.length + " sites.";
    };
    filter.addEventListener("change", apply);
    apply();
  }
})();
