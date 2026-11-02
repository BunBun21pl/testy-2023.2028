import {
  auth, db, doc, getDoc, getDocs, updateDoc, setDoc, collection, query, orderBy, limit,
  updateProfile, signOut, arrayUnion, arrayRemove, deleteDoc
} from "../firebase.js";
import { state } from "../state.js";
import { esc, toast, formatDate } from "../ui.js";
import { refreshProfile } from "../app.js";

export async function renderProfile(view) {
  const resultsSnap = await getDocs(query(collection(db, "users", state.user.uid, "results"), orderBy("at", "desc"), limit(15)));
  const results = resultsSnap.docs.map(d => d.data());
  const s = state.profile.stats || {};
  const accuracy = s.answered ? Math.round((s.correct || 0) / s.answered * 100) : 0;

  view.innerHTML = `
    <section class="page" style="--accent:var(--c-home)">
      <header class="page-head">
        <h1>${esc(state.profile.displayName)}</h1>
        <p>${esc(state.profile.email)}${state.isAdmin ? " – administrator" : ""}</p>
      </header>

      <dl class="stats">
        <div><dt>Rozwiązane testy</dt><dd>${s.tests || 0}</dd></div>
        <div><dt>Odpowiedzi</dt><dd>${s.answered || 0}</dd></div>
        <div><dt>Poprawnych</dt><dd>${accuracy}%</dd></div>
      </dl>

      <h2 class="sub">Ostatnie testy</h2>
      ${results.length ? `<ul class="results">${results.map(r => `
        <li><span class="r-title">${esc(r.title)}</span>
            <span class="r-score ${r.score / r.total >= 0.6 ? "ok" : "bad"}">${r.score}/${r.total}</span>
            <span class="r-date">${esc(formatDate(r.at))}</span></li>`).join("")}</ul>`
        : `<div class="empty">Nie masz jeszcze żadnych wyników. <a href="#/transport">Rozwiąż pierwszy test z transportu.</a></div>`}

      <h2 class="sub">Ustawienia</h2>
      <form class="inline-form" id="name-form">
        <label class="grow">Imię i nazwisko<input name="name" value="${esc(state.profile.displayName)}" required minlength="2" maxlength="60"></label>
        <button class="btn ghost" type="submit">Zapisz</button>
      </form>
      <div class="actions">
        <button class="btn ghost" id="reset-transport">Wyzeruj postęp w testach z transportu</button>
        <button class="btn ghost" id="logout">Wyloguj się</button>
      </div>

      ${state.isAdmin ? `<div id="admin"><div class="loading">Wczytywanie panelu administratora…</div></div>` : ""}
    </section>`;

  view.querySelector("#name-form").onsubmit = async ev => {
    ev.preventDefault();
    const name = ev.target.name.value.trim();
    if (name.length < 2) return;
    await updateDoc(doc(db, "users", state.user.uid), { displayName: name });
    await updateProfile(auth.currentUser, { displayName: name });
    await refreshProfile();
    toast("Zapisano.");
    renderProfile(view);
  };
  view.querySelector("#reset-transport").onclick = async () => {
    if (!confirm("Wyzerować listę przerobionych pytań i błędów w transporcie? Historia wyników zostanie.")) return;
    await setDoc(doc(db, "users", state.user.uid, "progress", "transport"), { used: [], wrong: [] });
    toast("Postęp wyzerowany.");
  };
  view.querySelector("#logout").onclick = () => signOut(auth);

  if (state.isAdmin) renderAdmin(view.querySelector("#admin"));
}

async function renderAdmin(box) {
  const [usersSnap, adminsSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDoc(doc(db, "config", "admins"))
  ]);
  const admins = new Set(adminsSnap.data()?.uids || []);
  const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || "", "pl"));

  box.innerHTML = `
    <h2 class="sub">Panel administratora – klasa (${users.length})</h2>
    <p class="hint">Fiszki dodajesz w działach językowych: wejdź w talię i wybierz „Edytuj słówka”.</p>
    <div class="table-wrap"><table class="users">
      <thead><tr><th>Uczeń</th><th>Testy</th><th>Poprawnych</th><th>Konto od</th><th>Admin</th><th></th></tr></thead>
      <tbody>${users.map(u => {
        const st = u.stats || {};
        const acc = st.answered ? Math.round((st.correct || 0) / st.answered * 100) + "%" : "–";
        const me = u.id === state.user.uid;
        return `<tr data-id="${esc(u.id)}">
          <td><strong>${esc(u.displayName)}</strong><br><small>${esc(u.email)}</small></td>
          <td>${st.tests || 0}</td><td>${acc}</td>
          <td><small>${esc(formatDate(u.createdAt))}</small></td>
          <td><input type="checkbox" data-act="admin" ${admins.has(u.id) ? "checked" : ""} ${me ? "disabled title=\"Nie możesz odebrać uprawnień sobie\"" : ""} aria-label="Administrator: ${esc(u.displayName)}"></td>
          <td>${me ? "" : `<button class="link-btn danger" data-act="del">Usuń profil</button>`}</td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>
    <p class="hint">„Usuń profil” kasuje dane ucznia z bazy. Samo konto logowania usuwa się w konsoli Firebase (Authentication → Users).</p>`;

  box.querySelectorAll('[data-act="admin"]').forEach(cb => cb.onchange = async () => {
    const uid = cb.closest("tr").dataset.id;
    try {
      await updateDoc(doc(db, "config", "admins"), { uids: cb.checked ? arrayUnion(uid) : arrayRemove(uid) });
      toast(cb.checked ? "Nadano uprawnienia administratora." : "Odebrano uprawnienia administratora.");
    } catch (e) { cb.checked = !cb.checked; toast("Nie udało się: " + e.message, "error"); }
  });
  box.querySelectorAll('[data-act="del"]').forEach(b => b.onclick = async () => {
    const tr = b.closest("tr");
    const name = tr.querySelector("strong").textContent;
    if (!confirm(`Usunąć profil ucznia ${name}? Wyniki i postępy znikną z listy.`)) return;
    try {
      await deleteDoc(doc(db, "users", tr.dataset.id));
      tr.remove();
      toast("Usunięto profil.");
    } catch (e) { toast("Nie udało się: " + e.message, "error"); }
  });
}
