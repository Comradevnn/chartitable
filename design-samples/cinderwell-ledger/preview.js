/* Dev-only preview harness. NOT the production Chartitable layer.
   Fills contract slots from donor-view.sample.json when the URL has ?preview=1.
   ?preview=empty loads the unrecognized sample and leaves slots empty.
   Text nodes only. No innerHTML. */
(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var mode = params.get("preview");
  if (mode !== "1" && mode !== "empty") return;

  function make(tag, className) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  }

  function addText(el, value) {
    el.appendChild(document.createTextNode(value));
    return el;
  }

  var banner = make("p", "ct-preview-banner");
  banner.setAttribute("role", "status");
  if (mode === "empty") {
    addText(
      banner,
      "Dev preview only. This is not the production Chartitable layer. Sample visitor is not recognized, so the slots stay empty."
    );
  } else {
    addText(
      banner,
      "Dev preview only. This is not the production Chartitable layer. Slots are filled from fictional sample data."
    );
  }
  document.body.insertBefore(banner, document.body.firstChild);

  if (mode === "empty") return;

  fetch("donor-view.sample.json", { credentials: "same-origin" })
    .then(function (res) {
      if (!res.ok) throw new Error("sample missing");
      return res.json();
    })
    .then(function (view) {
      if (!view || view.recognized !== true) return;
      render(view);
    })
    .catch(function () {
      /* Slots stay empty. No console error. */
    });

  function unitFor(quantity, unit) {
    if (quantity !== 1) return unit;
    if (unit === "meals") return "meal";
    if (unit === "volunteer shifts") return "volunteer shift";
    if (unit === "pounds of produce") return "pound of produce";
    return unit;
  }

  function recordItem(record) {
    var li = make("li", "ct-record");
    addText(li, record.count + " " + unitFor(record.count, record.unit) + " · " + record.dateLabel);
    if (record.note) {
      li.appendChild(document.createTextNode(" "));
      var note = make("span", "ct-note");
      addText(note, record.note);
      li.appendChild(note);
    }
    return li;
  }

  function estimateItem(estimate) {
    var li = make("li", "ct-estimate");
    addText(li, "about " + estimate.approxQuantity + " " + unitFor(estimate.approxQuantity, estimate.unit));
    return li;
  }

  function fillList(parent, records, estimates) {
    var list = make("ul", "ct-facts");
    (records || []).forEach(function (record) {
      list.appendChild(recordItem(record));
    });
    (estimates || []).forEach(function (estimate) {
      list.appendChild(estimateItem(estimate));
    });
    if (list.childNodes.length) parent.appendChild(list);
  }

  function mark(slot, label) {
    slot.setAttribute("data-impact-state", "ready");
    slot.setAttribute("role", "region");
    slot.setAttribute("aria-label", label);
  }

  function render(view) {
    var hero = document.querySelector('[data-impact-slot="hero"]');
    var since = document.querySelector('[data-impact-slot="since-last-visit"]');
    var next = document.querySelector('[data-impact-slot="next-step"]');
    var heroData = view.hero || {};
    var photo = (view.photos || []).filter(function (item) {
      return item && item.url;
    })[0];

    if (hero && hero.getAttribute("data-impact-state") !== "ready") {
      var heading = make("p", "ct-greeting");
      addText(heading, "Welcome back, " + (heroData.firstName || "neighbor"));
      hero.appendChild(heading);
      if (heroData.story) {
        var story = make("p", "ct-story");
        addText(story, heroData.story);
        hero.appendChild(story);
      }
      fillList(hero, view.records, view.estimates);
      if (photo) {
        var matched = (view.records || []).filter(function (record) {
          return record.logId === photo.logId;
        })[0];
        var figure = make("figure", "ct-figure");
        var img = make("img", "ct-photo");
        img.alt = (matched && matched.note) || "Photo from a logged pantry update";
        img.src = photo.url;
        figure.appendChild(img);
        hero.appendChild(figure);
      }
      mark(hero, "Your impact");
    }

    if (since && view.sinceLastVisit && since.getAttribute("data-impact-state") !== "ready") {
      var sinceHeading = make("h2", "ct-since-heading");
      addText(sinceHeading, "Since " + view.sinceLastVisit.sinceDateLabel);
      since.appendChild(sinceHeading);
      fillList(since, view.sinceLastVisit.records, view.sinceLastVisit.estimates);
      mark(since, "Since your last visit");
    }

    if (next && view.nextStep && view.nextStep.text && next.getAttribute("data-impact-state") !== "ready") {
      var step = make("p", "ct-next");
      addText(step, view.nextStep.text);
      next.appendChild(step);
      if (view.nextStep.href) {
        var link = make("a", "ct-next-link");
        link.href = view.nextStep.href;
        addText(link, "See how to help");
        next.appendChild(link);
      }
      mark(next, "A next step");
    }

    document.documentElement.setAttribute("data-impact-active", "");
  }
})();
