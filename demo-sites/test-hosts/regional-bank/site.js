(function () {
  "use strict";
  var form = document.querySelector("[data-desk-form]");
  if (!form) return;
  var input = form.querySelector("input[type=email]");
  var status = form.querySelector("[data-form-status]");
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var value = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      status.textContent = "That doesn't look like an email. Try name@example.com, or call (555) 010-2202.";
      input.focus();
      return;
    }
    status.textContent = "This test site does not send mail. Call (555) 010-2202 and the desk will add you.";
  });
})();
