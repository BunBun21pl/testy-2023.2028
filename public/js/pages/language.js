import {
  db, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, addDoc, query, where,
  serverTimestamp, increment, writeBatch
} from "../firebase.js";
import { state, LANGS } from "../state.js";
import { esc, md, shuffle, toast, fetchJSON, plural } from "../ui.js";
import { loadProgress, pickQuestions, runQuiz } from "../quiz.js";

// Trasy:
//   #/angielski                      → fiszki (lista talii)
//   #/angielski/gramatyka            → lista lekcji
//   #/angielski/fiszki/<idTalii>     → nauka / edycja talii
//   #/angielski/gramatyka/<idLekcji> → lekcja + test
export async function renderLanguage(view, key, parts) {
  const L = LANGS[key];
  const [tab, id] = parts;
  if (tab === "fiszki" && id) return renderDeck(view, key, L, id);
  if (tab === "gramatyka" && id) return renderLesson(view, key, L, id);

  const isGrammar = tab === "gramatyka";
  view.innerHTML = `
    <section class="page" style="--accent:${L.color}">
      <header class="page-head">
        <h1>${esc(L.title)}</h1>
        <p>${esc(L.intro)}</p>
      </header>
      <nav class="tabs" aria-label="Części działu">
        <a href="#/${key}" ${!isGrammar ? 'aria-current="page"' : ""}>Fiszki</a>
        <a href="#/${key}/gramatyka" ${isGrammar ? 'aria-current="page"' : ""}>Gramatyka</a>
      </nav>
      <div id="tab-body"><div class="loading">Wczytywanie…</div></div>
    </section>`;
  const body = view.querySelector("#tab-body");
  if (isGrammar) await renderGrammarList(body, key);
  else await renderDeckList(body, key, L);
}

/* ---------------- Fiszki: lista talii ---------------- */

async function renderDeckList(body, key, L) {
  const [decksSnap, mineSnap] = await Promise.all([
    getDocs(query(collection(db, "decks"), where("lang", "==", key))),
    getDocs(collection(db, "users", state.user.uid, "cards"))
  ]);
  const known = {};
  mineSnap.forEach(d => (known[d.id] = (d.data().known || []).length));
  const decks = decksSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  body.innerHTML = `
    ${state.isAdmin ? `
      <form class="inline-form" id="new-deck">
        <label class="grow">Nowa talia (np. „Unit 3 – Warehouse”)
          <input name="name" required maxlength="80" placeholder="Nazwa talii"></label>
        <button class="btn" type="submit">Dodaj talię</button>
      </form>` : ""}
    ${decks.length ? `<ul class="deck-list">${decks.map(d => {
      const total = d.cardCount || 0;
      const k = Math.min(known[d.id] || 0, total);
      return `<li><a class="deck" href="#/${key}/fiszki/${encodeURIComponent(d.id)}">
          <span class="deck-name">${esc(d.name)}</span>
          <span class="deck-meta">${total} ${plural(total, "słówko", "słówka", "słówek")}</span>
          <span class="meter-bar small" aria-label="Opanowane: ${k} z ${total}"><span style="width:${total ? Math.round(k / total * 100) : 0}%"></span></span>
          <span class="deck-meta">umiesz ${k}/${total}</span>
        </a></li>`;
    }).join("")}</ul>`
      : `<div class="empty">${state.isAdmin
        ? "Nie ma jeszcze żadnej talii. Dodaj pierwszą powyżej, a potem wpisz do niej słówka."
        : "Nie ma jeszcze fiszek w tym dziale. Pojawią się, gdy administrator je doda."}</div>`}`;

  const form = body.querySelector("#new-deck");
  if (form) form.onsubmit = async ev => {
    ev.preventDefault();
    const name = form.name.value.trim();
    if (!name) return;
    const ref = await addDoc(collection(db, "decks"), {
      name, lang: key, cardCount: 0, createdAt: serverTimestamp(), createdBy: state.user.uid
    });
    location.hash = `#/${key}/fiszki/${ref.id}`;
  };
}


/* ---------------- Fiszki: talia ---------------- */

async function renderDeck(view, key, L, deckId) {
  const deckRef = doc(db, "decks", deckId);
  const [deckSnap, cardsSnap, mineSnap] = await Promise.all([
    getDoc(deckRef),
    getDocs(collection(db, "decks", deckId, "cards")),
    getDoc(doc(db, "users", state.user.uid, "cards", deckId))
  ]);
  if (!deckSnap.exists()) {
    view.innerHTML = `<section class="page"><h1>Nie ma takiej talii</h1><p><a href="#/${key}">Wróć do fiszek</a></p></section>`;
    return;
  }
  const deck = { id: deckId, ...deckSnap.data() };
  let cards = cardsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
  const known = new Set(mineSnap.exists() ? mineSnap.data().known || [] : []);
  let mode = "learn";
  let reverse = false;
  let onlyUnknown = true;

  const saveKnown = () => setDoc(doc(db, "users", state.user.uid, "cards", deckId), {
    known: [...known].filter(id => cards.some(c => c.id === id)), updatedAt: serverTimestamp()
  }).catch(e => toast("Nie zapisano postępu: " + e.message, "error"));

  function frame(inner) {
    view.innerHTML = `
      <section class="page" style="--accent:${L.color}">
        <p class="crumb"><a href="#/${key}">← ${esc(L.title)}: fiszki</a></p>
        <header class="page-head">
          <h1>${esc(deck.name)}</h1>
          <p>${cards.length} ${plural(cards.length, "słówko", "słówka", "słówek")}, umiesz ${[...known].filter(id => cards.some(c => c.id === id)).length}</p>
        </header>
        ${state.isAdmin ? `<nav class="tabs">
          <button data-mode="learn" ${mode === "learn" ? 'aria-current="page"' : ""}>Ucz się</button>
          <button data-mode="edit" ${mode === "edit" ? 'aria-current="page"' : ""}>Edytuj słówka</button>
        </nav>` : ""}
        <div id="deck-body">${inner}</div>
      </section>`;
    view.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { mode = b.dataset.mode; draw(); });
    return view.querySelector("#deck-body");
  }

  function draw() { mode === "edit" && state.isAdmin ? drawEdit() : drawLearnSetup(); }

  /* --- nauka --- */
  function drawLearnSetup() {
    if (!cards.length) {
      frame(`<div class="empty">${state.isAdmin ? "Ta talia jest pusta. Przejdź do „Edytuj słówka”, żeby dodać słówka." : "Ta talia jest jeszcze pusta."}</div>`);
      return;
    }
    const unknownCount = cards.filter(c => !known.has(c.id)).length;
    const body = frame(`
      <div class="learn-setup">
        <label class="switch"><input type="checkbox" id="rev" ${reverse ? "checked" : ""}>
          <span>Odwróć kierunek – pokazuj najpierw polskie tłumaczenie</span></label>
        <label class="switch"><input type="checkbox" id="unk" ${onlyUnknown ? "checked" : ""}>
          <span>Tylko słówka, których jeszcze nie umiesz (${unknownCount})</span></label>
        <div class="actions">
          <button class="btn" id="start">Zacznij naukę</button>
          ${known.size ? `<button class="btn ghost" id="reset">Zacznij od nowa (wyzeruj „umiem”)</button>` : ""}
        </div>
      </div>`);
    body.querySelector("#rev").onchange = e => (reverse = e.target.checked);
    body.querySelector("#unk").onchange = e => (onlyUnknown = e.target.checked);
    body.querySelector("#start").onclick = startSession;
    const r = body.querySelector("#reset");
    if (r) r.onclick = async () => { known.clear(); await saveKnown(); draw(); };
  }

  function startSession() {
    let queue = shuffle(onlyUnknown ? cards.filter(c => !known.has(c.id)) : cards);
    if (!queue.length) queue = shuffle(cards);
    const total = queue.length;
    let doneCount = 0;

    function show() {
      if (!queue.length) {
        const body = frame(`<div class="empty done">
            <p><strong>Wszystkie słówka z tej rundy przerobione.</strong></p>
            <div class="actions"><button class="btn" id="again">Jeszcze raz</button>
            <a class="btn ghost" href="#/${key}">Wróć do listy talii</a></div></div>`);
        body.querySelector("#again").onclick = drawLearnSetup;
        return;
      }
      const c = queue[0];
      const front = reverse ? c.back : c.front;
      const back = reverse ? c.front : c.back;
      const body = frame(`
        <div class="flash-wrap">
          <p class="flash-count">${doneCount} z ${total} opanowanych w tej rundzie</p>
          <button class="flash" id="card" aria-live="polite">
            <span class="flash-side">${esc(front)}</span>
            <span class="flash-hint">Kliknij albo naciśnij spację, żeby odwrócić</span>
          </button>
          <div class="actions two" id="grade" hidden>
            <button class="btn ghost" id="no">Jeszcze nie umiem</button>
            <button class="btn" id="yes">Umiem</button>
          </div>
          <button class="link-btn" id="stop">Zakończ naukę</button>
        </div>`);
      const card = body.querySelector("#card");
      let flipped = false;
      const flip = () => {
        if (flipped) return;
        flipped = true;
        card.classList.add("is-flipped");
        card.innerHTML = `<span class="flash-front">${esc(front)}</span>
          <span class="flash-side">${esc(back)}</span>
          ${c.example ? `<span class="flash-example">${esc(c.example)}</span>` : ""}`;
        body.querySelector("#grade").hidden = false;
        body.querySelector("#yes").focus({ preventScroll: true });
      };
      card.onclick = flip;
      body.querySelector("#no").onclick = () => { queue.push(queue.shift()); known.delete(c.id); saveKnown(); show(); };
      body.querySelector("#yes").onclick = () => { queue.shift(); known.add(c.id); doneCount++; saveKnown(); show(); };
      body.querySelector("#stop").onclick = drawLearnSetup;
      document.onkeydown = e => {
        if (!document.body.contains(card)) { document.onkeydown = null; return; }
        if (e.code === "Space" && !flipped) { e.preventDefault(); flip(); }
      };
    }
    show();
  }

  /* --- edycja (administrator) --- */
  function drawEdit() {
    const body = frame(`
      <div class="admin-grid">
        <form class="form card-form" id="add-one">
          <h2 class="sub">Dodaj słówko</h2>
          <label>${esc(L.frontLabel)}<input name="front" required maxlength="200"></label>
          <label>Tłumaczenie po polsku<input name="back" required maxlength="200"></label>
          <label>Przykładowe zdanie (opcjonalnie)<input name="example" maxlength="300"></label>
          <button class="btn" type="submit">Dodaj słówko</button>
        </form>
        <form class="form card-form" id="add-many">
          <h2 class="sub">Dodaj wiele naraz</h2>
          <label>Jedno słówko w linii: <code>słówko - tłumaczenie</code> (działa też średnik albo tabulator, np. wklejone z Excela)
            <textarea name="bulk" rows="7" placeholder="warehouse - magazyn&#10;forklift - wózek widłowy&#10;pallet; paleta"></textarea></label>
          <button class="btn" type="submit">Dodaj wszystkie</button>
        </form>
      </div>
      <h2 class="sub">Słówka w talii (${cards.length})</h2>
      ${cards.length ? `<ul class="card-list">${cards.map(c => `
        <li data-id="${esc(c.id)}">
          <span class="cl-front">${esc(c.front)}</span>
          <span class="cl-back">${esc(c.back)}</span>
          <span class="cl-tools">
            <button class="link-btn" data-act="edit">Zmień</button>
            <button class="link-btn danger" data-act="del">Usuń</button>
          </span>
        </li>`).join("")}</ul>` : `<div class="empty">Talia jest pusta – dodaj pierwsze słówka powyżej.</div>`}
      <details class="danger-zone">
        <summary>Ustawienia talii</summary>
        <form class="inline-form" id="rename">
          <label class="grow">Nazwa talii<input name="name" value="${esc(deck.name)}" required maxlength="80"></label>
          <button class="btn ghost" type="submit">Zmień nazwę</button>
        </form>
        <button class="btn danger" id="del-deck">Usuń całą talię</button>
      </details>`);

    body.querySelector("#add-one").onsubmit = async ev => {
      ev.preventDefault();
      const f = ev.target;
      const card = { front: f.front.value.trim(), back: f.back.value.trim(), example: f.example.value.trim() };
      if (!card.front || !card.back) return;
      await addCards([card]);
      f.reset();
      f.front.focus();
    };

    body.querySelector("#add-many").onsubmit = async ev => {
      ev.preventDefault();
      const lines = ev.target.bulk.value.split("\n").map(l => l.trim()).filter(Boolean);
      const parsed = [], bad = [];
      for (const line of lines) {
        const m = line.split(/\t|\s*;\s*|\s+[-–—=]\s+/);
        if (m.length >= 2 && m[0].trim() && m[1].trim()) {
          parsed.push({ front: m[0].trim(), back: m.slice(1).join(", ").trim(), example: "" });
        } else bad.push(line);
      }
      if (!parsed.length) { toast("Nie rozpoznano żadnego słówka. Użyj formatu: słówko - tłumaczenie", "error"); return; }
      await addCards(parsed);
      if (bad.length) toast(`Dodano ${parsed.length}. Pominięto ${bad.length} linii bez tłumaczenia.`, "info");
    };

    body.querySelectorAll(".card-list li").forEach(li => {
      const id = li.dataset.id;
      li.querySelector('[data-act="del"]').onclick = async () => {
        if (!confirm("Usunąć to słówko?")) return;
        await deleteDoc(doc(db, "decks", deckId, "cards", id));
        await updateDoc(deckRef, { cardCount: increment(-1) });
        cards = cards.filter(c => c.id !== id);
        toast("Usunięto słówko.");
        drawEdit();
      };
      li.querySelector('[data-act="edit"]').onclick = () => {
        const c = cards.find(x => x.id === id);
        li.innerHTML = `<form class="edit-row">
          <input name="front" value="${esc(c.front)}" required maxlength="200" aria-label="${esc(L.frontLabel)}">
          <input name="back" value="${esc(c.back)}" required maxlength="200" aria-label="Tłumaczenie">
          <input name="example" value="${esc(c.example || "")}" maxlength="300" aria-label="Przykład" placeholder="Przykład (opcjonalnie)">
          <span class="cl-tools"><button class="btn small" type="submit">Zapisz</button>
          <button class="link-btn" type="button" data-act="cancel">Anuluj</button></span></form>`;
        const f = li.querySelector("form");
        f.querySelector('[data-act="cancel"]').onclick = drawEdit;
        f.onsubmit = async ev => {
          ev.preventDefault();
          const upd = { front: f.front.value.trim(), back: f.back.value.trim(), example: f.example.value.trim() };
          if (!upd.front || !upd.back) return;
          await updateDoc(doc(db, "decks", deckId, "cards", id), upd);
          Object.assign(c, upd);
          toast("Zapisano.");
          drawEdit();
        };
      };
    });

    body.querySelector("#rename").onsubmit = async ev => {
      ev.preventDefault();
      const name = ev.target.name.value.trim();
      if (!name) return;
      await updateDoc(deckRef, { name });
      deck.name = name;
      toast("Zmieniono nazwę talii.");
      drawEdit();
    };

    body.querySelector("#del-deck").onclick = async () => {
      if (!confirm(`Usunąć talię „${deck.name}” razem ze wszystkimi słówkami (${cards.length})? Tego nie da się cofnąć.`)) return;
      for (let i = 0; i < cards.length; i += 400) {
        const batch = writeBatch(db);
        cards.slice(i, i + 400).forEach(c => batch.delete(doc(db, "decks", deckId, "cards", c.id)));
        await batch.commit();
      }
      await deleteDoc(deckRef);
      toast("Usunięto talię.");
      location.hash = `#/${key}`;
    };
  }

  async function addCards(list) {
    for (let i = 0; i < list.length; i += 400) {
      const batch = writeBatch(db);
      list.slice(i, i + 400).forEach(c => {
        const ref = doc(collection(db, "decks", deckId, "cards"));
        const data = { front: c.front.slice(0, 200), back: c.back.slice(0, 200), example: (c.example || "").slice(0, 300), createdAt: serverTimestamp() };
        batch.set(ref, data);
        cards.push({ id: ref.id, ...data, createdAt: { seconds: Date.now() / 1000 } });
      });
      await batch.commit();
    }
    await updateDoc(deckRef, { cardCount: increment(list.length) });
    toast(`Dodano ${list.length} ${plural(list.length, "słówko", "słówka", "słówek")}.`);
    drawEdit();
  }

  draw();
}

/* ---------------- Gramatyka ---------------- */

async function loadLessons(key) {
  let index;
  try { index = await fetchJSON(`data/${key}/grammar/index.json`); }
  catch { return []; }
  return Promise.all((index.lessons || []).map(id => fetchJSON(`data/${key}/grammar/${id}.json`)));
}

async function renderGrammarList(body, key) {
  const lessons = await loadLessons(key);
  if (!lessons.length) {
    body.innerHTML = `<div class="empty">Nie ma jeszcze lekcji gramatyki w tym dziale.</div>`;
    return;
  }
  body.innerHTML = `<ul class="lesson-list">${lessons.map(l => `
    <li><a class="lesson" href="#/${key}/gramatyka/${encodeURIComponent(l.id)}">
      <span class="lesson-title">${esc(l.title)}</span>
      ${l.level ? `<span class="lesson-level">${esc(l.level)}</span>` : ""}
      <span class="lesson-sum">${esc(l.summary || "")}</span>
      <span class="lesson-meta">${(l.questions || []).length} pytań w teście</span>
    </a></li>`).join("")}</ul>`;
}

async function renderLesson(view, key, L, lessonId) {
  let lesson;
  try { lesson = await fetchJSON(`data/${key}/grammar/${lessonId}.json`); }
  catch {
    view.innerHTML = `<section class="page"><h1>Nie ma takiej lekcji</h1><p><a href="#/${key}/gramatyka">Wróć do listy lekcji</a></p></section>`;
    return;
  }
  const scope = `grammar-${key}-${lesson.id}`;
  const questions = (lesson.questions || []).map(q => ({ ...q, color: L.color }));

  function drawLesson() {
    view.innerHTML = `
      <section class="page lesson-page" style="--accent:${L.color}">
        <p class="crumb"><a href="#/${key}/gramatyka">← ${esc(L.title)}: gramatyka</a></p>
        <header class="page-head">
          <h1>${esc(lesson.title)}</h1>
          ${lesson.summary ? `<p>${esc(lesson.summary)}</p>` : ""}
        </header>
        ${(lesson.sections || []).map(s => `
          <article class="lesson-section">
            ${s.title ? `<h2>${esc(s.title)}</h2>` : ""}
            ${s.text ? `<div class="prose">${md(s.text)}</div>` : ""}
            ${s.examples?.length ? `<ul class="examples">${s.examples.map(e => `
              <li><span class="ex">${esc(e.text)}</span>${e.translation ? `<span class="tr">${esc(e.translation)}</span>` : ""}</li>`).join("")}</ul>` : ""}
          </article>`).join("")}
        ${questions.length ? `<div class="actions"><button class="btn" id="quiz">Sprawdź się – test (${Math.min(10, questions.length)} pytań)</button></div>` : ""}
      </section>`;
    const b = view.querySelector("#quiz");
    if (b) b.onclick = startQuiz;
  }

  async function startQuiz(mode = "normal") {
    const progress = await loadProgress(scope);
    const items = pickQuestions(questions, progress, Math.min(10, questions.length), mode);
    if (!items.length) return drawLesson();
    const box = view.querySelector(".page");
    runQuiz(box, {
      items, scope, progress, title: `${L.title}: ${lesson.title}`,
      onExit: drawLesson,
      onFinish(actions) {
        actions.innerHTML = `
          <button class="btn" id="again">Jeszcze jeden test</button>
          ${progress.wrong.size ? `<button class="btn ghost" id="wrong">Powtórz błędy (${progress.wrong.size})</button>` : ""}
          <button class="btn ghost" id="back">Wróć do lekcji</button>`;
        actions.querySelector("#again").onclick = () => startQuiz("normal");
        actions.querySelector("#back").onclick = drawLesson;
        const w = actions.querySelector("#wrong");
        if (w) w.onclick = () => startQuiz("wrong");
      }
    });
  }

  drawLesson();
}
