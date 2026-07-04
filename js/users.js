/* ============================================================================
   Logitech Pricelist CMS - Admin "Users" panel (v1, 2026-07-04)
   ----------------------------------------------------------------------------
   Injects a "Users" button into the Admin top bar (next to Publish). Lets the
   owner (master passphrase) and admin-role users create, edit, disable and
   delete publish accounts. Talks to the Cloudflare Worker /users endpoints.
   Passphrases are hashed server-side (SHA-256) and never stored in the repo.
   Requires Worker v3 + a USERS KV binding; shows a friendly notice otherwise.
   ============================================================================ */
(function () {
  "use strict";

  function endpoint() {
    return (window.CMS_CONFIG || {}).backendEndpoint || "https://logitech-cms.raffyortega-rojo.workers.dev";
  }

  function toast(msg, ok) {
    var t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText =
      "position:fixed;z-index:100001;left:50%;top:22px;transform:translateX(-50%);" +
      "background:" + (ok === false ? "#c0392b" : ok ? "#0a7f3f" : "#0b1320") +
      ";color:#fff;padding:12px 18px;border-radius:10px;font:600 14px/1.35 Poppins,system-ui,sans-serif;" +
      "box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:82vw;text-align:center";
    document.body.appendChild(t);
    setTimeout(function () {
      t.style.transition = "opacity .4s"; t.style.opacity = "0";
      setTimeout(function () { t.remove(); }, 400);
    }, ok === false ? 6000 : 3800);
  }

  function getToken(forcePrompt) {
    var tok = sessionStorage.getItem("cmsAdminToken");
    if (!tok || forcePrompt) {
      tok = window.prompt("Enter your Publish passphrase (owner or admin):");
      if (tok) sessionStorage.setItem("cmsAdminToken", tok);
    }
    return tok;
  }

  async function api(method, path, body) {
    var tok = getToken(false);
    if (!tok) return { cancelled: true };
    var res, data = {};
    try {
      res = await fetch(endpoint() + path, {
        method: method,
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) { return { error: "Network error: " + (e && e.message ? e.message : e) }; }
    try { data = await res.json(); } catch (e) {}
    if (res.status === 401) {
      sessionStorage.removeItem("cmsAdminToken");
      return { error: "Wrong passphrase. Click Users again to retry." };
    }
    if (res.status === 403) return { error: "Your account is not an admin - ask the owner for access." };
    if (res.status === 501) return { error: "User management is not set up yet on the Worker (USERS KV binding missing)." };
    if (!res.ok) return { error: (data && data.error) || ("HTTP " + res.status) };
    return { data: data };
  }

  /* ------------------------------- UI ---------------------------------- */

  var overlay = null;

  function closePanel() { if (overlay) { overlay.remove(); overlay = null; } }

  function el(tag, css, text) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  }

  var BTN = "border:0;cursor:pointer;border-radius:9px;font:700 12px/1 Poppins,system-ui,sans-serif;padding:8px 12px;color:#fff;";

  async function openPanel() {
    var r = await api("GET", "/users");
    if (r.cancelled) return;
    if (r.error) { toast(r.error, false); return; }
    render(r.data.users || [], r.data.you || "owner");
  }

  function render(users, you) {
    closePanel();
    overlay = el("div",
      "position:fixed;inset:0;z-index:100000;background:rgba(11,19,32,.55);display:flex;align-items:center;justify-content:center;padding:18px");
    var card = el("div",
      "background:#fff;color:#2F3132;width:640px;max-width:96vw;max-height:88vh;overflow:auto;border-radius:16px;" +
      "box-shadow:0 18px 60px rgba(0,0,0,.35);font:400 14px/1.45 Poppins,system-ui,sans-serif;padding:22px");
    overlay.appendChild(card);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closePanel(); });

    var head = el("div", "display:flex;align-items:center;justify-content:space-between;margin-bottom:4px");
    head.appendChild(el("div", "font:700 18px/1.2 Poppins,system-ui,sans-serif", "Publish Users"));
    var x = el("button", BTN + "background:#8a8f93", "Close");
    x.onclick = closePanel; head.appendChild(x);
    card.appendChild(head);
    card.appendChild(el("div", "color:#8a8f93;font-size:12px;margin-bottom:14px",
      "Signed in as: " + you + ". Each user gets their own publish passphrase; publishes are tagged with their name. " +
      "Admins can manage users; editors can only publish."));

    var tbl = el("table", "width:100%;border-collapse:collapse;font-size:13px");
    var thead = el("tr", "text-align:left;color:#8a8f93;font-size:11px;text-transform:uppercase;letter-spacing:.4px");
    ["User", "Role", "Status", "Actions"].forEach(function (h) {
      thead.appendChild(el("th", "padding:6px 8px;border-bottom:1px solid #e8eaec", h));
    });
    tbl.appendChild(thead);

    if (!users.length) {
      var tr0 = el("tr"); var td0 = el("td", "padding:14px 8px;color:#8a8f93");
      td0.colSpan = 4; td0.textContent = "No users yet - add the first one below.";
      tr0.appendChild(td0); tbl.appendChild(tr0);
    }

    users.forEach(function (u) {
      var tr = el("tr");
      tr.appendChild(el("td", "padding:9px 8px;border-bottom:1px solid #f0f1f3;font-weight:600", u.username));
      tr.appendChild(el("td", "padding:9px 8px;border-bottom:1px solid #f0f1f3", u.role));
      tr.appendChild(el("td", "padding:9px 8px;border-bottom:1px solid #f0f1f3;color:" + (u.disabled ? "#c0392b" : "#0a7f3f"),
        u.disabled ? "disabled" : "active"));
      var act = el("td", "padding:9px 8px;border-bottom:1px solid #f0f1f3;white-space:nowrap");

      var edit = el("button", BTN + "background:#00B8FC;margin-right:6px", "Edit");
      edit.onclick = function () { fillForm(u); };
      act.appendChild(edit);

      var tog = el("button", BTN + "background:" + (u.disabled ? "#0a7f3f" : "#e67e22") + ";margin-right:6px",
        u.disabled ? "Enable" : "Disable");
      tog.onclick = async function () {
        var r = await api("POST", "/users", { username: u.username, role: u.role, disabled: !u.disabled });
        if (r.error) { toast(r.error, false); return; }
        toast(u.username + (u.disabled ? " enabled." : " disabled."), true); openPanel();
      };
      act.appendChild(tog);

      var del = el("button", BTN + "background:#c0392b", "Delete");
      del.onclick = async function () {
        if (!window.confirm('Delete user "' + u.username + '"? They will no longer be able to publish.')) return;
        var r = await api("DELETE", "/users?username=" + encodeURIComponent(u.username));
        if (r.error) { toast(r.error, false); return; }
        toast(u.username + " deleted.", true); openPanel();
      };
      act.appendChild(del);

      tr.appendChild(act);
      tbl.appendChild(tr);
    });
    card.appendChild(tbl);

    /* ---- add / edit form ---- */
    card.appendChild(el("div", "font:700 14px/1 Poppins,system-ui,sans-serif;margin:18px 0 8px", "Add / edit user"));
    var form = el("div", "display:flex;flex-wrap:wrap;gap:8px;align-items:center");
    var IN = "padding:9px 11px;border:1px solid #d6d9dc;border-radius:9px;font:400 13px Poppins,system-ui,sans-serif";
    var fUser = el("input", IN); fUser.placeholder = "username";
    var fPass = el("input", IN); fPass.placeholder = "passphrase (min 8 chars)"; fPass.type = "password";
    var fRole = document.createElement("select"); fRole.style.cssText = IN;
    ["editor", "admin"].forEach(function (o) { var op = document.createElement("option"); op.value = o; op.textContent = o; fRole.appendChild(op); });
    var save = el("button", BTN + "background:linear-gradient(135deg,#00B8FC,#0099D9);padding:10px 16px", "Save user");
    form.appendChild(fUser); form.appendChild(fPass); form.appendChild(fRole); form.appendChild(save);
    card.appendChild(form);
    var hint = el("div", "color:#8a8f93;font-size:11px;margin-top:8px",
      "Editing an existing user: type the same username; leave the passphrase blank to keep the current one.");
    card.appendChild(hint);

    function fillForm(u) { fUser.value = u.username; fRole.value = u.role; fPass.value = ""; fPass.focus(); }

    save.onclick = async function () {
      var username = fUser.value.trim();
      if (!username) { toast("Username is required.", false); return; }
      var body = { username: username, role: fRole.value };
      if (fPass.value) body.passphrase = fPass.value;
      save.disabled = true; save.textContent = "Saving...";
      var r = await api("POST", "/users", body);
      save.disabled = false; save.textContent = "Save user";
      if (r.error) { toast(r.error, false); return; }
      toast((r.data.created ? "Created " : "Updated ") + username + ".", true);
      openPanel();
    };

    document.body.appendChild(overlay);
  }

  /* ---- inject button next to Publish ---- */
  function makeBtn() {
    var b = document.createElement("button");
    b.id = "cmsUsersBtn";
    b.type = "button";
    b.textContent = "Users";
    b.title = "Manage who can publish (owner/admin only)";
    b.style.cssText =
      "margin-left:8px;flex:0 0 auto;border:0;cursor:pointer;color:#fff;background:#2F3132;" +
      "font:700 13px/1 Poppins,system-ui,sans-serif;padding:10px 16px;border-radius:11px;" +
      "box-shadow:0 3px 8px rgba(0,0,0,.18)";
    b.addEventListener("click", openPanel);
    return b;
  }

  function tryInject() {
    var top = document.querySelector(".ad-saas .sx-top");
    if (top && !document.getElementById("cmsUsersBtn")) top.appendChild(makeBtn());
  }

  var mo = new MutationObserver(tryInject);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  tryInject();
})();
