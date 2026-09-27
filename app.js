const API = CONFIG.API_BASE_URL.replace(/\/+$/, "");
const LOGIN_URL = `${API}/login`;
const RESET_URL = `${API}/reset`;
const REDEEM_URL = `${API}/redeem`;
const ADMIN_URL = `${API}/admin`;

const state = {
  user: null,
  isAdmin: false,
  tab: location.hash.slice(1) || "overview",
  msg: "",
  msgType: "",
  adminUsers: [],
  adminKeys: [],
  adminPremiumMenus: []
};

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[c]));

function creds() {
  return {
    username: sessionStorage.getItem("vyrex_username") || "",
    password: sessionStorage.getItem("vyrex_password") || ""
  };
}

async function apiPost(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(body)
  });
  let data = {};
  try { data = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, data };
}

function setMessage(message, type="success") {
  state.msg = message;
  state.msgType = type;
}

function statusBadge(user) {
  if (Number(user?.isBanned) === 1) return `<span class="badge danger">Banned</span>`;
  if (!user?.key) return `<span class="badge neutral">No License</span>`;
  if (user?.expiresAt != null && Date.now() > Number(user.expiresAt)) {
    return `<span class="badge warning">Expired</span>`;
  }
  return `<span class="badge success">Active</span>`;
}

function formatExpiry(user) {
  if (!user?.key) return `<span class="muted">No active key</span>`;
  if (!user.expiresAt) return "Lifetime License";
  return new Date(Number(user.expiresAt)).toLocaleString([], {
    month:"short", day:"numeric", year:"numeric", hour:"2-digit", minute:"2-digit"
  });
}

function menuExpiry(ms) {
  if (ms == null) return `<span class="green strong">Lifetime License</span>`;
  const diff = Number(ms) - Date.now();
  if (diff <= 0) return `<span class="red strong">Expired</span>`;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const date = new Date(Number(ms)).toLocaleString([], {
    month:"short", day:"numeric", year:"numeric", hour:"2-digit", minute:"2-digit"
  });
  return `${esc(date)} <span class="purple small">(${days ? days+"d " : ""}${hours || days ? hours+"h " : ""}${minutes}m left)</span>`;
}

async function refreshUser() {
  const c = creds();
  if (!c.username || !c.password) return false;
  const result = await apiPost(LOGIN_URL, c);
  if (!result.ok || !result.data.user) {
    sessionStorage.clear();
    state.user = null;
    return false;
  }
  state.user = result.data.user;
  state.isAdmin = !!result.data.isAdmin;
  return true;
}

async function loadAdmin() {
  if (!state.isAdmin) return;
  const c = creds();
  const result = await apiPost(`${ADMIN_URL}/list`, c);
  if (result.ok) {
    state.adminUsers = result.data.users || [];
    state.adminKeys = result.data.keys || [];
    state.adminPremiumMenus = result.data.premiumMenus || [];
  }
}

async function doAuth(action, username, password, key="") {
  const endpoint = action === "register" ? LOGIN_URL.replace("/login", "/register") : LOGIN_URL;
  const body = {username, password};
  if (action === "register") body.key = key;
  const result = await apiPost(endpoint, body);
  if (!result.ok) throw new Error(result.data.message || "Request failed.");
  return result.data;
}

function loginView() {
  return `
  <div class="cursor-glow"></div>
  <main class="login-container">
    <div class="brand">
      <img src="logo.png" alt="Vyrex Logo">
      <h2>VYREX SOFTWARE</h2>
      <p id="auth-subtitle">Sign in to access your client panel</p>
    </div>
    <div id="auth-message"></div>
    <form id="auth-form">
      <input type="hidden" id="auth-action" value="login">
      <div class="input-group">
        <label>Username</label>
        <input id="auth-username" type="text" placeholder="Enter your username" required>
      </div>
      <div class="input-group">
        <label>Password</label>
        <div class="password-wrapper">
          <input id="auth-password" type="password" placeholder="••••••••" required>
          <button type="button" class="eye-btn" id="toggle-pwd">◉</button>
        </div>
      </div>
      <div class="input-group" id="key-group" hidden>
        <label>License Key</label>
        <input id="auth-key" type="text" placeholder="Enter your license key">
      </div>
      <button class="submit-btn" id="auth-submit">Log in to Dashboard</button>
      <div class="switch-auth">
        <a href="#" id="toggle-form">Don't have an account? <span>Register</span></a>
      </div>
    </form>
  </main>`;
}

function sidebar() {
  const links = [
    ["overview","Overview","▦"],
    ["active_menus","Active Menus","★"],
    ["loader","Loader","⇩"],
    ["redeem","Redeem Key","▣"],
    ["settings","Settings","⚙"]
  ];
  if (state.isAdmin) {
    links.push(["premium_center","Premium Center","★"]);
    links.push(["admin","Admin Panel","◈"]);
    links.push(["database","Database","▤"]);
  }
  return `<aside class="sidebar">
    <div class="sidebar-header"><h2><img src="logo.png"> VYREX SOFTWARE</h2></div>
    <nav class="nav-links">
      ${links.map(([id,label,icon]) => `<a href="#${id}" class="nav-link ${state.tab===id?"active":""} ${id==="active_menus"||id==="premium_center"?"purple-link":""}">${icon}<span>${label}</span></a>`).join("")}
    </nav>
    <div class="sidebar-footer"><a href="#" id="logout" class="logout-btn">⇥ <span>Disconnect</span></a></div>
  </aside>`;
}

function alertBox() {
  if (!state.msg) return "";
  return `<div class="alert ${state.msgType}">${state.msgType==="success"?"✓":"!"} ${esc(state.msg)}</div>`;
}

function overview() {
  const u = state.user || {};
  return `<div class="card animate-enter">
    <h3 class="card-title">▣ License Details</h3>
    <div class="info-grid">
      <div class="info-item"><label>Main License Key</label><div class="value ${u.key?"blur":""}">${u.key?esc(u.key):`<span class="muted">No active key</span>`}</div></div>
      <div class="info-item"><label>Base Expiration</label><div class="value">${formatExpiry(u)}</div></div>
      <div class="info-item"><label>Hardware ID</label><div class="value">${u.hwid?esc(u.hwid):`<span class="muted">Unbound</span>`}</div></div>
      <div class="info-item"><label>Account Status</label><div class="value">${statusBadge(u)}</div></div>
    </div>
  </div>`;
}

function activeMenus() {
  const u = state.user || {};
  let list = Array.isArray(u.allKeys) ? u.allKeys : [];
  if (!list.length) {
    if (u.key) list.push({menuName:"Vyrex", key:u.key, expiresAt:u.expiresAt, base:true});
    if (u.premiumKey) list.push({menuName:u.menuName || "Premium Menu", key:u.premiumKey, expiresAt:u.premiumExpiresAt});
  }
  return `<div class="card animate-enter">
    <h3 class="card-title purple-title">★ My Active Menus & Subscriptions</h3>
    <p class="muted paragraph">View all active base and premium menus linked to your account with their respective keys and expiration timers.</p>
    <div class="menu-grid">${list.length ? list.map(item => {
      const prefix = String(item.key||"").split("-")[0]?.toUpperCase() || "VYREX";
      const premium = item.menuName || prefix !== "VYREX";
      const name = item.menuName || (prefix !== "VYREX" ? prefix : "Vyrex");
      return `<div class="menu-card">
        <div class="menu-head"><strong>${esc(name)}</strong><span class="badge ${premium?"warning":"success"}">${premium?"Premium":"Base"}</span></div>
        <div class="menu-key">${esc(item.key || "No key")}</div>
        <div class="menu-exp">${menuExpiry(item.expiresAt)}</div>
      </div>`;
    }).join("") : `<div class="muted">No active menus found.</div>`}</div>
  </div>`;
}

function loader() {
  return `<div class="card animate-enter"><div class="download-box">
    <div class="big-icon">⇩</div><h3>Vyrex Loader</h3>
    <p class="muted">Download the latest loader from your client distribution endpoint.</p>
    <a class="btn" href="#" onclick="return false;">Loader unavailable on static mirror</a>
  </div></div>`;
}

function redeem() {
  return `<div class="card animate-enter"><h3 class="card-title">▣ Redeem License Key</h3>
    <p class="muted paragraph">Enter a valid redeem key to extend or activate your license.</p>
    <form id="redeem-form" class="compact-form">
      <label>License Key</label><input id="redeem-key" placeholder="Enter your license key" required>
      <button class="btn">Redeem Key</button>
    </form>
  </div>`;
}

function settings() {
  const u = state.user || {};
  const last = u.lastHwidReset ? new Date(Number(u.lastHwidReset)*1000).toLocaleDateString() : "Never Reset";
  const can = !u.lastHwidReset || (Date.now()/1000 - Number(u.lastHwidReset)) >= 30*86400;
  return `<div class="card animate-enter"><h3 class="card-title">⚙ Account Settings</h3>
    <div class="settings-row"><div><strong>Hardware ID Reset</strong><p class="muted">Last reset: ${esc(last)}</p></div>
      <button id="reset-hwid" class="btn" ${can?"":"disabled"}>${can?"Reset Hardware ID":"Available in 30 days"}</button>
    </div>
  </div>`;
}

function premiumCenter() {
  return `<div class="card animate-enter"><h3 class="card-title purple-title">★ Premium Center</h3>
    <p class="muted paragraph">Premium menus available on the account management API.</p>
    <div class="menu-grid">${state.adminPremiumMenus.length ? state.adminPremiumMenus.map(m=>`
      <div class="menu-card"><strong>${esc(m.name)}</strong><div class="muted">Prefix: ${esc(m.prefix)}</div></div>`).join("") :
      `<div class="muted">No premium menus found.</div>`}</div>
  </div>`;
}

async function adminAction(action, fields={}) {
  const c = creds();
  const body = {...c, ...fields};
  const result = await apiPost(`${ADMIN_URL}/${action}`, body);
  if (!result.ok) throw new Error(result.data.message || "Admin action failed.");
  setMessage(result.data.message || "Action successful.", "success");
  await loadAdmin();
  await refreshUser();
  render();
}

function adminPanel() {
  return `<div class="card animate-enter"><h3 class="card-title red-title">◈ Admin Panel</h3>
    <div class="admin-grid">
      <form id="gen-form" class="admin-form"><h4>Generate Key</h4>
        <input name="duration" placeholder="Duration (e.g. 30d)" required>
        <input name="prefix" placeholder="Prefix (optional)">
        <button class="btn">Generate</button>
      </form>
      <form id="mass-form" class="admin-form"><h4>Mass Generate</h4>
        <input name="amount" type="number" min="1" placeholder="Amount" required>
        <input name="duration" placeholder="Duration" required>
        <input name="targetDiscordId" placeholder="Target Discord ID" required>
        <input name="prefix" placeholder="Prefix (optional)">
        <button class="btn">Generate Keys</button>
      </form>
    </div>
    <div class="admin-section">
      <h4>Users</h4>
      <div class="table-wrap"><table><thead><tr><th>Username</th><th>Discord ID</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${state.adminUsers.length ? state.adminUsers.map(u=>`<tr>
        <td>${esc(u.username)}</td><td>${esc(u.discordId || "-")}</td><td>${u.isBanned?'<span class="badge danger">Banned</span>':'<span class="badge success">Active</span>'}</td>
        <td class="actions">
          <button class="mini-btn ban-user" data-user="${esc(u.username)}">${u.isBanned?"Unban":"Ban"}</button>
          <button class="mini-btn reset-user" data-user="${esc(u.username)}">Reset HWID</button>
          <button class="mini-btn delete-user" data-user="${esc(u.username)}">Delete</button>
        </td></tr>`).join("") : `<tr><td colspan="4" class="muted">No users found.</td></tr>`}
      </tbody></table></div>
    </div>
  </div>`;
}

function database() {
  return `<div class="card animate-enter"><h3 class="card-title red-title">▤ Database</h3>
    <div class="stat-grid"><div class="stat"><span>Users</span><b>${state.adminUsers.length}</b></div><div class="stat"><span>Keys</span><b>${state.adminKeys.length}</b></div></div>
    <h4>Keys</h4>
    <div class="table-wrap"><table><thead><tr><th>Key</th><th>Expiration</th><th>User</th><th>Action</th></tr></thead><tbody>
    ${state.adminKeys.length ? state.adminKeys.map(k=>`<tr><td class="mono">${esc(k.key)}</td><td>${k.expiresAt?esc(new Date(Number(k.expiresAt)).toLocaleDateString()):"Lifetime"}</td><td>${esc(k.username||"Unclaimed")}</td><td><button class="mini-btn delete-key" data-key="${esc(k.key)}">Delete</button></td></tr>`).join("") : `<tr><td colspan="4" class="muted">No keys found.</td></tr>`}
    </tbody></table></div>
  </div>`;
}

function content() {
  switch(state.tab) {
    case "active_menus": return activeMenus();
    case "loader": return loader();
    case "redeem": return redeem();
    case "settings": return settings();
    case "premium_center": return state.isAdmin ? premiumCenter() : overview();
    case "admin": return state.isAdmin ? adminPanel() : overview();
    case "database": return state.isAdmin ? database() : overview();
    default: return overview();
  }
}

function dashboardView() {
  const u = state.user || {};
  return `<div class="cursor-glow"></div>${sidebar()}
  <main class="main-content"><div class="main-container">
    <header class="header"><div><h1>${esc(u.username)}</h1><p>Manage your license and hardware limits</p></div>${statusBadge(u)}</header>
    ${alertBox()}${content()}
  </div></main>`;
}

function bindAuth() {
  $("#toggle-pwd").onclick = () => {
    const p=$("#auth-password"); p.type=p.type==="password"?"text":"password";
  };
  $("#toggle-form").onclick = (e) => {
    e.preventDefault();
    const reg=$("#auth-action").value==="login";
    $("#auth-action").value=reg?"register":"login";
    $("#key-group").hidden=!reg;
    $("#auth-key").required=reg;
    $("#auth-submit").textContent=reg?"Register Account":"Log in to Dashboard";
    $("#auth-subtitle").textContent=reg?"Register a new account":"Sign in to access your client panel";
    e.currentTarget.innerHTML=reg?'Already have an account? <span>Log in</span>':`Don't have an account? <span>Register</span>`;
  };
  $("#auth-form").onsubmit=async e=>{
    e.preventDefault();
    const btn=$("#auth-submit"); btn.disabled=true;
    $("#auth-message").innerHTML="";
    try {
      const action=$("#auth-action").value;
      const data=await doAuth(action,$("#auth-username").value.trim(),$("#auth-password").value,$("#auth-key").value.trim());
      if (action==="register") {
        $("#auth-message").innerHTML=`<div class="alert success">Account registered successfully. You can now log in.</div>`;
        $("#toggle-form").click();
      } else {
        if (!data.user?.discordId) {
          $("#auth-message").innerHTML=`<div class="alert error">This account requires Discord linking. Discord OAuth cannot safely be completed from GitHub Pages without a backend.</div>`;
        } else {
          sessionStorage.setItem("vyrex_username",$("#auth-username").value.trim());
          sessionStorage.setItem("vyrex_password",$("#auth-password").value);
          location.hash="overview"; await startDashboard();
        }
      }
    } catch(err) {
      $("#auth-message").innerHTML=`<div class="alert error">${esc(err.message)}</div>`;
    } finally { btn.disabled=false; }
  };
}

function bindDashboard() {
  document.querySelectorAll(".nav-link").forEach(a=>a.onclick=()=>{ state.tab=a.getAttribute("href").slice(1); state.msg=""; render(); });
  $("#logout").onclick=e=>{e.preventDefault();sessionStorage.clear();state.user=null;render();};
  $("#redeem-form")?.addEventListener("submit", async e=>{
    e.preventDefault();
    try {
      const c=creds(); const result=await apiPost(REDEEM_URL,{...c,redeemKey:$("#redeem-key").value.trim()});
      if(!result.ok) throw new Error(result.data.message||"An error occurred while redeeming.");
      setMessage("Key successfully redeemed! Your license has been extended.","success");
      await refreshUser(); render();
    } catch(err){setMessage(err.message,"error");render();}
  });
  $("#reset-hwid")?.addEventListener("click", async()=>{
    try {
      const result=await apiPost(RESET_URL,creds());
      if(!result.ok) throw new Error(result.data.message||"An error occurred.");
      setMessage("HWID has been successfully reset.","success");
      await refreshUser(); render();
    } catch(err){setMessage(err.message,"error");render();}
  });
  $("#gen-form")?.addEventListener("submit",async e=>{
    e.preventDefault(); const f=new FormData(e.currentTarget);
    try{await adminAction("genkey",{duration:f.get("duration"),prefix:f.get("prefix")});}catch(err){setMessage(err.message,"error");render();}
  });
  $("#mass-form")?.addEventListener("submit",async e=>{
    e.preventDefault(); const f=new FormData(e.currentTarget);
    try{await adminAction("massgen",{amount:f.get("amount"),duration:f.get("duration"),targetDiscordId:f.get("targetDiscordId"),prefix:f.get("prefix")});}catch(err){setMessage(err.message,"error");render();}
  });
  document.querySelectorAll(".ban-user").forEach(b=>b.onclick=async()=>{
    try{const u=b.dataset.user;const action=b.textContent.trim()==="Ban"?"ban":"unban";await adminAction("ban",{targetUsername:u,action});}catch(err){setMessage(err.message,"error");render();}
  });
  document.querySelectorAll(".reset-user").forEach(b=>b.onclick=async()=>{if(confirm("Reset this user's HWID?"))try{await adminAction("resethwid",{targetUsername:b.dataset.user});}catch(err){setMessage(err.message,"error");render();}});
  document.querySelectorAll(".delete-user").forEach(b=>b.onclick=async()=>{if(confirm("Delete this user?"))try{await adminAction("deleteuser",{targetUsername:b.dataset.user});}catch(err){setMessage(err.message,"error");render();}});
  document.querySelectorAll(".delete-key").forEach(b=>b.onclick=async()=>{if(confirm("Delete this key?"))try{await adminAction("deletekey",{targetKey:b.dataset.key});}catch(err){setMessage(err.message,"error");render();}});
}

function render() {
  if (!state.user) {
    document.body.innerHTML=loginView();
    bindAuth();
    document.addEventListener("mousemove", mouseGlow, {once:false});
    return;
  }
  document.body.innerHTML=dashboardView();
  bindDashboard();
  document.addEventListener("mousemove", mouseGlow, {once:false});
}

function mouseGlow(e) {
  document.documentElement.style.setProperty("--mouse-x",e.clientX+"px");
  document.documentElement.style.setProperty("--mouse-y",e.clientY+"px");
}

async function startDashboard() {
  const ok=await refreshUser();
  if(!ok){render();return;}
  if(state.isAdmin) await loadAdmin();
  render();
}

window.addEventListener("hashchange",()=>{
  if(state.user){state.tab=location.hash.slice(1)||"overview";render();}
});

(async()=>{
  const c=creds();
  if(c.username&&c.password) await startDashboard();
  else render();
})();
