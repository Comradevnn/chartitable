(function () {
  "use strict";
  var CHARITIES = ["demo-pantry-a", "demo-pantry-b"];
  var UNITS = { meals: "meals", produce: "pounds of produce", volunteer_shifts: "volunteer shifts" };
  var MAX_COUNT = 10000;
  var MAX_NOTE = 200;
  var MAX_PHOTO = 5 * 1024 * 1024;
  var LONG_EDGE = 1600;
  var cfg = window.CHARTITABLE_CONFIG || {};
  var convexUrl = String(cfg.convexUrl || "").replace(/\/+$/, "");

  var $ = function (id) { return document.getElementById(id); };
  var form = $("form");
  var notice = $("notice");
  var errEl = $("error");
  var okEl = $("success");
  var btn = $("submit");
  var pinEl = $("pin");
  var countEl = $("count");
  var noteEl = $("note");
  var photoEl = $("photo");
  var photoStatus = $("photo-status");
  var unitEl = $("unit");
  var counter = $("note-count");
  var recentSection = $("recent-section");
  var recentList = $("recent");

  var charityId = new URLSearchParams(location.search).get("charity");
  var MESSAGES = {
    kind: "Choose meals, produce, or volunteer shifts.",
    count: "Enter a whole number from 1 to 10,000.",
    note: "Notes can be 200 characters, with no links or contact details.",
    photo: "Use an image under 5 MB.",
    pin: "Enter the staff PIN.",
    unauthorized: "That PIN isn't right.",
    generic: "Something went wrong. Please try again.",
    upload: "The photo didn't upload. The rest of the form is still here."
  };

  function showNotice(msg) { notice.textContent = msg; notice.hidden = false; }
  function showError(msg) {
    okEl.hidden = true;
    errEl.textContent = msg;
    errEl.hidden = false;
  }
  function clearError() { errEl.hidden = true; errEl.textContent = ""; }
  function showSuccess(msg) {
    clearError();
    okEl.textContent = msg;
    okEl.hidden = false;
    okEl.focus();
  }

  function call(kind, path, args) {
    return fetch(convexUrl + "/api/" + kind, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path, args: args, format: "json" })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.status === "success") return j.value;
      var data = j && j.errorData;
      var message = j && typeof j.errorMessage === "string" ? j.errorMessage : "";
      if (data === "unauthorized" || message.indexOf("unauthorized") !== -1) {
        throw new Error("unauthorized");
      }
      throw new Error("call failed");
    });
  }

  function selectedKind() {
    var picked = form.querySelector('input[name="kind"]:checked');
    return picked ? picked.value : "";
  }

  function updateUnit() {
    unitEl.textContent = UNITS[selectedKind()] || "";
  }

  function updateCounter() {
    var n = noteEl.value.length;
    counter.textContent = n + " / " + MAX_NOTE;
    counter.classList.toggle("over", n > MAX_NOTE);
  }

  function parseCount(raw) {
    var trimmed = String(raw || "").trim();
    if (!/^\d{1,5}$/.test(trimmed)) return null;
    var n = parseInt(trimmed, 10);
    if (n < 1 || n > MAX_COUNT) return null;
    return n;
  }

  function isImage(file) {
    if (file.type && file.type.indexOf("image/") === 0) return true;
    return /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(file.name || "");
  }

  function validate() {
    if (!pinEl.value) return { error: "pin" };
    var kind = selectedKind();
    if (!UNITS[kind]) return { error: "kind" };
    var count = parseCount(countEl.value);
    if (count === null) return { error: "count" };
    var note = noteEl.value.trim();
    if (note.length > MAX_NOTE) return { error: "note" };
    if (/[<>@]/.test(note) || /http/i.test(note)) return { error: "note" };
    var file = photoEl.files && photoEl.files[0];
    if (file && (!isImage(file) || file.size > MAX_PHOTO)) return { error: "photo" };
    return { kind: kind, count: count, note: note, file: file || null };
  }

  function blobFromCanvas(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) reject(new Error("photo"));
        else resolve(blob);
      }, "image/jpeg", 0.85);
    });
  }

  function drawScaled(source, width, height) {
    var w = width;
    var h = height;
    var long = Math.max(w, h);
    if (long > LONG_EDGE) {
      var scale = LONG_EDGE / long;
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
    }
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("photo");
    ctx.drawImage(source, 0, 0, w, h);
    return blobFromCanvas(canvas);
  }

  function resizeWithImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        try {
          drawScaled(img, img.naturalWidth, img.naturalHeight).then(resolve, reject);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("photo"));
      };
      img.src = url;
    });
  }

  function resizeImage(file) {
    if (typeof createImageBitmap !== "function") return resizeWithImage(file);
    return createImageBitmap(file).then(function (bitmap) {
      return drawScaled(bitmap, bitmap.width, bitmap.height).then(function (blob) {
        if (bitmap.close) bitmap.close();
        return blob;
      });
    }).catch(function () { return resizeWithImage(file); });
  }

  function uploadPhoto(pin, file) {
    return resizeImage(file).then(function (blob) {
      return call("mutation", "impact:generateUploadUrl", { pin: pin }).then(function (uploadUrl) {
        if (typeof uploadUrl !== "string" || !uploadUrl) throw new Error("upload");
        return fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: blob
        });
      });
    }).then(function (res) {
      if (!res.ok) throw new Error("upload");
      return res.json();
    }).then(function (body) {
      if (!body || typeof body.storageId !== "string") throw new Error("upload");
      return body.storageId;
    });
  }

  function dateLabel(ms) {
    try {
      return new Date(ms).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    } catch (e) {
      return "";
    }
  }

  function renderRecent(rows) {
    while (recentList.firstChild) recentList.removeChild(recentList.firstChild);
    recentSection.hidden = false;
    if (!rows || !rows.length) {
      var empty = document.createElement("li");
      empty.textContent = "No updates yet.";
      recentList.appendChild(empty);
      return;
    }
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var li = document.createElement("li");
      var when = dateLabel(row.loggedAt);
      var line = (when ? when + " · " : "") + row.count + " " + row.unit;
      if (row.note) line += " · " + row.note;
      if (row.hasPhoto) line += " · Photo";
      li.textContent = line;
      recentList.appendChild(li);
    }
  }

  function loadRecent(pin) {
    return call("query", "impact:recent", { pin: pin, charityId: charityId }).then(function (rows) {
      renderRecent(rows || []);
    });
  }

  function onSubmit(e) {
    e.preventDefault();
    clearError();
    okEl.hidden = true;
    var v = validate();
    if (v.error) { showError(MESSAGES[v.error] || MESSAGES.generic); return; }
    var pin = pinEl.value;
    btn.disabled = true;
    var chain = v.file ? uploadPhoto(pin, v.file) : Promise.resolve(null);
    chain.then(function (storageId) {
      var args = { pin: pin, charityId: charityId, kind: v.kind, count: v.count };
      if (v.note) args.note = v.note;
      if (storageId) args.photoStorageId = storageId;
      return call("mutation", "impact:log", args);
    }).then(function (res) {
      btn.disabled = false;
      if (res && res.ok === true && typeof res.donorsCredited === "number") {
        showSuccess("Recorded. Shared across " + res.donorsCredited + " donors' estimates.");
        countEl.value = "";
        noteEl.value = "";
        photoEl.value = "";
        photoStatus.textContent = "";
        updateCounter();
        return loadRecent(pin).catch(function () {});
      }
      showError(MESSAGES[res && res.error] || MESSAGES.generic);
    }).catch(function (err) {
      btn.disabled = false;
      if (err && err.message === "unauthorized") showError(MESSAGES.unauthorized);
      else if (err && (err.message === "photo" || err.message === "upload")) showError(MESSAGES[err.message]);
      else showError(MESSAGES.generic);
    });
  }

  function onPhotoChange() {
    var file = photoEl.files && photoEl.files[0];
    if (!file) { photoStatus.textContent = ""; return; }
    if (!isImage(file) || file.size > MAX_PHOTO) {
      photoStatus.textContent = MESSAGES.photo;
      return;
    }
    photoStatus.textContent = "Photo ready.";
  }

  function init() {
    if (CHARITIES.indexOf(charityId) === -1) {
      showNotice("This link isn't valid.");
      return;
    }
    form.hidden = false;
    updateUnit();
    updateCounter();
    form.addEventListener("change", function (e) {
      if (e.target && e.target.name === "kind") updateUnit();
    });
    noteEl.addEventListener("input", updateCounter);
    photoEl.addEventListener("change", onPhotoChange);
    if (!convexUrl) {
      showNotice("Not configured");
      btn.disabled = true;
      return;
    }
    form.addEventListener("submit", onSubmit);
    pinEl.addEventListener("change", function () {
      if (!pinEl.value) return;
      loadRecent(pinEl.value).catch(function (err) {
        if (err && err.message === "unauthorized") showError(MESSAGES.unauthorized);
      });
    });
  }

  init();
})();
