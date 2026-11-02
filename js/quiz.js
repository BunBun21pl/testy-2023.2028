import {
  db, doc, getDoc, setDoc, addDoc, updateDoc, collection, serverTimestamp, increment
} from "./firebase.js";
import { state } from "./state.js";
import { esc, shuffle, toast } from "./ui.js";

// Postęp jest przechowywany w users/{uid}/progress/{scope}:
//   used  – identyfikatory pytań, które już padły (żeby się nie powtarzały)
//   wrong – identyfikatory pytań z błędną odpowiedzią (do powtórki)

export async function loadProgress(scope) {
  const snap = await getDoc(doc(db, "users", state.user.uid, "progress", scope));
  const d = snap.exists() ? snap.data() : {};
  return { used: new Set(d.used || []), wrong: new Set(d.wrong || []) };
}

export async function saveProgress(scope, progress) {
  await setDoc(doc(db, "users", state.user.uid, "progress", scope), {
    used: [...progress.used],
    wrong: [...progress.wrong],
    updatedAt: serverTimestamp()
  });
}

// Wybiera pytania do testu. W trybie „wrong” bierze tylko pytania z błędami,
// w zwykłym – najpierw te, które jeszcze nie padły.
export function pickQuestions(pool, progress, perTest, mode) {
  let candidates;
  if (mode === "wrong") {
    candidates = pool.filter(q => progress.wrong.has(q.id));
  } else {
    candidates = pool.filter(q => !progress.used.has(q.id));
    if (candidates.length < perTest) {
      pool.forEach(q => progress.used.delete(q.id));
      candidates = pool.slice();
    }
  }
  return shuffle(candidates).slice(0, perTest).map(q => {
    const options = shuffle([q.correct, ...q.wrong]);
    return { ...q, options, correctIndex: options.indexOf(q.correct), answer: null };
  });
}

const LETTERS = "ABCDEFGH";

export function runQuiz(root, { items, scope, title, progress, onFinish, onExit }) {
  let i = 0;

  function track(current) {
    return `<div class="track" aria-hidden="true">${items.map((x, j) => {
      const cls = x.answer === null ? (j === current ? "now" : "") : (x.answer === x.correctIndex ? "ok" : "bad");
      return `<span class="${cls}"></span>`;
    }).join("")}</div>`;
  }

  function showQuestion() {
    const it = items[i];
    root.innerHTML = `
      <div class="quiz">
        <div class="quiz-top">
          <span>Pytanie ${i + 1} z ${items.length}</span>
          <button class="link-btn" id="quit">Przerwij test</button>
        </div>
        ${track(i)}
        ${it.topicName ? `<span class="tag" style="--tag:${esc(it.color || "var(--c-transport)")}">${esc(it.topicName)}</span>` : ""}
        <h2 class="quiz-q">${esc(it.q)}</h2>
        <div class="opts">
          ${it.options.map((o, j) => `
            <button class="opt" data-j="${j}"><span class="opt-key">${LETTERS[j]}</span><span>${esc(o)}</span></button>`).join("")}
        </div>
        <div id="after"></div>
      </div>`;
    root.querySelector("#quit").onclick = onExit;
    root.querySelectorAll(".opt").forEach(b => b.onclick = () => answer(+b.dataset.j));
  }

  async function answer(j) {
    const it = items[i];
    if (it.answer !== null) return;
    it.answer = j;
    const good = j === it.correctIndex;
    progress.used.add(it.id);
    if (good) progress.wrong.delete(it.id); else progress.wrong.add(it.id);
    saveProgress(scope, progress).catch(e => toast("Nie zapisano postępu: " + e.message, "error"));

    root.querySelectorAll(".opt").forEach((b, k) => {
      b.disabled = true;
      if (k === it.correctIndex) b.classList.add("ok");
      else if (k === j) b.classList.add("bad");
      else b.classList.add("dim");
    });
    root.querySelector(".track").outerHTML = track(-1);
    const last = i === items.length - 1;
    const after = root.querySelector("#after");
    after.innerHTML = `
      <div class="why ${good ? "is-ok" : "is-bad"}">
        <strong>${good ? "Dobrze!" : "Źle. Poprawna odpowiedź: " + esc(it.options[it.correctIndex])}</strong>
        ${it.why ? `<p>${esc(it.why)}</p>` : ""}
      </div>
      <button class="btn" id="next">${last ? "Zobacz wynik" : "Następne pytanie"}</button>`;
    const next = after.querySelector("#next");
    next.focus({ preventScroll: true });
    next.scrollIntoView({ block: "nearest", behavior: "smooth" });
    next.onclick = () => {
      if (last) finish();
      else { i++; window.scrollTo(0, 0); showQuestion(); }
    };
  }

  async function finish() {
    const total = items.length;
    const score = items.filter(x => x.answer === x.correctIndex).length;
    try {
      await addDoc(collection(db, "users", state.user.uid, "results"), {
        scope, title, score, total, at: serverTimestamp()
      });
      await updateDoc(doc(db, "users", state.user.uid), {
        "stats.tests": increment(1),
        "stats.answered": increment(total),
        "stats.correct": increment(score)
      });
    } catch (e) {
      toast("Nie zapisano wyniku: " + e.message, "error");
    }
    const ratio = score / total;
    const verdict = ratio === 1 ? "Bezbłędnie."
      : ratio >= 0.8 ? "Bardzo dobrze – prawie wszystko."
      : ratio >= 0.6 ? "Nieźle, przejrzyj błędy poniżej."
      : ratio >= 0.4 ? "Trzeba jeszcze powtórzyć."
      : "Wróć do materiału i spróbuj ponownie.";
    const bad = items.filter(x => x.answer !== x.correctIndex);
    root.innerHTML = `
      <div class="quiz result">
        <p class="score"><span>${score}</span> / ${total}</p>
        <p class="verdict">${verdict}</p>
        ${track(-1)}
        <div class="actions" id="result-actions"></div>
        ${bad.length ? `<h3>Twoje błędy</h3><div class="review">${bad.map(x => `
          <div class="review-item" style="--tag:${esc(x.color || "var(--c-transport)")}">
            <strong>${esc(x.q)}</strong>
            <p class="you">Twoja odpowiedź: ${esc(x.options[x.answer])}</p>
            <p class="good">Poprawnie: ${esc(x.options[x.correctIndex])}</p>
            ${x.why ? `<p>${esc(x.why)}</p>` : ""}
          </div>`).join("")}</div>` : ""}
      </div>`;
    window.scrollTo(0, 0);
    onFinish(root.querySelector("#result-actions"), { score, total });
  }

  showQuestion();
}
