# Strona klasy – wersja na GitHub Pages

Strona leży na GitHubie, a Firebase służy tylko jako baza danych i logowanie.
Nie trzeba instalować Node.js ani niczego uruchamiać w terminalu.

## 1. Firebase – baza danych i logowanie (raz)

1. https://console.firebase.google.com → **Utwórz projekt**.
2. Ikona **`</>`** (aplikacja internetowa) → nadaj nazwę → **nie** zaznaczaj Hostingu.
   Skopiuj wartości z `firebaseConfig` – wkleisz je w kroku 2.
3. **Authentication → Rozpocznij → Metoda logowania → E-mail/hasło → Włącz.**
4. **Firestore Database → Utwórz bazę danych** → tryb produkcyjny → lokalizacja `europe-central2 (Warszawa)`.
5. Firestore Database → zakładka **Reguły** → usuń wszystko, wklej całą zawartość pliku
   `firestore.rules.txt` → **Opublikuj**.

## 2. GitHub – strona

1. Utwórz nowe repozytorium **publiczne** (np. `klasa`).
2. **Add file → Upload files** → przeciągnij **wszystkie pliki i foldery z tej paczki**
   (`index.html`, `css`, `js`, `data`, `.nojekyll`) → **Commit changes**.
3. W repozytorium otwórz `js/firebase-config.js` → ikona ołówka → wklej wartości z Firebase,
   ustaw `SITE_NAME` → **Commit changes**.
4. **Settings → Pages** → Source: **Deploy from a branch** → `main` i `/ (root)` → **Save**.
   Po 1–2 minutach strona działa pod `https://TWOJLOGIN.github.io/NAZWA-REPO/`.

## 3. Połącz jedno z drugim

Firebase → **Authentication → Ustawienia → Autoryzowane domeny → Dodaj domenę** →
wpisz `TWOJLOGIN.github.io`. Bez tego logowanie na stronie nie zadziała.

## 4. Konto administratora

Wejdź na stronę i **załóż swoje konto jako pierwsze** – zostaniesz administratorem.
Dopiero potem wyślij link klasie.

---

## Dodawanie pytań i gramatyki

Wszystko przez stronę GitHuba:
- **Nowy lub poprawiony temat z transportu:** wejdź w `data/transport` → **Add file → Upload files**
  → wrzuć plik → **Commit**. Jeśli to nowy temat, otwórz `data/transport/index.json` (ołówek)
  i dopisz nazwę pliku bez `.json`.
- **Gramatyka:** to samo w `data/angielski/grammar`, `data/angielski-zawodowy/grammar`
  albo `data/niemiecki/grammar` (plus wpis w tamtejszym `index.json`).
- **Fiszki** dodajesz na samej stronie (dział językowy → talia → „Edytuj słówka”).

Zmiany pojawiają się na stronie po 1–2 minutach. Jeśli nie widać ich od razu, odśwież
stronę z wyczyszczeniem pamięci podręcznej (Ctrl+Shift+R).

Postępy uczniów są przypięte do `id` pytań – nie zmieniaj identyfikatorów istniejących pytań.

## Bezpieczeństwo

Repozytorium jest publiczne, więc kod, pytania i `apiKey` są widoczne. To w porządku:
konta, wyniki i fiszki są w Firebase, a dostęp do nich chronią reguły z `firestore.rules.txt`
(niezalogowani nie widzą nic, uczeń widzi tylko swoje dane, fiszki zmienia tylko administrator).
