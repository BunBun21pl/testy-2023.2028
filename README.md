# Strona klasy – instrukcja

Strona ma działy: **Start, Transport, Angielski, Angielski zawodowy, Niemiecki i Profil**.
Działa na darmowym planie Firebase (Spark): logowanie przez Firebase Authentication,
dane w bazie Cloud Firestore, a sama strona na Firebase Hosting.

- **Konta** zakłada się samemu (e-mail + hasło), bez potwierdzania adresu.
- **Pierwsze założone konto zostaje administratorem.** Administrator może potem nadać
  uprawnienia innym osobom w Profilu.
- **Testy z transportu i lekcje gramatyki** są w plikach JSON w folderze `public/data/`.
  Strona sama je wczytuje, więc nowe pytania dodaje się, podmieniając albo dodając pliki.
- **Fiszki** dodaje administrator bezpośrednio na stronie (są w bazie Firestore).
- **Postępy** (przerobione pytania, błędy, opanowane słówka, wyniki) zapisują się na koncie,
  więc działają na telefonie i komputerze.

---

## 1. Utwórz projekt Firebase

1. Wejdź na https://console.firebase.google.com i kliknij **Utwórz projekt**
   (Google Analytics możesz wyłączyć).
2. W projekcie kliknij ikonę **`</>`** (Dodaj aplikację internetową), nadaj dowolną nazwę
   i **nie** zaznaczaj Hostingu w tym kroku.
3. Skopiuj pokazany obiekt `firebaseConfig` i wklej jego wartości do pliku
   **`public/js/firebase-config.js`**. Tam też ustaw `SITE_NAME` (np. „Klasa 3TL”).

## 2. Włącz logowanie e-mailem

**Authentication → Rozpocznij → Metoda logowania → E-mail/hasło → Włącz → Zapisz.**
Weryfikacja adresu e-mail nie jest wymagana – Firebase domyślnie jej nie wymusza.

## 3. Utwórz bazę danych

**Firestore Database → Utwórz bazę danych** → tryb **produkcyjny** → lokalizacja
najlepiej **europe-central2 (Warszawa)**. Reguły bezpieczeństwa wgrasz w kroku 4.

## 4. Wgraj stronę i reguły

Potrzebujesz Node.js (https://nodejs.org, wersja LTS). W terminalu, w folderze projektu:

```bash
npm install -g firebase-tools
firebase login
firebase use --add        # wybierz swój projekt, alias np. "default"
firebase deploy           # wgrywa stronę (Hosting) i reguły bazy (firestore.rules)
```

Po chwili strona będzie pod adresem `https://TWOJ-PROJEKT.web.app`.

## 5. Załóż konto administratora

**Zanim podasz link klasie**, wejdź na stronę i załóż swoje konto – pierwsze konto
zostaje administratorem (żółta plakietka „admin” przy nazwisku).

---

## Jak dodawać treści

### Pytania z transportu (dodaję ja)

Każdy temat to osobny plik w `public/data/transport/`, np. `morski.json`.
Kolejność tematów i lista plików są w `public/data/transport/index.json`.

Gdy dostaniesz ode mnie nowy albo uzupełniony plik:
1. wrzuć go do `public/data/transport/`,
2. jeśli to **nowy temat**, dopisz jego nazwę (bez `.json`) do `index.json`,
3. uruchom `firebase deploy --only hosting`.

Format pliku:

```json
{
  "id": "morski",
  "name": "Morski",
  "color": "#145a9c",
  "questions": [
    {
      "id": "m-001",
      "q": "Treść pytania",
      "correct": "Poprawna odpowiedź",
      "wrong": ["Zła odpowiedź 1", "Zła odpowiedź 2", "Zła odpowiedź 3"],
      "why": "Krótkie wyjaśnienie pokazywane po odpowiedzi"
    }
  ]
}
```

**Ważne:** `id` pytania musi być unikalne i nie powinno się zmieniać – na nim opierają się
zapisane postępy uczniów (przerobione pytania i błędy). Nowe pytania dostają nowe numery.
Kolejność odpowiedzi jest losowana przy każdym teście.

### Gramatyka (dodaję ja)

Lekcje są w `public/data/<dział>/grammar/`, gdzie `<dział>` to `angielski`,
`angielski-zawodowy` albo `niemiecki`. Lista lekcji jest w `index.json` w tym samym folderze.
Każda lekcja ma sekcje z opisem i przykładami oraz własny test (pytania w tym samym formacie
co w transporcie). W tekście działa prosty zapis: `**pogrubienie**`, `*kursywa*`,
linie zaczynające się od `- ` tworzą listę, pusta linia to nowy akapit.

Dodawanie: wrzuć plik lekcji, dopisz jej nazwę do `index.json`, `firebase deploy --only hosting`.

### Fiszki (dodajesz Ty na stronie)

Wejdź w dział językowy → **Fiszki** → wpisz nazwę i kliknij **Dodaj talię**. W talii wybierz
**Edytuj słówka**. Możesz dodawać po jednym albo wkleić wiele naraz – jedno w linii:

```
warehouse - magazyn
forklift; wózek widłowy
pallet	paleta          ← tabulator, np. wklejone z Excela
```

---

## Uprawnienia (co pilnuje baza)

Reguły z `firestore.rules`:
- niezalogowani nie widzą niczego,
- uczeń widzi i zmienia tylko swój profil, wyniki i postępy,
- talie fiszek czytają wszyscy zalogowani, zmieniać może tylko administrator,
- listę uczniów i ich wyniki widzi tylko administrator (Profil → panel administratora),
- administratora może dodać tylko inny administrator.

Klucz `apiKey` w `firebase-config.js` nie jest tajny – w Firebase dostęp do danych chronią
reguły bazy, a nie ten klucz.

## Testowanie na komputerze

Pliku `index.html` nie da się otworzyć podwójnym kliknięciem (przeglądarka blokuje wtedy
wczytywanie plików). Uruchom lokalny serwer:

```bash
firebase serve --only hosting
```

i wejdź na http://localhost:5000. Uwaga: lokalna wersja korzysta z prawdziwej bazy.

## Struktura projektu

```
firebase.json            konfiguracja Hostingu i reguł
firestore.rules          reguły bezpieczeństwa bazy
public/
  index.html
  css/style.css
  js/
    firebase-config.js   ← tu wklejasz konfigurację projektu
    firebase.js          połączenie z Firebase
    app.js               logowanie i nawigacja
    quiz.js              silnik testów (transport i gramatyka)
    ui.js, state.js      pomocniki i ustawienia działów
    pages/               poszczególne strony
  data/
    transport/           pytania z transportu (jeden plik = jeden temat)
    angielski/grammar/   lekcje gramatyki
    angielski-zawodowy/grammar/
    niemiecki/grammar/
```
