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
   Startup update check + "What's New" (production; no polling)
   - Checks ONCE at startup. Never polls, never force-reloads.
   - Shows a toast only when the published data changed since the
     user last saw it; shows nothing when nothing changed.
   - Shows the "What's New" dialog once per RELEASE.version.
   ============================================================ */
(function(){
  "use strict";
  var cfg = window.CMS_CONFIG || {};
  var PRODUCTS = ((cfg.paths||{}).products) || "data/products.json";

  /* Bump `version` to announce a new release (shown once per user). */
  var RELEASE = {
    version: "1.77.0",
    date: "Jul 8, 2026",
    notes: [
      "Refreshed enterprise login experience",
      "Updated dealer pricing across 50 SKUs",
      "Always-fresh price loading — no manual refresh",
      "Streamlined admin workflow: a single Save publishes",
      "Search and category filter fixes"
    ]
  };

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
      "@keyframes lplspin{to{transform:rotate(360deg)}}"+
      ".lpl-wn-bg{position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(2,17,30,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);opacity:0;transition:opacity .25s}"+
      ".lpl-wn-bg.on{opacity:1}"+
      ".lpl-wn{width:100%;max-width:440px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 40px 100px -30px rgba(2,17,30,.5);font-family:'Roboto',system-ui,sans-serif;transform:translateY(14px) scale(.985);transition:transform .3s cubic-bezier(.16,1,.3,1)}"+
      ".lpl-wn-bg.on .lpl-wn{transform:none}"+
      ".lpl-wn-hd{background:linear-gradient(150deg,#00456f,#003B64);color:#fff;padding:22px 24px}"+
      ".lpl-wn-ey{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#7FD8FF}"+
      ".lpl-wn-t{font-size:20px;font-weight:700;letter-spacing:-.3px;margin:6px 0 2px}"+
      ".lpl-wn-v{font-size:12.5px;color:rgba(255,255,255,.7)}"+
      ".lpl-wn-bd{padding:20px 24px}"+
      ".lpl-wn-bd ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:11px}"+
      ".lpl-wn-bd li{display:flex;align-items:flex-start;gap:10px;font-size:14px;color:#334155;line-height:1.4}"+
      ".lpl-wn-bd li svg{width:16px;height:16px;color:#00B8FC;flex:0 0 auto;margin-top:1px}"+
      ".lpl-wn-ft{padding:4px 24px 22px}"+
      ".lpl-wn-btn{width:100%;height:46px;border:0;border-radius:12px;background:#00B8FC;color:#fff;font:600 14.5px/1 'Roboto',system-ui,sans-serif;cursor:pointer;transition:transform .18s,box-shadow .18s,background .18s;box-shadow:0 8px 20px -6px rgba(0,184,252,.5)}"+
      ".lpl-wn-btn:hover{background:#00a6e6;transform:translateY(-1px)}"+
      ".lpl-wn-btn:focus-visible{outline:2px solid #00B8FC;outline-offset:2px}";
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

  function whatsNew(){
    injectCss();
    var chk='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    var items=RELEASE.notes.map(function(n){ return "<li>"+chk+"<span>"+n+"</span></li>"; }).join("");
    var bg=document.createElement("div"); bg.className="lpl-wn-bg";
    bg.innerHTML="<div class='lpl-wn' role='dialog' aria-modal='true' aria-label='What’s New'>"+
      "<div class='lpl-wn-hd'><div class='lpl-wn-ey'>What’s New</div><div class='lpl-wn-t'>Pricelist updated</div><div class='lpl-wn-v'>Version "+RELEASE.version+" · "+RELEASE.date+"</div></div>"+
      "<div class='lpl-wn-bd'><ul>"+items+"</ul></div>"+
      "<div class='lpl-wn-ft'><button class='lpl-wn-btn' type='button'>Got it</button></div></div>";
    document.body.appendChild(bg);
    requestAnimationFrame(function(){ bg.classList.add("on"); });
    var btn=bg.querySelector(".lpl-wn-btn");
    function close(){ lset("lpl_wn",RELEASE.version); bg.classList.remove("on"); setTimeout(function(){ if(bg.parentNode)bg.parentNode.removeChild(bg); },260); document.removeEventListener("keydown",onKey); }
    function onKey(e){ if(e.key==="Escape")close(); }
    btn.addEventListener("click",close);
    bg.addEventListener("click",function(e){ if(e.target===bg)close(); });
    document.addEventListener("keydown",onKey);
    setTimeout(function(){ try{ btn.focus(); }catch(e){} },80);
  }

  function boot(){
    if(adminOpen()) return;
    var seenVer=lget("lpl_wn");
    stampOf().then(function(s){
      var seenStamp=lget("lpl_stamp");
      if(seenVer!==RELEASE.version){ whatsNew(); lset("lpl_stamp",s); }
      else if(seenStamp && s && s!==seenStamp){ updateSequence(); lset("lpl_stamp",s); }
      else { lset("lpl_stamp",s); }
    });
  }
  if(document.readyState==="complete"){ setTimeout(boot,1400); }
  else { window.addEventListener("load",function(){ setTimeout(boot,1400); }); }
})();
