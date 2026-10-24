(function () {
  'use strict';
  var d = document;
  d.documentElement.classList.add('js');

  /* A screenshot that has not been added yet: keep the frame, show the description as a caption. */
  function markMissing(img) {
    var frame = img.closest('.frame');
    if (!frame || frame.querySelector('.missing')) return;
    img.hidden = true;
    var p = d.createElement('p');
    p.className = 'missing';
    p.textContent = img.alt;
    frame.appendChild(p);
  }
  d.querySelectorAll('.frame img').forEach(function (img) {
    if (img.complete && img.naturalWidth === 0) markMissing(img);
    img.addEventListener('error', function () { markMissing(img); });
  });

  /* Copy the embed snippet. */
  var btn = d.getElementById('copy');
  var code = d.getElementById('embed');
  var stub = d.getElementById('stub');
  var timer;
  function selectCode() {
    var r = d.createRange();
    r.selectNodeContents(code);
    var s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }
  function legacyCopy() {
    selectCode();
    try { return d.execCommand('copy'); } catch (e) { return false; }
  }
  function say(msg) {
    clearTimeout(timer);
    stub.classList.remove('print');
    stub.textContent = '';
    timer = setTimeout(function () {
      stub.textContent = msg;
      stub.classList.add('print');
      timer = setTimeout(function () {
        stub.textContent = '';
        stub.classList.remove('print');
      }, 3400);
    }, 30);
  }
  function result(ok) {
    if (ok) { say('Copied'); }
    else { selectCode(); say('Selected. Press Ctrl+C or Cmd+C to copy.'); }
  }
  if (btn && code && stub) {
    btn.addEventListener('click', function () {
      var text = code.textContent.trim();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { result(true); }, function () { result(legacyCopy()); });
      } else {
        result(legacyCopy());
      }
    });
  }

  /* Guard switch: shows what the page would do with no fact check. */
  var guard = d.getElementById('guard');
  var toggle = d.getElementById('guard-toggle');
  if (guard && toggle) {
    toggle.hidden = false;
    toggle.addEventListener('click', function () {
      var wasOn = toggle.getAttribute('aria-pressed') === 'true';
      toggle.setAttribute('aria-pressed', wasOn ? 'false' : 'true');
      guard.setAttribute('data-guard', wasOn ? 'off' : 'on');
      var st = toggle.querySelector('.st');
      if (st) st.textContent = wasOn ? 'Off' : 'On';
      var price = d.getElementById('honesty-price');
      if (price) price.textContent = wasOn ? '1 invented number shown' : '0 invented numbers shown';
    });
  }

  /* Mark the nav tag for the section in view. */
  if ('IntersectionObserver' in window) {
    var links = {};
    d.querySelectorAll('.nav a').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var order = ['how', 'install', 'honesty', 'dashboard'];
    var seen = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { seen[e.target.id] = e.isIntersecting; });
      var current = null;
      order.forEach(function (id) { if (seen[id]) current = id; });
      Object.keys(links).forEach(function (id) {
        if (id === current) links[id].setAttribute('aria-current', 'location');
        else links[id].removeAttribute('aria-current');
      });
    }, { rootMargin: '-35% 0px -55% 0px' });
    order.forEach(function (id) { var el = d.getElementById(id); if (el) io.observe(el); });
  }
})();
