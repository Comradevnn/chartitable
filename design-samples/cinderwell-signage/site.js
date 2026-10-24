(function () {
  "use strict";

  /* Desk form (unchanged behavior). */
  var form = document.querySelector("[data-desk-form]");
  if (form) {
    var input = form.querySelector("input[type=email]");
    var status = form.querySelector("[data-form-status]");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var value = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        status.textContent = "That doesn't look like an email. Try name@example.com, or call (555) 010-2201.";
        input.focus();
        return;
      }
      status.textContent = "This test site does not send mail. Call (555) 010-2201 and the desk will add you.";
    });
  }

  /* Host-side presentation of the layer's filled slots. Moves existing nodes only;
     it never writes new facts. Without JS the slots still read correctly, just expanded. */
  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function group(label, items, className) {
    if (!items.length) return null;
    var wrap = el("div", "ct-group " + className);
    var head = el("h3", "ct-group-label");
    head.textContent = label;
    wrap.appendChild(head);
    var list = el("ul", "ct-facts");
    items.forEach(function (item) { list.appendChild(item); });
    wrap.appendChild(list);
    return wrap;
  }

  /* Give logged records and estimates each a labelled group so the estimate has a subject. */
  function groupFacts(root) {
    var lists = root.querySelectorAll(".ct-facts");
    var records = [];
    var estimates = [];
    Array.prototype.forEach.call(lists, function (list) {
      Array.prototype.forEach.call(list.children, function (item) {
        if (item.classList.contains("ct-estimate")) estimates.push(item);
        else records.push(item);
      });
    });
    var groups = [
      group("Logged by the pantry", records, "ct-group-record"),
      group("About your share, an estimate", estimates, "ct-group-estimate")
    ].filter(Boolean);
    Array.prototype.forEach.call(lists, function (list) { list.remove(); });
    return groups;
  }

  function enhanceHero(hero) {
    if (hero.getAttribute("data-impact-state") !== "ready") return;
    if (hero.querySelector(".ct-details")) return;
    var greeting = hero.querySelector(".ct-greeting");
    var story = hero.querySelector(".ct-story");
    var figure = hero.querySelector(".ct-figure");
    var groups = groupFacts(hero);
    var rest = null;

    if (greeting) {
      greeting.setAttribute("role", "heading");
      greeting.setAttribute("aria-level", "2");
    }
    if (story) {
      var full = story.textContent;
      var match = full.match(/^([\s\S]+?[.!?])\s+([\s\S]+)$/);
      if (match) {
        story.textContent = match[1];
        rest = el("p", "ct-story-rest");
        rest.textContent = match[2];
      }
    }
    if (!groups.length && !rest && !figure) return;

    var details = el("details", "ct-details");
    var summary = el("summary");
    summary.textContent = "What the pantry logged, and your share (an estimate)";
    details.appendChild(summary);
    var body = el("div", "ct-detail-body");
    if (rest) body.appendChild(rest);
    groups.forEach(function (g) { body.appendChild(g); });
    if (figure) body.appendChild(figure);
    details.appendChild(body);
    hero.appendChild(details);
  }

  function enhanceSince(since) {
    if (since.getAttribute("data-impact-state") !== "ready") return;
    if (since.querySelector(".ct-group")) return;
    groupFacts(since).forEach(function (g) { since.appendChild(g); });
  }

  function watch(selector, fn) {
    var slot = document.querySelector(selector);
    if (!slot || !window.MutationObserver) return;
    fn(slot);
    new MutationObserver(function () { fn(slot); }).observe(slot, {
      attributes: true,
      attributeFilter: ["data-impact-state"]
    });
  }

  watch('[data-impact-slot="hero"]', enhanceHero);
  watch('[data-impact-slot="since-last-visit"]', enhanceSince);
})();
