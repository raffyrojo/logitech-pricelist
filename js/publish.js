/* ============================================================================
   Logitech Pricelist CMS - Admin "Publish to GitHub" (Phase 5b + 6, hardened v2)
   ----------------------------------------------------------------------------
   Injects a "Publish to GitHub" button into the Admin top bar. On click it
   sends the current in-memory `products` list AND any newly uploaded images
   (data-URL entries in `IMAGES`) to the secure Cloudflare Worker, which commits
   products.json and images/<code>.webp to GitHub. The passphrase (ADMIN_TOKEN)
   is entered by the operator and kept only in sessionStorage - never in code.

   v2 hardening (2026-07-04):
   - Pre-publish validation: required fields, types, duplicate item codes.
   - Live-data safety check: compares what you are about to publish against
     the current live products.json and shows +added / -removed / ~edited in
     the confirm dialog. Large deletions need an extra confirmation.
   - Automatic pre-publish backup of the live data (localStorage). Recover it
     any time by running  cmsDownloadBackup()  in the browser console - the
     downloaded file can be re-imported via Admin > Settings > Import.
   - 90s network timeout + specific, human-readable error messages.
   ============================================================================ */
(function () {
  "use strict";

  var FALLBACK_ENDPOINT = "https://logitech-cms.raffyortega-rojo.workers.dev";
  var PUBLISH_TIMEOUT_MS = 90000;
  var BACKUP_KEY = "cmsPrePublishBackup";
  var MAX_PAYLOAD_BYTES = 15 * 1024 * 1024; /* 15 MB - stay under Worker/GitHub limits */

  function toast(msg, ok) {
    var t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText =
      "position:fixed;z-index:99999;left:50%;top:22px;transform:translateX(-50%);" +
      "background:" + (ok === false ? "#c0392b" : ok ? "#0a7f3f" : "#0b1320") +
      ";color:#fff;padding:12px 18px;border-radius:10px;font:600 14px/1.35 Poppins,system-ui,sans-serif;" +
      "box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:82vw;text-align:center";
    document.body.appendChild(t);
    setTimeout(function () {
      t.style.transition = "opacity .4s";
      t.style.opacity = "0";
      setTimeout(function () { t.remove(); }, 400);
    }, ok === false ? 7000 : 4200);
  }

  function safeCode(c) { return String(c).replace(/[^A-Za-z0-9._-]/g, "_"); }
  function imageBase() { return ((window.CMS_CONFIG || {}).paths || {}).images || "images/"; }
  function productsPath() { return ((window.CMS_CONFIG || {}).paths || {}).products || "data/products.json"; }

  function currentProducts() {
    try { if (typeof products !== "undefined" && Array.isArray(products)) return products; } catch (e) {}
    if (window.products && Array.isArray(window.products)) return window.products;
    return null;
  }
  function currentImages() {
    try { if (typeof IMAGES !== "undefined" && IMAGES) return IMAGES; } catch (e) {}
    return window.IMAGES || null;
  }

  /* ------------------------------------------------------------------ */
  /* Validation: block corrupt or malformed data before it reaches Git.  */
  /* Returns { errors: [...], warnings: [...] }.                         */
  /* ------------------------------------------------------------------ */
  function validatePayload(list) {
    var errors = [], warnings = [], seen = {}, i, p, code;
    if (!Array.isArray(list) || !list.length) {
      return { errors: ["No products loaded - nothing to publish."], warnings: [] };
    }
    for (i = 0; i < list.length; i++) {
      p = list[i];
      var label = "#" + (i + 1);
      if (!p || typeof p !== "object" || Array.isArray(p)) {
        errors.push(label + ": not a valid product record."); continue;
      }
      code = (p.code == null ? "" : String(p.code)).trim();
      if (code) label = code;
      if (!code) errors.push(label + ": Item Code is missing.");
      else if (seen[code]) errors.push('Duplicate Item Code "' + code + '" (rows ' + seen[code] + " and " + (i + 1) + ").");
      else seen[code] = i + 1;
      if (!(typeof p.name === "string" && p.name.trim())) errors.push(label + ": Product Name is missing.");
      if (!(typeof p.category === "string" && p.category.trim())) errors.push(label + ": Category is missing.");
      if (!(typeof p.srp === "number" && isFinite(p.srp) && p.srp > 0)) errors.push(label + ": SRP must be a number above 0.");
      if (!(typeof p.dp === "number" && isFinite(p.dp) && p.dp > 0)) errors.push(label + ": DP must be a number above 0.");
      if (typeof p.srp === "number" && typeof p.dp === "number" && isFinite(p.srp) && isFinite(p.dp) && p.dp > p.srp)
        warnings.push(label + ": DP (" + p.dp + ") is higher than SRP (" + p.srp + ") - check pricing.");
      if (typeof p.srp === "number" && p.srp > 500000) warnings.push(label + ": SRP " + p.srp + " looks unusually high.");
    }
    return { errors: errors, warnings: warnings };
  }

  /* Compare live vs outgoing data so the operator sees exactly what changes. */
  function diffSummary(live, next) {
    var byCode = {}, added = 0, removed = 0, changed = 0, i, c;
    for (i = 0; i < live.length; i++) byCode[live[i].code] = live[i];
    var nextCodes = {};
    for (i = 0; i < next.length; i++) {
      c = next[i].code; nextCodes[c] = 1;
      if (!byCode[c]) added++;
      else if (JSON.stringify(byCode[c]) !== JSON.stringify(next[i])) changed++;
    }
    for (i = 0; i < live.length; i++) if (!nextCodes[live[i].code]) removed++;
    return { added: added, removed: removed, changed: changed };
  }

  function fetchLiveProducts() {
    return fetch(productsPath() + "?v=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return Array.isArray(d) && d.length ? d : null; })
      .catch(function () { return null; });
  }

  /* Pre-publish backup of the LIVE data (the version about to be replaced). */
  function saveBackup(liveList) {
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify({ savedAt: new Date().toISOString(), products: liveList }));
      return true;
    } catch (e) { return false; } /* quota exceeded etc. - non-fatal */
  }
  window.cmsDownloadBackup = function () {
    var raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) { toast("No pre-publish backup stored on this device yet.", false); return; }
    var meta = {};
    try { meta = JSON.parse(raw); } catch (e) { toast("Stored backup is unreadable.", false); return; }
    var blob = new Blob([JSON.stringify({ products: meta.products }, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "products-backup-" + String(meta.savedAt || "unknown").replace(/[:]/g, "-") + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    toast("Backup downloaded - restore via Admin > Settings > Import.", true);
  };

  function dataUrlToWebpBase64(dataUrl) {
    return new Promise(function (resolve) {
      var strip = function (u) { var i = u.indexOf(","); return i >= 0 ? u.slice(i + 1) : u; };
      var img = new Image();
      img.onload = function () {
        try {
          var max = 640, w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          var s = Math.min(1, max / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * s)), ch = Math.max(1, Math.round(h * s));
          var c = document.createElement("canvas"); c.width = cw; c.height = ch;
          var ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0, cw, ch);
          var webp = c.toDataURL("image/webp", 0.9);
          if (webp && webp.indexOf("data:image/webp") === 0) return resolve(strip(webp));
          resolve(strip(dataUrl));
        } catch (e) { resolve(strip(dataUrl)); }
      };
      img.onerror = function () { resolve(strip(dataUrl)); };
      img.src = dataUrl;
    });
  }

  async function collectChangedImages() {
    var IMG = currentImages(), out = [];
    if (!IMG) return out;
    for (var code in IMG) {
      if (!Object.prototype.hasOwnProperty.call(IMG, code)) continue;
      if (String(IMG[code]).indexOf("data:") === 0) out.push(code);
    }
    var payload = [];
    for (var i = 0; i < out.length; i++) {
      var b64 = await dataUrlToWebpBase64(IMG[out[i]]);
      payload.push({ code: out[i], contentBase64: b64 });
    }
    return payload;
  }

  function friendlyHttpError(status, data) {
    if (data && data.error) return "Publish failed: " + data.error;
    if (status === 403) return "Publish blocked (403) - the site origin is not allowed by the Worker.";
    if (status === 413) return "Publish rejected: payload too large. Publish fewer new images at once.";
    if (status === 429) return "Too many publish attempts - wait a minute and try again.";
    if (status >= 500) return "The publish server is having trouble (HTTP " + status + "). Your data was NOT lost - try again in a few minutes.";
    return "Publish failed: HTTP " + status;
  }

  async function publish(btn) {
    var cfg = window.CMS_CONFIG || {};
    var ep = cfg.backendEndpoint || FALLBACK_ENDPOINT;
    if (!ep) { toast("Publish endpoint not set in config.js", false); return; }

    var list = currentProducts();
    if (!list || !list.length) { toast("No products loaded to publish.", false); return; }

    if (navigator.onLine === false) { toast("You appear to be offline - reconnect and try again.", false); return; }

    var label = btn.textContent;
    btn.disabled = true; btn.textContent = "Checking...";

    try {
      /* 1) Validate before anything leaves the browser. */
      var v = validatePayload(list);
      if (v.errors.length) {
        var shown = v.errors.slice(0, 8).join("\n");
        if (v.errors.length > 8) shown += "\n...and " + (v.errors.length - 8) + " more.";
        window.alert("Publish cancelled - fix these first:\n\n" + shown);
        return;
      }
      if (v.warnings.length) {
        if (!window.confirm("Warnings (publish anyway?):\n\n" + v.warnings.slice(0, 8).join("\n"))) return;
      }

      /* 2) Compare with live data + keep a backup of what we are replacing. */
      var live = await fetchLiveProducts();
      var diffLine = "", bigRemoval = false, backedUp = false;
      if (live) {
        backedUp = saveBackup(live);
        var d = diffSummary(live, list);
        diffLine = "\nLive now: " + live.length + " products. Changes: +" + d.added + " added, -" + d.removed + " removed, ~" + d.changed + " edited.";
        bigRemoval = d.removed >= Math.max(5, Math.round(live.length * 0.2));
      } else {
        diffLine = "\nWARNING: could not load the current live data to compare - publishing will overwrite whatever is live.";
      }

      /* 3) Images + payload size guard. */
      btn.textContent = "Preparing...";
      var imagePayload;
      try { imagePayload = await collectChangedImages(); }
      catch (e) { imagePayload = []; }

      var tok = sessionStorage.getItem("cmsAdminToken");
      if (!tok) {
        tok = window.prompt("Enter your Publish passphrase (ADMIN_TOKEN):");
        if (!tok) return;
      }

      var body;
      try {
        body = JSON.stringify({ token: tok, products: list, images: imagePayload, message: "Update products via Admin Panel" });
      } catch (e) {
        window.alert("Publish cancelled: the product data could not be serialized (" + (e && e.message ? e.message : e) + ").");
        return;
      }
      if (body.length > MAX_PAYLOAD_BYTES) {
        window.alert("Publish cancelled: payload is " + Math.round(body.length / 1048576) + " MB (limit ~15 MB).\nPublish fewer new images at once.");
        return;
      }

      /* 4) Confirm with a clear summary of what will happen. */
      var summary = list.length + " products" + (imagePayload.length ? " + " + imagePayload.length + " image(s)" : "");
      var confirmMsg = "Publish " + summary + " to GitHub?" + diffLine +
        (backedUp ? "\n\nA backup of the current live data was saved on this device (console: cmsDownloadBackup())." : "") +
        "\nThis updates the live site for everyone.";
      if (!window.confirm(confirmMsg)) return;
      if (bigRemoval && !window.confirm("You are about to REMOVE a large number of live products.\nAre you absolutely sure?")) return;

      /* 5) Send, with a timeout so the button can never hang forever. */
      btn.textContent = "Saving...";
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, PUBLISH_TIMEOUT_MS) : null;
      var res;
      try {
        res = await fetch(ep, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
          signal: ctrl ? ctrl.signal : undefined,
        });
      } finally { if (timer) clearTimeout(timer); }

      var data = {};
      try { data = await res.json(); } catch (e) {}

      if (res.ok && data.ok) {
        sessionStorage.setItem("cmsAdminToken", tok);
        var IMG = currentImages();
        if (IMG) imagePayload.forEach(function (im) { IMG[im.code] = imageBase() + safeCode(im.code) + ".webp"; });
        if (typeof window.rebuildAll === "function") { try { window.rebuildAll(); } catch (e) {} }
        toast("Published " + (data.committed || list.length) + " products"
          + (data.images ? " + " + data.images + " image(s)" : "") + ". Live in ~1-2 min.", true);
      } else if (res.status === 401) {
        sessionStorage.removeItem("cmsAdminToken");
        toast("Wrong passphrase - nothing was published. Click Publish to retry.", false);
      } else {
        toast(friendlyHttpError(res.status, data), false);
      }
    } catch (e) {
      if (e && e.name === "AbortError") {
        toast("Publish timed out after 90s. Check the latest commit on GitHub before retrying - it may or may not have gone through.", false);
      } else {
        toast("Network error: " + (e && e.message ? e.message : e) + " - nothing was saved. Try again.", false);
      }
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  }

  function makeBtn() {
    var b = document.createElement("button");
    b.id = "cmsPublishBtn";
    b.type = "button";
    b.textContent = "Save";
    b.title = "Save changes to the live site (commit to GitHub)";
    b.style.cssText =
      "margin-left:auto;flex:0 0 auto;border:0;cursor:pointer;color:#fff;" +
      "background:linear-gradient(135deg,#00B8FC,#0099D9);" +
      "font:700 13px/1 Poppins,system-ui,sans-serif;padding:10px 16px;border-radius:11px;" +
      "box-shadow:0 3px 8px rgba(0,184,252,.25)";
    b.addEventListener("click", function () { publish(b); });
    return b;
  }

  function tryInject() {
    var top = document.querySelector(".ad-saas .sx-top");
    if (top && !document.getElementById("cmsPublishBtn")) top.appendChild(makeBtn());
  }

  var mo = new MutationObserver(tryInject);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  tryInject();

  /* test hook (no effect in the browser) */
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { validatePayload: validatePayload, diffSummary: diffSummary };
  }
})();
