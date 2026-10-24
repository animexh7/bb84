/* BB84 Rx: interface layer (presentation only; never touches BB84 maths or AES). */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var hoverOK = window.matchMedia("(hover: hover)");
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  /* 1. Split headings into words that rise in sequence */
  document.querySelectorAll("[data-split]").forEach(function (el) {
    var text = el.textContent.replace(/\s+/g, " ").trim();
    el.setAttribute("aria-label", text);
    el.textContent = "";
    text.split(" ").forEach(function (word, i, all) {
      var mask = document.createElement("span"), inner = document.createElement("span");
      mask.className = "w"; mask.setAttribute("aria-hidden", "true");
      inner.className = "wi"; inner.style.setProperty("--i", String(i)); inner.textContent = word;
      mask.appendChild(inner); el.appendChild(mask);
      if (i < all.length - 1) el.appendChild(document.createTextNode(" "));
    });
  });
  var reveals = document.querySelectorAll('[data-split="reveal"]');
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in-view"); io.unobserve(e.target); } });
    }, { threshold: 0.4 });
    reveals.forEach(function (el) { io.observe(el); });
  } else reveals.forEach(function (el) { el.classList.add("in-view"); });

  /* 2. Scroll progress + glow parallax */
  var bar = document.getElementById("progress");
  var items = Array.prototype.map.call(document.querySelectorAll("[data-parallax]"), function (el) {
    return { el: el, host: el.parentElement, speed: parseFloat(el.dataset.parallax) || 0 };
  });
  var queued = false;
  function update() {
    queued = false;
    var vh = window.innerHeight, max = document.documentElement.scrollHeight - vh, y = window.scrollY || 0;
    if (bar) bar.style.transform = "scaleX(" + (max > 0 ? clamp(y / max, 0, 1) : 0).toFixed(4) + ")";
    if (reduce.matches) return;
    items.forEach(function (it) {
      var r = it.host.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      it.el.style.transform = "translate3d(0," + ((r.top + r.height / 2 - vh / 2) * it.speed).toFixed(1) + "px,0)";
    });
  }
  function request() { if (!queued) { queued = true; requestAnimationFrame(update); } }
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);

  /* 3. Presence: soft light follows the pointer across each bay */
  document.querySelectorAll(".bay").forEach(function (bay) {
    var spot = document.createElement("span");
    spot.className = "spot"; spot.setAttribute("aria-hidden", "true");
    bay.insertBefore(spot, bay.firstChild);
    bay.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch" || reduce.matches || !hoverOK.matches) return;
      var r = bay.getBoundingClientRect();
      spot.style.transform = "translate3d(" + (e.clientX - r.left).toFixed(0) + "px," + (e.clientY - r.top).toFixed(0) + "px,0)";
      bay.classList.add("is-hot");
    });
    bay.addEventListener("pointerleave", function () { bay.classList.remove("is-hot"); });
  });
  document.querySelectorAll(".magnetic").forEach(function (b) {
    b.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch" || reduce.matches || b.disabled) return;
      var r = b.getBoundingClientRect();
      b.style.transform = "translate3d(" + clamp((e.clientX - r.left - r.width / 2) * 0.18, -8, 8).toFixed(1) + "px," +
        clamp((e.clientY - r.top - r.height / 2) * 0.28, -6, 6).toFixed(1) + "px,0)";
    });
    b.addEventListener("pointerleave", function () { b.style.transform = ""; });
  });

  /* 4. Simulation extras */
  var toggle = document.getElementById("interceptToggle"), channel = document.getElementById("channel");
  if (toggle && channel) toggle.addEventListener("change", function () { channel.dataset.tapped = toggle.checked ? "true" : "false"; });

  var vault = document.getElementById("vaultPanel"), vaultText = document.getElementById("vaultStateText");
  function updateVault() {
    if (!vault || !vaultText) return;
    var key = window.verifiedBB84Key;
    var verified = window.bb84KeyVerified === true && Array.isArray(key);
    var ready = verified && key.length >= 256;
    vault.dataset.locked = ready ? "false" : "true";
    vaultText.textContent = ready ? "Unlocked. A verified key is ready."
      : verified ? "Locked. The verified key is too short for AES-256." : "Locked. Waiting for a verified key.";
  }
  window.addEventListener("bb84-key-updated", updateVault);
  var gen = document.getElementById("generateKeyButton");
  if (gen) gen.addEventListener("click", function () { setTimeout(updateVault, 0); });
  updateVault();

  var sample = document.getElementById("sampleBtn"), input = document.getElementById("pharmaData");
  if (sample && input) sample.addEventListener("click", function () {
    input.value = "Compound X-204 (API), 50 mg per tablet. Excipients: microcrystalline cellulose 120 mg, croscarmellose sodium 8 mg, magnesium stearate 2 mg. Process: wet granulation, 45 min; compression force 12 kN; film coat 3% w/w.";
    input.focus();
  });
  request();
})();
