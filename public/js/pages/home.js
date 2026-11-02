import { db, collection, getDocs, query, orderBy, limit } from "../firebase.js";
import { state, LANGS } from "../state.js";
import { esc, fetchJSON, formatDate, plural } from "../ui.js";
import { loadTransportTopics } from "./transport.js";
import { loadProgress } from "../quiz.js";

async function lessonCount(key) {
  try { return ((await fetchJSON(`data/${key}/grammar/index.json`)).lessons || []).length; }
  catch { return 0; }
}

export async function renderHome(view) {
  const [topics, progress, decksSnap, lastSnap, ...lessons] = await Promise.all([
    loadTransportTopics(),
    loadProgress("transport"),
    getDocs(collection(db, "decks")),
    getDocs(query(collection(db, "users", state.user.uid, "results"), orderBy("at", "desc"), limit(1))),
    ...Object.keys(LANGS).map(lessonCount)
  ]);
  const totalQ = topics.reduce((n, t) => n + t.questions.length, 0);
  const doneQ = topics.reduce((n, t) => n + t.questions.filter(q => progress.used.has(q.id)).length, 0);
  const decks = {}, words = {};
  decksSnap.forEach(d => {
    const { lang, cardCount = 0 } = d.data();
    decks[lang] = (decks[lang] || 0) + 1;
    words[lang] = (words[lang] || 0) + cardCount;
  });
  const last = lastSnap.docs[0]?.data();
  const first = (state.profile.displayName || "").split(" ")[0];

  const langStops = Object.entries(LANGS).map(([key, L], i) => `
    <li class="map-stop" style="--stop:${L.color}">
      <a href="#/${key}">
        <span class="map-name">${esc(L.title)}</span>
        <span class="map-info">${words[key] || 0} ${plural(words[key] || 0, "słówko", "słówka", "słówek")} w ${decks[key] || 0} ${(decks[key] || 0) === 1 ? "talii" : "taliach"}, ${lessons[i]} ${plural(lessons[i], "lekcja", "lekcje", "lekcji")} gramatyki</span>
      </a>
    </li>`).join("");

  view.innerHTML = `
    <section class="page home">
      <header class="hello">
        <h1>Cześć, ${esc(first)}</h1>
        ${last ? `<p>Ostatni test: <strong>${esc(last.title)}</strong> – ${last.score}/${last.total} (${esc(formatDate(last.at))}).</p>`
               : `<p>Wybierz dział i zacznij od pierwszego testu albo fiszek.</p>`}
      </header>
      <ol class="map">
        <li class="map-stop" style="--stop:var(--c-transport)">
          <a href="#/transport">
            <span class="map-name">Transport</span>
            <span class="map-info">${totalQ} pytań w ${topics.length} tematach, przerobione ${doneQ}</span>
            <span class="meter-bar small"><span style="width:${totalQ ? Math.round(doneQ / totalQ * 100) : 0}%"></span></span>
          </a>
        </li>
        ${langStops}
        <li class="map-stop end" style="--stop:var(--c-home)">
          <a href="#/profil">
            <span class="map-name">Profil</span>
            <span class="map-info">Twoje wyniki, historia testów${state.isAdmin ? " i panel administratora" : ""}</span>
          </a>
        </li>
      </ol>
    </section>`;
}
