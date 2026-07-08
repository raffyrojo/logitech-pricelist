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
};

/* ============================================================
   Startup update check (production; no polling, no reload)
   - Checks ONCE at startup. Never polls, never force-reloads.
   - Shows a brief toast only when the published data changed
     since the user last saw it; shows nothing when unchanged.
   ============================================================ */
(function(){
  "use strict";
  var cfg = window.CMS_CONFIG || {};
  var PRODUCTS = ((cfg.paths||{}).products) || "data/products.json";

  function adminOpen(){ return !!document.getElementById("cmsPublishBtn"); }
  function lget(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lset(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  function stampOf(){
    return fetch(PRODUCTS,{method:"HEAD",cache:"no-store"})
      .then(function(r){ return r.ok?(r.headers.get("last-modified")||r.headers.get("etag")||""):""; })
      .catch(function(){ return ""; });
  }

  function injectCss(){
    if(document.getElementById("lplNotifCss")) return;
    var s=document.createElement("style"); s.id="lplNotifCss";
    s.textContent=
      ".lpl-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(8px);z-index:100000;display:flex;align-items:center;gap:10px;background:#0B2A45;color:#fff;padding:12px 16px;border-radius:12px;font:600 13px/1.3 'Roboto',system-ui,sans-serif;box-shadow:0 16px 40px -12px rgba(2,17,30,.5);opacity:0;transition:opacity .25s,transform .25s;max-width:88vw}"+
      ".lpl-toast .lpl-tk{display:inline-flex;width:18px;height:18px;align-items:center;justify-content:center;border-radius:50%;background:#22C55E;color:#fff;font-size:12px}"+
      ".lpl-toast .lpl-spin{width:15px;height:15px;border:2px solid rgba(255,255,255,.35);border-top-color:#00B8FC;border-radius:50%;animation:lplspin .6s linear infinite}"+
      "@keyframes lplspin{to{transform:rotate(360deg)}}";
    document.head.appendChild(s);
  }

  function toast(msg,ok,ms){
    injectCss();
    var t=document.getElementById("lplToast");
    if(!t){ t=document.createElement("div"); t.id="lplToast"; t.className="lpl-toast"; document.body.appendChild(t); }
    t.innerHTML=(ok?"<span class='lpl-tk'>✓</span>":"<span class='lpl-spin'></span>")+"<span>"+msg+"</span>";
    requestAnimationFrame(function(){ t.style.opacity="1"; t.style.transform="translateX(-50%) translateY(0)"; });
    clearTimeout(t._h);
    if(ms){ t._h=setTimeout(function(){ t.style.opacity="0"; t.style.transform="translateX(-50%) translateY(8px)"; setTimeout(function(){ if(t.parentNode)t.parentNode.removeChild(t); },300); }, ms); }
  }
  function updateSequence(){
    toast("Checking for updates…",false,0);
    setTimeout(function(){ toast("Updating dealer prices…",false,0); },1000);
    setTimeout(function(){ toast("Pricelist updated successfully.",true,3000); },2000);
  }

  function boot(){
    if(adminOpen()) return;
    stampOf().then(function(s){
      var seenStamp=lget("lpl_stamp");
      if(seenStamp && s && s!==seenStamp){ updateSequence(); }
      lset("lpl_stamp",s);
    });
  }
  if(document.readyState==="complete"){ setTimeout(boot,1400); }
  else { window.addEventListener("load",function(){ setTimeout(boot,1400); }); }
})();
