import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getDatabase, ref, get, push, set, update, remove, query, orderByChild, limitToLast
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

/* ===================== FIREBASE INIT (same existing project — unchanged) ===================== */
const firebaseConfig = {
  apiKey: "AIzaSyA4kRF_flz5aweGQdEypNzI9K0fAnzHlyA",
  authDomain: "mr-apk-bazar.firebaseapp.com",
  projectId: "mr-apk-bazar",
  storageBucket: "mr-apk-bazar.firebasestorage.app",
  messagingSenderId: "208873681519",
  appId: "1:208873681519:web:9a9a84fbb19f2cf866d39a",
  measurementId: "G-DGGTZ1PS6C"
};
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getDatabase(fbApp);

/* App icon / screenshot uploads go directly to ImgBB. */
const IMGBB_API_KEY = "6658b0081293e86ee34fcc270064fbfa";
async function uploadToImgbb(file){
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method:"POST", body:form });
  const data = await res.json();
  if(!res.ok || !data || !data.success || !data.data || !data.data.url){
    throw new Error("imgbb upload failed");
  }
  return data.data.url;
}

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
function escapeHtml(s){ const d=document.createElement("div"); d.textContent=s??""; return d.innerHTML; }

const state = { user:null, isAdmin:false, apps:[], hostLinks:[], prompts:[], admins:[], users:[] };

/* ===================== TOAST ===================== */
function toast(msg, type="default"){
  const host = $("#toast-host");
  const el = document.createElement("div");
  el.className = "toast" + (type==="error" ? " error" : type==="success" ? " success" : "");
  const icon = type==="error"
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>';
  el.innerHTML = icon + `<span>${escapeHtml(msg)}</span>`;
  host.appendChild(el);
  setTimeout(()=>{ el.style.opacity="0"; el.style.transition="opacity .2s"; setTimeout(()=>el.remove(),200); }, 3000);
}

/* ===================== AUTH ===================== */
$("#btn-login").addEventListener("click", doLogin);
$("#admin-pass").addEventListener("keydown", (e)=>{ if(e.key==="Enter") doLogin(); });
async function doLogin(){
  const email = $("#admin-email").value.trim();
  const pass = $("#admin-pass").value;
  const errEl = $("#login-error");
  errEl.textContent = "";
  if(!email || !pass){ errEl.textContent = "Please enter email and password."; return; }
  $("#login-btn-label").innerHTML = '<span class="spinner" style="display:inline-block;"></span>';
  try{
    await signInWithEmailAndPassword(auth, email, pass);
  }catch(err){
    errEl.textContent = "Sign-in failed. Check your email and password.";
  }
  $("#login-btn-label").textContent = "Sign In";
}
$("#btn-signout").addEventListener("click", ()=> signOut(auth));
$("#btn-denied-signout").addEventListener("click", ()=> signOut(auth));

onAuthStateChanged(auth, async (user)=>{
  state.user = user;
  if(!user){
    state.isAdmin = false;
    $("#login-screen").style.display = "flex";
    $("#denied-screen").style.display = "none";
    $("#shell").classList.remove("show");
    return;
  }
  // verify admin flag
  try{
    const snap = await get(ref(db, `admins/${user.uid}`));
    if(snap.exists() && snap.val() === true){
      state.isAdmin = true;
      $("#login-screen").style.display = "none";
      $("#denied-screen").style.display = "none";
      $("#shell").classList.add("show");
      $("#side-email").textContent = user.email || user.uid;
      boot();
    }else{
      state.isAdmin = false;
      $("#login-screen").style.display = "none";
      $("#denied-screen").style.display = "flex";
      $("#denied-uid").textContent = "Your UID: " + user.uid;
    }
  }catch(err){
    // likely blocked by security rules (not an admin)
    state.isAdmin = false;
    $("#login-screen").style.display = "none";
    $("#denied-screen").style.display = "flex";
    $("#denied-uid").textContent = "Your UID: " + user.uid;
  }
});

/* ===================== NAV (+ browser/hardware back button support) ===================== */
state.currentPage = "dashboard";
$$(".side-nav button").forEach(btn=>{
  btn.addEventListener("click", ()=> switchPage(btn.dataset.page));
});
function applyPage(name){
  state.currentPage = name;
  $$(".page").forEach(p=> p.classList.toggle("show", p.id === "page-"+name));
  $$(".side-nav button").forEach(b=> b.classList.toggle("active", b.dataset.page===name));
  $("#sidebar").classList.remove("open");
  if(name==="apps") renderAppsList();
  if(name==="host") renderHostList();
  if(name==="prompts") renderPromptsList();
  if(name==="settings") loadSettingsForm();
  if(name==="analytics") loadAnalytics();
  if(name==="admins") renderAdminsList();
  if(name==="users") renderUsersList();
  if(name==="dashboard") renderDashboard();
}
function switchPage(name){
  const changed = state.currentPage !== name;
  applyPage(name);
  if(changed) history.pushState({type:"page", page:name}, "", location.href);
}
window.addEventListener("popstate", (e)=>{
  const st = e.state;
  const modalIds = { "app-modal":closeAppModal, "host-modal":closeHostModal, "prompt-modal":closePromptModal };
  const openModalKey = Object.keys(modalIds).find(id => $("#"+id).classList.contains("show"));
  const targetIsModal = !!(st && st.type === "overlay" && modalIds[st.overlay]);

  if(openModalKey && st?.overlay !== openModalKey) modalIds[openModalKey]();

  if(st && st.type === "page"){
    applyPage(st.page);
  } else if(!st && !targetIsModal){
    applyPage("dashboard");
  }
});
$("#btn-menu-toggle").addEventListener("click", ()=> $("#sidebar").classList.toggle("open"));

// base history entry so the first back-button press has a "dashboard"
// state to land on instead of leaving the panel
history.replaceState({type:"page", page:"dashboard"}, "", location.href);

/* ===================== BOOT / LOAD APPS ===================== */
async function boot(){
  await loadApps();
  renderDashboard();
}
async function loadApps(){
  try{
    const snap = await get(ref(db, "apps"));
    const val = snap.exists() ? snap.val() : {};
    state.apps = Object.entries(val).map(([id,v])=>({id,...v}));
  }catch(err){
    toast("Unable to load apps.", "error");
  }
}

/* ===================== DASHBOARD ===================== */
function renderDashboard(){
  $("#stat-total-apps").textContent = state.apps.length;
  $("#stat-enabled-apps").textContent = state.apps.filter(a=>a.enabled!==false).length;
  const cats = new Set(state.apps.map(a=>a.category).filter(Boolean));
  $("#stat-categories").textContent = cats.size;
  $("#stat-downloads").textContent = "—";
  get(ref(db,"analytics")).then(snap=>{
    $("#stat-downloads").textContent = snap.exists() ? Object.keys(snap.val()).length : 0;
  }).catch(()=>{ $("#stat-downloads").textContent = "N/A"; });
  $("#stat-users").textContent = "—";
  get(ref(db,"users")).then(snap=>{
    $("#stat-users").textContent = snap.exists() ? Object.keys(snap.val()).length : 0;
  }).catch(()=>{ $("#stat-users").textContent = "N/A"; });

  const recent = [...state.apps].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,6);
  const wrap = $("#dash-recent");
  wrap.innerHTML = recent.length ? recent.map(appRowHtml).join("") : `<div class="empty-note">No apps yet. Add your first one from the Apps tab.</div>`;
  bindAppRowActions(wrap);
}

/* ===================== APPS LIST ===================== */
function appRowHtml(app){
  const icon = app.logoUrl ? `<img src="${escapeHtml(app.logoUrl)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ic',textContent:'${escapeHtml((app.name||'?').charAt(0).toUpperCase())}'}))">` : `<div class="ic">${escapeHtml((app.name||"?").charAt(0).toUpperCase())}</div>`;
  const typeLabel = { play_store:"Google Play", google_drive:"Google Drive", direct_apk:"Direct APK" }[app.downloadType || "direct_apk"];
  return `<div class="list-row">
    ${icon}
    <div class="info">
      <div class="n">${escapeHtml(app.name||"Untitled app")}</div>
      <div class="m">
        ${app.version ? `<span>v${escapeHtml(app.version)}</span>` : ""}
        ${app.category ? `<span>· ${escapeHtml(app.category)}</span>` : ""}
        <span class="badge">${typeLabel}</span>
        <span class="badge ${app.enabled!==false?'on':'off'}">${app.enabled!==false?"Enabled":"Disabled"}</span>
        ${app.featured ? `<span class="badge feat">Featured</span>` : ""}
      </div>
    </div>
    <div class="row-actions">
      <button class="icon-btn" data-edit="${escapeHtml(app.id)}" aria-label="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
      <button class="icon-btn danger" data-del="${escapeHtml(app.id)}" aria-label="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg></button>
    </div>
  </div>`;
}
function renderAppsList(){
  const q = $("#apps-search").value.trim().toLowerCase();
  const list = q ? state.apps.filter(a=>(a.name||"").toLowerCase().includes(q) || (a.category||"").toLowerCase().includes(q)) : state.apps;
  const wrap = $("#apps-list");
  wrap.innerHTML = list.length ? list.map(appRowHtml).join("") : `<div class="empty-note">No apps found.</div>`;
  bindAppRowActions(wrap);
}
$("#apps-search").addEventListener("input", renderAppsList);
function bindAppRowActions(root){
  $$("[data-edit]", root).forEach(btn=> btn.addEventListener("click", ()=> openAppModal(btn.dataset.edit)));
  $$("[data-del]", root).forEach(btn=> btn.addEventListener("click", ()=> deleteApp(btn.dataset.del)));
}
async function deleteApp(id){
  const app = state.apps.find(a=>a.id===id);
  if(!confirm(`Delete "${app ? app.name : "this app"}"? This cannot be undone.`)) return;
  try{
    await remove(ref(db, `apps/${id}`));
    state.apps = state.apps.filter(a=>a.id!==id);
    toast("App deleted.", "success");
    renderAppsList(); renderDashboard();
  }catch(err){ toast("Delete failed. Check your permissions.", "error"); }
}

/* ===================== APP FORM MODAL ===================== */
const dlUrlLabels = { direct_apk:"Direct APK download URL", google_drive:"Google Drive file URL", play_store:"Google Play Store URL" };
$("#app-dltype").addEventListener("change", ()=>{
  $("#app-url-label").textContent = dlUrlLabels[$("#app-dltype").value];
});
$("#btn-add-app").addEventListener("click", ()=> openAppModal(null));
$("#app-modal-close").addEventListener("click", ()=> history.back());
$("#app-modal-cancel").addEventListener("click", ()=> history.back());
$("#app-overlay").addEventListener("click", ()=> history.back());

$("#btn-upload-logo").addEventListener("click", ()=> $("#logo-file-input").click());
$("#logo-file-input").addEventListener("change", async (e)=>{
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  const statusEl = $("#logo-upload-status");
  statusEl.textContent = "Uploading...";
  try{
    const url = await uploadToImgbb(file);
    $("#app-logo").value = url;
    statusEl.textContent = "Uploaded ✓";
    setTimeout(()=>{ statusEl.textContent = ""; }, 2500);
  }catch(err){
    statusEl.textContent = "Upload failed.";
    toast("Icon upload failed. Please try again.", "error");
  }
  e.target.value = "";
});

$("#btn-upload-screenshots").addEventListener("click", ()=> $("#shots-file-input").click());
$("#shots-file-input").addEventListener("change", async (e)=>{
  const files = Array.from(e.target.files || []);
  if(!files.length) return;
  const statusEl = $("#shots-upload-status");
  statusEl.textContent = `Uploading 0/${files.length}...`;
  const urls = [];
  let done = 0;
  for(const file of files){
    try{
      const url = await uploadToImgbb(file);
      urls.push(url);
    }catch(err){ /* skip this one, continue with the rest */ }
    done++;
    statusEl.textContent = `Uploading ${done}/${files.length}...`;
  }
  if(urls.length){
    const existing = $("#app-screenshots").value.trim();
    $("#app-screenshots").value = existing ? existing + "\n" + urls.join("\n") : urls.join("\n");
  }
  statusEl.textContent = urls.length === files.length ? "Uploaded ✓" : `Uploaded ${urls.length}/${files.length} (some failed)`;
  setTimeout(()=>{ statusEl.textContent = ""; }, 3000);
  e.target.value = "";
});

function openAppModal(id){
  const app = id ? state.apps.find(a=>a.id===id) : null;
  $("#app-modal-title").textContent = app ? "Edit App" : "Add App";
  $("#app-id").value = app ? app.id : "";
  $("#app-name").value = app?.name || "";
  $("#app-version").value = app?.version || "";
  $("#app-category").value = app?.category || "";
  $("#app-logo").value = app?.logoUrl || "";
  $("#logo-upload-status").textContent = "";
  $("#shots-upload-status").textContent = "";
  $("#app-desc").value = app?.description || "";
  $("#app-notes").value = app?.updateNotes || "";
  $("#app-instructions").value = app?.instructions || "";
  const shots = Array.isArray(app?.screenshots) ? app.screenshots : (app?.screenshots ? Object.values(app.screenshots) : []);
  $("#app-screenshots").value = shots.join("\n");
  $("#app-dltype").value = app?.downloadType || "direct_apk";
  $("#app-url-label").textContent = dlUrlLabels[$("#app-dltype").value];
  $("#app-url").value = app?.downloadUrl || "";
  $("#app-enabled").checked = app ? app.enabled !== false : true;
  $("#app-featured").checked = !!app?.featured;
  $("#app-overlay").classList.add("show");
  $("#app-modal").classList.add("show");
  history.pushState({type:"overlay", overlay:"app-modal"}, "", location.href);
}
function closeAppModal(){
  $("#app-overlay").classList.remove("show");
  $("#app-modal").classList.remove("show");
}
$("#app-modal-save").addEventListener("click", saveAppForm);
async function saveAppForm(){
  const name = $("#app-name").value.trim();
  if(!name){ toast("App name is required.", "error"); return; }
  const url = $("#app-url").value.trim();
  if(url && !/^https:\/\//i.test(url)){ toast("Download URL must start with https://", "error"); return; }
  const shots = $("#app-screenshots").value.split("\n").map(s=>s.trim()).filter(Boolean);
  const id = $("#app-id").value;
  const now = Date.now();
  const payload = {
    name,
    version: $("#app-version").value.trim(),
    category: $("#app-category").value.trim(),
    logoUrl: $("#app-logo").value.trim(),
    description: $("#app-desc").value.trim(),
    updateNotes: $("#app-notes").value.trim(),
    instructions: $("#app-instructions").value.trim(),
    screenshots: shots,
    downloadType: $("#app-dltype").value,
    downloadUrl: url,
    enabled: $("#app-enabled").checked,
    featured: $("#app-featured").checked,
    updatedAt: now
  };
  try{
    if(id){
      await update(ref(db, `apps/${id}`), payload);
      toast("App updated.", "success");
    }else{
      payload.createdAt = now;
      const newRef = push(ref(db, "apps"));
      await set(newRef, payload);
      toast("App added.", "success");
    }
    closeAppModal();
    await loadApps();
    renderAppsList(); renderDashboard();
  }catch(err){
    toast("Save failed. Check your permissions.", "error");
  }
}

/* ===================== HOST LINKS ===================== */
async function loadHostLinks(){
  try{
    const snap = await get(ref(db, "hostLinks"));
    const val = snap.exists() ? snap.val() : {};
    state.hostLinks = Object.entries(val).map(([id,v])=>({id,...v}));
  }catch(err){ toast("Unable to load host links.", "error"); }
}
function hostRowHtml(link){
  const icon = link.logoUrl ? `<img src="${escapeHtml(link.logoUrl)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ic',textContent:'${escapeHtml((link.name||'?').charAt(0).toUpperCase())}'}))">` : `<div class="ic">${escapeHtml((link.name||"?").charAt(0).toUpperCase())}</div>`;
  return `<div class="list-row">
    ${icon}
    <div class="info">
      <div class="n">${escapeHtml(link.name||"Untitled")}</div>
      <div class="m">
        <span class="badge ${link.videoUrl ? "on" : "off"}">${link.videoUrl ? "Setup video set" : "No setup video"}</span>
        <span class="badge ${link.enabled!==false?'on':'off'}">${link.enabled!==false?"Enabled":"Disabled"}</span>
      </div>
    </div>
    <div class="row-actions">
      <button class="icon-btn" data-edit-host="${escapeHtml(link.id)}" aria-label="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
      <button class="icon-btn danger" data-del-host="${escapeHtml(link.id)}" aria-label="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg></button>
    </div>
  </div>`;
}
async function renderHostList(){
  const wrap = $("#host-list");
  wrap.innerHTML = `<div class="empty-note">Loading...</div>`;
  await loadHostLinks();
  wrap.innerHTML = state.hostLinks.length ? state.hostLinks.map(hostRowHtml).join("") : `<div class="empty-note">No host links yet. Add your first one.</div>`;
  $$("[data-edit-host]", wrap).forEach(btn=> btn.addEventListener("click", ()=> openHostModal(btn.dataset.editHost)));
  $$("[data-del-host]", wrap).forEach(btn=> btn.addEventListener("click", ()=> deleteHost(btn.dataset.delHost)));
}
async function deleteHost(id){
  const link = state.hostLinks.find(l=>l.id===id);
  if(!confirm(`Delete "${link ? link.name : "this host link"}"? This cannot be undone.`)) return;
  try{
    await remove(ref(db, `hostLinks/${id}`));
    state.hostLinks = state.hostLinks.filter(l=>l.id!==id);
    toast("Host link deleted.", "success");
    renderHostList();
  }catch(err){ toast("Delete failed. Check your permissions.", "error"); }
}
$("#btn-add-host").addEventListener("click", ()=> openHostModal(null));
$("#host-modal-close").addEventListener("click", ()=> history.back());
$("#host-modal-cancel").addEventListener("click", ()=> history.back());
$("#host-overlay").addEventListener("click", ()=> history.back());
$("#btn-upload-host-logo").addEventListener("click", ()=> $("#host-logo-file-input").click());
$("#host-logo-file-input").addEventListener("change", async (e)=>{
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  const statusEl = $("#host-logo-upload-status");
  statusEl.textContent = "Uploading...";
  try{
    const url = await uploadToImgbb(file);
    $("#host-logo").value = url;
    statusEl.textContent = "Uploaded ✓";
    setTimeout(()=>{ statusEl.textContent = ""; }, 2500);
  }catch(err){
    statusEl.textContent = "Upload failed.";
    toast("Logo upload failed. Please try again.", "error");
  }
  e.target.value = "";
});
function openHostModal(id){
  const link = id ? state.hostLinks.find(l=>l.id===id) : null;
  $("#host-modal-title").textContent = link ? "Edit Host Link" : "Add Host Link";
  $("#host-id").value = link ? link.id : "";
  $("#host-name").value = link?.name || "";
  $("#host-logo").value = link?.logoUrl || "";
  $("#host-logo-upload-status").textContent = "";
  $("#host-desc").value = link?.description || "";
  $("#host-url").value = link?.url || "";
  $("#host-video").value = link?.videoUrl || "";
  $("#host-enabled").checked = link ? link.enabled !== false : true;
  $("#host-overlay").classList.add("show");
  $("#host-modal").classList.add("show");
  history.pushState({type:"overlay", overlay:"host-modal"}, "", location.href);
}
function closeHostModal(){
  $("#host-overlay").classList.remove("show");
  $("#host-modal").classList.remove("show");
}
$("#host-modal-save").addEventListener("click", saveHostForm);
async function saveHostForm(){
  const name = $("#host-name").value.trim();
  if(!name){ toast("Name is required.", "error"); return; }
  const url = $("#host-url").value.trim();
  if(url && !/^https:\/\//i.test(url)){ toast("Link URL must start with https://", "error"); return; }
  const videoUrl = $("#host-video").value.trim();
  if(videoUrl && !/^https:\/\//i.test(videoUrl)){ toast("Setup video URL must start with https://", "error"); return; }
  const id = $("#host-id").value;
  const payload = {
    name,
    logoUrl: $("#host-logo").value.trim(),
    description: $("#host-desc").value.trim(),
    url,
    videoUrl,
    enabled: $("#host-enabled").checked
  };
  try{
    if(id){
      await update(ref(db, `hostLinks/${id}`), payload);
      toast("Host link updated.", "success");
    }else{
      await set(push(ref(db, "hostLinks")), payload);
      toast("Host link added.", "success");
    }
    closeHostModal();
    renderHostList();
  }catch(err){
    toast("Save failed. Check your permissions.", "error");
  }
}

/* ===================== PROMPTS ===================== */
async function loadPrompts(){
  try{
    const snap = await get(ref(db, "prompts"));
    const val = snap.exists() ? snap.val() : {};
    state.prompts = Object.entries(val).map(([id,v])=>({id,...v}));
  }catch(err){ toast("Unable to load prompts.", "error"); }
}
function promptRowHtml(p){
  const preview = (p.promptText||"").slice(0,70);
  return `<div class="list-row">
    <div class="ic">${escapeHtml((p.title||"?").charAt(0).toUpperCase())}</div>
    <div class="info">
      <div class="n">${escapeHtml(p.title||"Untitled")}</div>
      <div class="m">
        <span>${escapeHtml(preview)}${(p.promptText||"").length>70?"…":""}</span>
        <span class="badge ${p.enabled!==false?'on':'off'}">${p.enabled!==false?"Enabled":"Disabled"}</span>
      </div>
    </div>
    <div class="row-actions">
      <button class="icon-btn" data-edit-prompt="${escapeHtml(p.id)}" aria-label="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
      <button class="icon-btn danger" data-del-prompt="${escapeHtml(p.id)}" aria-label="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg></button>
    </div>
  </div>`;
}
async function renderPromptsList(){
  const wrap = $("#prompts-list");
  wrap.innerHTML = `<div class="empty-note">Loading...</div>`;
  await loadPrompts();
  wrap.innerHTML = state.prompts.length ? state.prompts.map(promptRowHtml).join("") : `<div class="empty-note">No prompts yet. Add your first one.</div>`;
  $$("[data-edit-prompt]", wrap).forEach(btn=> btn.addEventListener("click", ()=> openPromptModal(btn.dataset.editPrompt)));
  $$("[data-del-prompt]", wrap).forEach(btn=> btn.addEventListener("click", ()=> deletePrompt(btn.dataset.delPrompt)));
}
async function deletePrompt(id){
  const p = state.prompts.find(x=>x.id===id);
  if(!confirm(`Delete "${p ? p.title : "this prompt"}"? This cannot be undone.`)) return;
  try{
    await remove(ref(db, `prompts/${id}`));
    state.prompts = state.prompts.filter(x=>x.id!==id);
    toast("Prompt deleted.", "success");
    renderPromptsList();
  }catch(err){ toast("Delete failed. Check your permissions.", "error"); }
}
$("#btn-add-prompt").addEventListener("click", ()=> openPromptModal(null));
$("#prompt-modal-close").addEventListener("click", ()=> history.back());
$("#prompt-modal-cancel").addEventListener("click", ()=> history.back());
$("#prompt-overlay").addEventListener("click", ()=> history.back());
function openPromptModal(id){
  const p = id ? state.prompts.find(x=>x.id===id) : null;
  $("#prompt-modal-title").textContent = p ? "Edit Prompt" : "Add Prompt";
  $("#prompt-id").value = p ? p.id : "";
  $("#prompt-title").value = p?.title || "";
  $("#prompt-text").value = p?.promptText || "";
  $("#prompt-enabled").checked = p ? p.enabled !== false : true;
  $("#prompt-overlay").classList.add("show");
  $("#prompt-modal").classList.add("show");
  history.pushState({type:"overlay", overlay:"prompt-modal"}, "", location.href);
}
function closePromptModal(){
  $("#prompt-overlay").classList.remove("show");
  $("#prompt-modal").classList.remove("show");
}
$("#prompt-modal-save").addEventListener("click", savePromptForm);
async function savePromptForm(){
  const title = $("#prompt-title").value.trim();
  const promptText = $("#prompt-text").value.trim();
  if(!title || !promptText){ toast("Title and prompt text are required.", "error"); return; }
  const id = $("#prompt-id").value;
  const payload = { title, promptText, enabled: $("#prompt-enabled").checked };
  try{
    if(id){
      await update(ref(db, `prompts/${id}`), payload);
      toast("Prompt updated.", "success");
    }else{
      await set(push(ref(db, "prompts")), payload);
      toast("Prompt added.", "success");
    }
    closePromptModal();
    renderPromptsList();
  }catch(err){
    toast("Save failed. Check your permissions.", "error");
  }
}

/* ===================== SETTINGS ===================== */
async function loadSettingsForm(){
  try{
    const snap = await get(ref(db, "settings"));
    const s = snap.exists() ? snap.val() : {};
    $("#set-name").value = s.siteName || "";
    $("#set-tagline").value = s.tagline || "";
    $("#set-logo").value = s.logoUrl || "";
  }catch(err){ toast("Unable to load settings.", "error"); }
}
$("#btn-save-settings").addEventListener("click", async ()=>{
  try{
    await update(ref(db, "settings"), {
      siteName: $("#set-name").value.trim(),
      tagline: $("#set-tagline").value.trim(),
      logoUrl: $("#set-logo").value.trim()
    });
    toast("Settings saved.", "success");
  }catch(err){ toast("Save failed. Check your permissions.", "error"); }
});

/* ===================== ANALYTICS ===================== */
$("#btn-refresh-analytics").addEventListener("click", loadAnalytics);
async function loadAnalytics(){
  const listEl = $("#analytics-list");
  listEl.innerHTML = `<div class="empty-note">Loading...</div>`;
  try{
    const snap = await get(query(ref(db, "analytics"), orderByChild("timestamp"), limitToLast(200)));
    if(!snap.exists()){
      listEl.innerHTML = `<div class="empty-note">No download events logged yet.</div>`;
      $("#analytics-breakdown").innerHTML = "";
      return;
    }
    const entries = Object.entries(snap.val()).map(([id,v])=>({id,...v})).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
    const byType = {};
    entries.forEach(e=>{ const t = e.downloadType || "direct_apk"; byType[t] = (byType[t]||0) + 1; });
    const typeLabel = { play_store:"Google Play opens", google_drive:"Drive downloads", direct_apk:"APK downloads" };
    $("#analytics-breakdown").innerHTML = Object.keys(typeLabel).map(t=>`
      <div class="stat-card"><div class="n">${byType[t]||0}</div><div class="l">${typeLabel[t]}</div></div>
    `).join("") + `<div class="stat-card"><div class="n">${entries.length}</div><div class="l">Total events (last 200)</div></div>`;

    const appNameFor = (appId) => state.apps.find(a=>a.id===appId)?.name || appId;
    listEl.innerHTML = entries.slice(0,80).map(e=>{
      const date = e.timestamp ? new Date(e.timestamp).toLocaleString() : "";
      const typeBadge = { play_store:"Google Play", google_drive:"Google Drive", direct_apk:"Direct APK" }[e.downloadType || "direct_apk"];
      return `<div class="list-row">
        <div class="ic">${escapeHtml(appNameFor(e.appId).charAt(0).toUpperCase())}</div>
        <div class="info">
          <div class="n">${escapeHtml(appNameFor(e.appId))}</div>
          <div class="m"><span class="badge">${typeBadge}</span><span>${escapeHtml(date)}</span>${e.uid ? `<span>· ${escapeHtml(e.uid.slice(0,8))}…</span>` : `<span>· guest-blocked</span>`}</div>
        </div>
      </div>`;
    }).join("");
  }catch(err){
    listEl.innerHTML = `<div class="empty-note">Unable to load analytics. This usually means your database rules don't grant this admin read access to the "analytics" node yet.</div>`;
  }
}

/* ===================== ADMINS ===================== */
async function renderAdminsList(){
  const wrap = $("#admins-list");
  wrap.innerHTML = `<div class="empty-note">Loading...</div>`;
  try{
    const snap = await get(ref(db, "admins"));
    const val = snap.exists() ? snap.val() : {};
    const uids = Object.keys(val);
    state.admins = uids;
    wrap.innerHTML = uids.length ? uids.map(uid=>`
      <div class="list-row">
        <div class="ic">A</div>
        <div class="info"><div class="n" style="word-break:break-all;">${escapeHtml(uid)}</div><div class="m">${uid===state.user.uid ? "This is you" : "Admin"}</div></div>
        <div class="row-actions">
          ${uid!==state.user.uid ? `<button class="icon-btn danger" data-rm-admin="${escapeHtml(uid)}" aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 6 6 18M6 6l12 12"/></svg></button>` : ""}
        </div>
      </div>
    `).join("") : `<div class="empty-note">No admins listed yet.</div>`;
    $$("[data-rm-admin]", wrap).forEach(btn=> btn.addEventListener("click", async ()=>{
      if(!confirm("Remove this admin's access?")) return;
      try{ await remove(ref(db, `admins/${btn.dataset.rmAdmin}`)); toast("Admin removed.", "success"); renderAdminsList(); }
      catch(err){ toast("Failed to remove admin.", "error"); }
    }));
  }catch(err){
    wrap.innerHTML = `<div class="empty-note">Unable to load admins list. Check your database rules grant read access to "admins" for admins.</div>`;
  }
}
$("#btn-add-admin").addEventListener("click", async ()=>{
  const uid = $("#new-admin-uid").value.trim();
  if(!uid){ toast("Enter a UID first.", "error"); return; }
  try{
    await set(ref(db, `admins/${uid}`), true);
    $("#new-admin-uid").value = "";
    toast("Admin added.", "success");
    renderAdminsList();
  }catch(err){ toast("Failed to add admin. Check your permissions.", "error"); }
});

/* ===================== USERS ===================== */
async function loadUsersData(){
  const snap = await get(ref(db, "users"));
  const val = snap.exists() ? snap.val() : {};
  state.users = Object.entries(val).map(([uid, v])=>{
    const downloads = v && v.downloads ? Object.values(v.downloads) : [];
    const lastActivity = downloads.reduce((max, d)=> Math.max(max, d.timestamp||0), 0);
    return {
      uid,
      name: v && v.name ? v.name : "",
      email: v && v.email ? v.email : "",
      blocked: !!(v && v.blocked),
      photoURL: v && v.photoURL ? v.photoURL : "",
      downloadCount: downloads.length,
      lastActivity
    };
  }).sort((a,b)=> b.lastActivity - a.lastActivity);
}

function userRowHtml(u){
  const icon = u.photoURL
    ? `<img src="${escapeHtml(u.photoURL)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ic',textContent:'U'}))">`
    : `<div class="ic">${escapeHtml((u.name || "U").charAt(0).toUpperCase())}</div>`;
  const lastText = u.lastActivity ? new Date(u.lastActivity).toLocaleDateString() : "No downloads yet";
  const displayName = u.name || u.email || "Unnamed user";
  return `<div class="list-row">
    ${icon}
    <div class="info">
      <div class="n">${escapeHtml(displayName)}</div>
      <div class="m" style="word-break:break-all;">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="flex-shrink:0;"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5"/></svg>
        <span>${escapeHtml(u.uid)}</span>
      </div>
      <div class="m">
        <span>${u.downloadCount} app${u.downloadCount===1?"":"s"} downloaded</span>
        <span>· ${escapeHtml(lastText)}</span>
        <span class="badge ${u.blocked ? "off" : "on"}">${u.blocked ? "Blocked" : "Active"}</span>
      </div>
    </div>
    <div class="row-actions">
      <button class="btn ${u.blocked ? "btn-primary" : "btn-danger"} btn-sm" data-toggle-block="${escapeHtml(u.uid)}" data-blocked="${u.blocked?"1":"0"}">
        ${u.blocked
          ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.4-2"/></svg>'
          : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'}
        ${u.blocked ? "Unblock" : "Block"}
      </button>
    </div>
  </div>`;
}

function renderUsersListFromState(){
  const q = $("#users-search").value.trim().toLowerCase();
  const list = q ? state.users.filter(u=>
    u.uid.toLowerCase().includes(q) ||
    (u.name||"").toLowerCase().includes(q) ||
    (u.email||"").toLowerCase().includes(q)
  ) : state.users;
  const wrap = $("#users-list");
  wrap.innerHTML = list.length ? list.map(userRowHtml).join("") : `<div class="empty-note">No users found yet — this list fills in as people download apps or upload a profile photo.</div>`;
  $$("[data-toggle-block]", wrap).forEach(btn=> btn.addEventListener("click", async ()=>{
    const uid = btn.dataset.toggleBlock;
    const currentlyBlocked = btn.dataset.blocked === "1";
    const action = currentlyBlocked ? "unblock" : "block";
    if(!confirm(`${currentlyBlocked ? "Unblock" : "Block"} this user? ${currentlyBlocked ? "They will be able to download apps again." : "They will still be able to browse, but won't be able to download any app."}`)) return;
    try{
      await set(ref(db, `users/${uid}/blocked`), !currentlyBlocked);
      toast(currentlyBlocked ? "User unblocked." : "User blocked.", "success");
      await loadUsersData();
      renderUsersListFromState();
    }catch(err){
      toast("Failed to update this user. Check your database rules.", "error");
    }
  }));
}

async function renderUsersList(){
  const wrap = $("#users-list");
  wrap.innerHTML = `<div class="empty-note">Loading...</div>`;
  try{
    await loadUsersData();
    renderUsersListFromState();
  }catch(err){
    wrap.innerHTML = `<div class="empty-note">Unable to load users. Check your database rules grant admins read access to "users".</div>`;
  }
}
$("#users-search").addEventListener("input", renderUsersListFromState);
$("#btn-refresh-users").addEventListener("click", renderUsersList);