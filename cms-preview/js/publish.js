/* ============================================================================
   Logitech Pricelist CMS — Admin "Publish to GitHub" (Phase 5b)
   ----------------------------------------------------------------------------
   Additive module. Injects a "Publish to GitHub" button into the Admin top bar.
   On click it sends the current in-memory `products` list to the secure
   Cloudflare Worker (window.CMS_CONFIG.backendEndpoint), which commits
   products.json to GitHub. The publish passphrase (ADMIN_TOKEN) is entered by
   the operator and kept only in sessionStorage — it is never stored in code.
   ============================================================================ */
(function () {
  "use strict";

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

  function currentProducts() {
    try { if (typeof products !== "undefined" && Array.isArray(products)) return products; } catch (e) {}
    if (window.products && Array.isArray(window.products)) return window.products;
    return null;
  }

  async function publish(btn) {
    var cfg = window.CMS_CONFIG || {};
    var ep = cfg.backendEndpoint;
    if (!ep) { toast("Publish endpoint not set in config.js", false); return; }

    var list = currentProducts();
    if (!list || !list.length) { toast("No products loaded to publish.", false); return; }

    var tok = sessionStorage.getItem("cmsAdminToken");
    if (!tok) {
      tok = window.prompt("Enter your Publish passphrase (ADMIN_TOKEN):");
      if (!tok) return;
    }
    if (!window.confirm("Publish " + list.length + " products to GitHub?\nThis updates the live site for everyone.")) return;

    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Publishing…";
    try {
      var res = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tok,
          products: list,
          message: "Update products via Admin Panel",
        }),
      });
      var data = {};
      try { data = await res.json(); } catch (e) {}

      if (res.ok && data.ok) {
        sessionStorage.setItem("cmsAdminToken", tok); // remember for this session only
        toast("Published " + (data.committed || list.length) + " products. Live in ~1–2 min.", true);
      } else if (res.status === 401) {
        sessionStorage.removeItem("cmsAdminToken");
        toast("Wrong passphrase — nothing was published. Click Publish to retry.", false);
      } else {
        toast("Publish failed: " + (data.error || ("HTTP " + res.status)), false);
      }
    } catch (e) {
      toast("Network error: " + (e && e.message ? e.message : e), false);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  function makeBtn() {
    var b = document.createElement("button");
    b.id = "cmsPublishBtn";
    b.type = "button";
    b.textContent = "Publish to GitHub";
    b.title = "Commit the current product list to GitHub (updates the live site)";
    b.style.cssText =
      "margin-left:auto;flex:0 0 auto;border:0;cursor:pointer;color:#fff;" +
      "background:linear-gradient(135deg,#00B8FC,#0099D9);" +
      "font:700 13px/1 Poppins,system-ui,sans-serif;padding:10px 16px;border-radius:11px;" +
      "box-shadow:0 3px 8px rgba(0,184,252,.25)";
    b.addEventListener("click", function () { publish(b); });
    return b;
  }

  // The Admin top bar (.sx-top) is rendered on demand; inject once it exists.
  function tryInject() {
    var top = document.querySelector(".ad-saas .sx-top");
    if (top && !document.getElementById("cmsPublishBtn")) top.appendChild(makeBtn());
  }

  var mo = new MutationObserver(tryInject);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  tryInject();
})();
