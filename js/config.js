/* ============================================================
   Logitech Pricelist CMS - configuration
   The ONLY file you normally need to edit.
   ============================================================ */
window.CMS_CONFIG = {
  // GitHub repository that hosts the site + data (owner/name)
  githubRepo: "raffyrojo/logitech-pricelist",

  // Branch GitHub Pages serves from
  branch: "main",

  // Secure backend (Cloudflare Worker) that commits products.json.
  backendEndpoint: "https://logitech-cms.raffyortega-rojo.workers.dev",

  // Relative paths to data files (usually leave as-is)
  paths: {
    products:   "data/products.json",
    categories: "data/categories.json",
    settings:   "data/settings.json",
    images:     "images/"
  }
};  /* Live refresh: open tabs auto-update on a new publish */  (function(){"use strict";var cfg=window.CMS_CONFIG||{};var PRODUCTS=((cfg.paths||{}).products)||"data/products.json";var POLL_MS=180000;var known=null;function adminOpen(){return !!document.getElementById("cmsPublishBtn");}function getStamp(){return fetch(PRODUCTS,{method:"HEAD",cache:"no-store"}).then(function(r){return r.ok?(r.headers.get("last-modified")||r.headers.get("etag")):null;}).catch(function(){return null;});}function toast(m){var t=document.createElement("div");t.textContent=m;t.style.cssText="position:fixed;z-index:99999;left:50%;bottom:20px;transform:translateX(-50%);background:#0a7f3f;color:#fff;padding:11px 17px;border-radius:11px;font:600 13px/1.3 Poppins,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.28);max-width:88vw;text-align:center";document.body.appendChild(t);}function check(){if(adminOpen())return;getStamp().then(function(s){if(!s)return;if(known===null){known=s;return;}if(s!==known){known=s;toast("Prices updated - refreshing");setTimeout(function(){location.reload();},1200);}});}function start(){getStamp().then(function(s){known=s;});setInterval(function(){if(!document.hidden)check();},POLL_MS);document.addEventListener("visibilitychange",function(){if(!document.hidden)check();});}if(document.readyState==="complete"){setTimeout(start,3000);}else{window.addEventListener("load",function(){setTimeout(start,3000);});}})();
