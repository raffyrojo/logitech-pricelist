/* ============================================================================
   Logitech Pricelist CMS - Admin "Publish to GitHub" (Phase 5b + 6)
   ----------------------------------------------------------------------------
   Injects a "Publish to GitHub" button into the Admin top bar. On click it
   sends the current in-memory `products` list AND any newly uploaded images
   (data-URL entries in `IMAGES`) to the secure Cloudflare Worker, which commits
   products.json and images/<code>.webp to GitHub. The passphrase (ADMIN_TOKEN)
   is entered by the operator and kept only in sessionStorage - never in code.
   ============================================================================ */
(function () {
  "use strict";

  var FALLBACK_ENDPOINT = "https://logitech-cms.raffyortega-rojo.workers.dev";

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
    }, ok === false ? 6000 : 4200);
  }

  function safeCode(c) { return String(c).replace(/[^A-Za-z0-9._-]/g, "_"); }
  function imageBase() { return ((window.CMS_CONFIG || {}).paths || {}).images || "images/"; }

  function currentProducts() {
    try { if (typeof products !== "undefined" && Array.isArray(products)) return products; } catch (e) {}
    if (window.products && Array.isArray(window.products)) return window.products;
    return null;
  }
  function currentImages() {
    try { if (typeof IMAGES !== "undefined" && IMAGES) return IMAGES; } catch (e) {}
    return window.IMAGES || null;
  }

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

  async function publish(btn) {
    var cfg = window.CMS_CONFIG || {};
    var ep = cfg.backendEndpoint || FALLBACK_ENDPOINT;
    if (!ep) { toast("Publish endpoint not set in config.js", false); return; }

    var list = currentProducts();
    if (!list || !list.length) { toast("No products loaded to publish.", false); return; }

    var label = btn.textContent;
    btn.disabled = true; btn.textContent = "Preparing...";

    var imagePayload;
    try { imagePayload = await collectChangedImages(); }
    catch (e) { imagePayload = []; }

    var tok = sessionStorage.getItem("cmsAdminToken");
    if (!tok) {
      tok = window.prompt("Enter your Publish passphrase (ADMIN_TOKEN):");
      if (!tok) { btn.disabled = false; btn.textContent = label; return; }
    }

    var summary = list.length + " products" + (imagePayload.length ? " + " + imagePayload.length + " image(s)" : "");
    if (!window.confirm("Publish " + summary + " to GitHub?\nThis updates the live site for everyone.")) {
      btn.disabled = false; btn.textContent = label; return;
    }

    btn.textContent = "Publishing...";
    try {
      var res = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tok,
          products: list,
          images: imagePayload,
          message: "Update products via Admin Panel",
        }),
      });
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
        toast("Publish failed: " + (data.error || ("HTTP " + res.status)), false);
      }
    } catch (e) {
      toast("Network error: " + (e && e.message ? e.message : e), false);
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  }

  function makeBtn() {
    var b = document.createElement("button");
    b.id = "cmsPublishBtn";
    b.type = "button";
    b.textContent = "Publish to GitHub";
    b.title = "Commit the current products and any new images to GitHub (updates the live site)";
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
})();
