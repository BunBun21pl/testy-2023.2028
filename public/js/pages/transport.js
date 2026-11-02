import { esc, fetchJSON } from "../ui.js";
import { loadProgress, pickQuestions, runQuiz } from "../quiz.js";

const SCOPE = "transport";
const PER_TEST = 10;
let topicsCache = null;
let selected = null; // Set z id tematów

// Pytania są w plikach public/data/transport/*.json.
// Lista plików (i kolejność tematów) jest w public/data/transport/index.json.
export async function loadTransportTopics() {
  if (topicsCache) return topicsCache;
  const index = await fetchJSON("data/transport/index.json");
  topicsCache = await Promise.all(index.topics.map(id => fetchJSON(`data/transport/${id}.json`)));
  return topicsCache;
}

export async function renderTransport(view) {
  const topics = await loadTransportTopics();
  if (!selected) selected = new Set(topics.map(t => t.id));
  const progress = await loadProgress(SCOPE);
  const all = topics.flatMap(t => t.questions.map(q => ({ ...q, topicId: t.id, topicName: t.name, color: t.color })));

  function poolNow() { return all.filter(q => selected.has(q.topicId)); }

  function start(mode) {
    const items = pickQuestions(mode === "wrong" ? all : poolNow(), progress, PER_TEST, mode);
    if (!items.length) return home();
    const box = view.querySelector(".page");
    runQuiz(box, {
      items, scope: SCOPE, progress,
      title: mode === "wrong" ? "Transport – powtórka błędów" : "Transport – test",
      onExit: home,
      onFinish(actions) {
        actions.innerHTML = `
          <button class="btn" id="again">Nowy test – ${PER_TEST} losowych pytań</button>
          ${progress.wrong.size ? `<button class="btn ghost" id="wrong">Powtórz moje błędy (${progress.wrong.size})</button>` : ""}
          <button class="btn ghost" id="back">Wybierz tematy</button>`;
        actions.querySelector("#again").onclick = () => start("normal");
        actions.querySelector("#back").onclick = home;
        const w = actions.querySelector("#wrong");
        if (w) w.onclick = () => start("wrong");
      }
    });
  }

  function home() {
    const pool = poolNow();
    const done = pool.filter(q => progress.used.has(q.id)).length;
    const wrongCount = all.filter(q => progress.wrong.has(q.id)).length;
    view.innerHTML = `
      <section class="page" style="--accent:var(--c-transport)">
        <header class="page-head">
          <h1>Transport</h1>
          <p>${all.length} pytań ABCD w ${topics.length} tematach. Każdy test to ${PER_TEST} losowych pytań – nie powtarzają się, dopóki nie przejdziesz całej puli.</p>
        </header>
        <h2 class="sub">Tematy</h2>
        <div class="chips">
          ${topics.map(t => `
            <button class="chip" data-id="${esc(t.id)}" aria-pressed="${selected.has(t.id)}" style="--chip:${esc(t.color)}">
              <span class="chip-dot"></span>${esc(t.name)} <small>${t.questions.length}</small>
            </button>`).join("")}
        </div>
        <div class="chip-tools">
          <button class="link-btn" id="all">Zaznacz wszystkie</button>
          <button class="link-btn" id="none">Odznacz wszystkie</button>
        </div>
        <div class="actions">
          <button class="btn" id="go" ${pool.length ? "" : "disabled"}>Rozpocznij test – ${Math.min(PER_TEST, pool.length)} pytań</button>
          ${wrongCount ? `<button class="btn ghost" id="wrong">Powtórz moje błędy (${wrongCount})</button>` : ""}
        </div>
        <div class="meter">
          <div class="meter-bar"><span style="width:${pool.length ? Math.round(done / pool.length * 100) : 0}%"></span></div>
          <p>Przerobione z wybranych tematów: <strong>${done} z ${pool.length}</strong></p>
        </div>
      </section>`;
    view.querySelectorAll(".chip").forEach(b => b.onclick = () => {
      const id = b.dataset.id;
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      home();
    });
    view.querySelector("#all").onclick = () => { selected = new Set(topics.map(t => t.id)); home(); };
    view.querySelector("#none").onclick = () => { selected = new Set(); home(); };
    view.querySelector("#go").onclick = () => start("normal");
    const w = view.querySelector("#wrong");
    if (w) w.onclick = () => start("wrong");
  }

  home();
}
