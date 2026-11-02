import {
  auth, db, onAuthStateChanged, signOut, doc, getDoc, setDoc, runTransaction, serverTimestamp
} from "./firebase.js";
import { state, SECTIONS, LANGS } from "./state.js";
import { esc, errorBox } from "./ui.js";
import { SITE_NAME } from "./firebase-config.js";
import { renderAuth } from "./pages/auth.js";
import { renderHome } from "./pages/home.js";
import { renderProfile } from "./pages/profile.js";
import { renderTransport } from "./pages/transport.js";
import { renderLanguage } from "./pages/language.js";

const view = document.getElementById("view");
const header = document.getElementById("site-header");
document.title = SITE_NAME;

// Pierwsza osoba z kontem zostaje administratorem.
async function claimAdminIfFirst(uid) {
  const ref = doc(db, "config", "admins");
  try {
    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) tx.set(ref, { uids: [uid], createdAt: serverTimestamp() });
    });
  } catch (e) {
    console.warn("Nie udało się sprawdzić administratora:", e);
  }
}

async function ensureProfile(user) {
  const ref = doc(db, "users", user.uid);
  let snap = await getDoc(ref);
  if (!snap.exists()) {
    const name = (user.displayName || state.pendingName || user.email.split("@")[0]).slice(0, 60).padEnd(2, ".");
    await setDoc(ref, {
      displayName: name,
      email: user.email,
      createdAt: serverTimestamp(),
      stats: { tests: 0, answered: 0, correct: 0 }
    });
    snap = await getDoc(ref);
  }
  await claimAdminIfFirst(user.uid);
  const admins = await getDoc(doc(db, "config", "admins"));
  state.profile = { id: user.uid, ...snap.data() };
  state.isAdmin = admins.exists() && (admins.data().uids || []).includes(user.uid);
}

export async function refreshProfile() {
  const snap = await getDoc(doc(db, "users", state.user.uid));
  state.profile = { id: state.user.uid, ...snap.data() };
  renderHeader(currentKey());
}

function currentParts() {
  return location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
}
function currentKey() {
  return currentParts()[0] || "";
}

function renderHeader(activeKey) {
  if (!state.user) { header.innerHTML = ""; header.hidden = true; return; }
  header.hidden = false;
  const stops = SECTIONS.map(s => `
    <a class="stop${s.key === activeKey ? " is-active" : ""}" href="${s.path}" style="--stop:${s.color}"
       ${s.key === activeKey ? 'aria-current="page"' : ""}>
      <span class="stop-dot"></span><span class="stop-label">${esc(s.label)}</span>
    </a>`).join("");
  header.innerHTML = `
    <div class="bar">
      <a class="brand" href="#/">${esc(SITE_NAME)}</a>
      <div class="who">
        ${state.isAdmin ? '<span class="badge-admin" title="Masz uprawnienia administratora">admin</span>' : ""}
        <a href="#/profil" class="who-name">${esc(state.profile?.displayName || "")}</a>
        <button class="link-btn" id="logout">Wyloguj</button>
      </div>
    </div>
    <nav class="line" aria-label="Działy">${stops}</nav>`;
  header.querySelector("#logout").onclick = () => signOut(auth);
  const active = header.querySelector(".stop.is-active");
  if (active) active.scrollIntoView({ block: "nearest", inline: "center" });
}

async function route() {
  if (!state.user) return;
  const parts = currentParts();
  const key = parts[0] || "";
  renderHeader(key);
  view.innerHTML = '<div class="loading">Wczytywanie…</div>';
  window.scrollTo(0, 0);
  try {
    if (key === "") await renderHome(view);
    else if (key === "profil") await renderProfile(view);
    else if (key === "transport") await renderTransport(view, parts.slice(1));
    else if (LANGS[key]) await renderLanguage(view, key, parts.slice(1));
    else view.innerHTML = `<section class="page"><h1>Nie ma takiej strony</h1><p><a href="#/">Wróć na stronę główną</a></p></section>`;
  } catch (e) {
    console.error(e);
    view.innerHTML = `<section class="page">${errorBox("Coś poszło nie tak: " + e.message)}</section>`;
  }
}

window.addEventListener("hashchange", route);

onAuthStateChanged(auth, async user => {
  state.user = user;
  if (!user) {
    state.profile = null;
    state.isAdmin = false;
    renderHeader("");
    renderAuth(view);
    return;
  }
  view.innerHTML = '<div class="loading">Wczytywanie konta…</div>';
  try {
    await ensureProfile(user);
  } catch (e) {
    console.error(e);
    view.innerHTML = `<section class="page">${errorBox("Nie udało się wczytać profilu. Sprawdź konfigurację Firebase i reguły bazy. (" + e.message + ")")}</section>`;
    return;
  }
  route();
});
