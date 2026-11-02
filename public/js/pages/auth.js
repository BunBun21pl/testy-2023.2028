import {
  auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail
} from "../firebase.js";
import { state } from "../state.js";
import { esc } from "../ui.js";
import { SITE_NAME } from "../firebase-config.js";

const MESSAGES = {
  "auth/invalid-email": "Ten adres e-mail jest niepoprawny.",
  "auth/email-already-in-use": "Konto z tym adresem już istnieje. Zaloguj się.",
  "auth/weak-password": "Hasło musi mieć co najmniej 6 znaków.",
  "auth/invalid-credential": "Zły e-mail albo hasło.",
  "auth/wrong-password": "Zły e-mail albo hasło.",
  "auth/user-not-found": "Nie ma konta z tym adresem.",
  "auth/too-many-requests": "Za dużo prób. Odczekaj chwilę i spróbuj ponownie.",
  "auth/network-request-failed": "Brak połączenia z internetem.",
  "auth/operation-not-allowed": "Logowanie e-mailem jest wyłączone. Włącz je w konsoli Firebase (Authentication → Sign-in method).",
  "auth/configuration-not-found": "Firebase Authentication nie jest skonfigurowane w tym projekcie."
};
const msg = e => MESSAGES[e.code] || "Nie udało się: " + (e.message || e.code);

export function renderAuth(view) {
  let mode = "login";

  function draw() {
    const reg = mode === "register";
    view.innerHTML = `
      <section class="auth">
        <div class="auth-head">
          <svg class="auth-route" viewBox="0 0 320 40" aria-hidden="true">
            <line x1="12" y1="20" x2="308" y2="20" />
            <circle cx="12" cy="20" r="7" style="fill:var(--c-transport)"/>
            <circle cx="110" cy="20" r="7" style="fill:var(--c-en)"/>
            <circle cx="210" cy="20" r="7" style="fill:var(--c-enpro)"/>
            <circle cx="308" cy="20" r="7" style="fill:var(--c-de)"/>
          </svg>
          <h1>${esc(SITE_NAME)}</h1>
          <p>Testy z transportu, fiszki i gramatyka z angielskiego i niemieckiego – w jednym miejscu dla całej klasy.</p>
        </div>
        <div class="auth-tabs" role="tablist">
          <button role="tab" aria-selected="${!reg}" data-mode="login">Logowanie</button>
          <button role="tab" aria-selected="${reg}" data-mode="register">Nowe konto</button>
        </div>
        <form class="form" id="auth-form" novalidate>
          ${reg ? `<label>Imię i nazwisko (widoczne w klasie)
            <input name="name" autocomplete="name" required maxlength="60" minlength="2"></label>` : ""}
          <label>E-mail
            <input name="email" type="email" autocomplete="email" required></label>
          <label>Hasło
            <input name="password" type="password" autocomplete="${reg ? "new-password" : "current-password"}" required minlength="6"></label>
          <p class="form-error" id="err" role="alert"></p>
          <button class="btn" type="submit">${reg ? "Załóż konto" : "Zaloguj się"}</button>
          ${reg ? `<p class="hint">Nie musisz potwierdzać adresu e-mail. Hasło: co najmniej 6 znaków.</p>`
                : `<button class="link-btn" type="button" id="reset">Nie pamiętam hasła</button>`}
        </form>
      </section>`;

    view.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { mode = b.dataset.mode; draw(); });
    const form = view.querySelector("#auth-form");
    const err = view.querySelector("#err");

    form.onsubmit = async ev => {
      ev.preventDefault();
      err.textContent = "";
      const data = Object.fromEntries(new FormData(form));
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        if (reg) {
          const name = (data.name || "").trim();
          if (name.length < 2) throw { code: "x", message: "Wpisz imię i nazwisko (min. 2 znaki)." };
          state.pendingName = name;
          const cred = await createUserWithEmailAndPassword(auth, data.email.trim(), data.password);
          await updateProfile(cred.user, { displayName: name });
        } else {
          await signInWithEmailAndPassword(auth, data.email.trim(), data.password);
        }
      } catch (e) {
        err.textContent = e.code === "x" ? e.message : msg(e);
        btn.disabled = false;
      }
    };

    const reset = view.querySelector("#reset");
    if (reset) reset.onclick = async () => {
      const email = form.email.value.trim();
      if (!email) { err.textContent = "Wpisz e-mail, a potem kliknij „Nie pamiętam hasła”."; return; }
      try {
        await sendPasswordResetEmail(auth, email);
        err.textContent = "";
        reset.textContent = "Wysłaliśmy link do zmiany hasła na " + email;
      } catch (e) { err.textContent = msg(e); }
    };
  }
  draw();
}
