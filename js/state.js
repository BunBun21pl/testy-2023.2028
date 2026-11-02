// Wspólny stan aplikacji i stałe dla działów

export const state = {
  user: null,      // użytkownik Firebase Auth
  profile: null,   // dokument users/{uid}
  isAdmin: false
};

export const SECTIONS = [
  { key: "",                   path: "#/",                   label: "Start",        color: "var(--c-home)" },
  { key: "transport",          path: "#/transport",          label: "Transport",    color: "var(--c-transport)" },
  { key: "angielski",          path: "#/angielski",          label: "Angielski",    color: "var(--c-en)" },
  { key: "angielski-zawodowy", path: "#/angielski-zawodowy", label: "Angielski zawodowy", color: "var(--c-enpro)" },
  { key: "niemiecki",          path: "#/niemiecki",          label: "Niemiecki",    color: "var(--c-de)" },
  { key: "profil",             path: "#/profil",             label: "Profil",       color: "var(--c-home)" }
];

export const LANGS = {
  "angielski": {
    title: "Język angielski",
    color: "var(--c-en)",
    lang: "en",
    frontLabel: "Słówko po angielsku",
    intro: "Fiszki ze słówkami z lekcji i krótkie lekcje gramatyki z testem na koniec."
  },
  "angielski-zawodowy": {
    title: "Język angielski zawodowy",
    color: "var(--c-enpro)",
    lang: "en",
    frontLabel: "Termin po angielsku",
    intro: "Słownictwo z logistyki, spedycji i transportu oraz gramatyka potrzebna w pracy."
  },
  "niemiecki": {
    title: "Język niemiecki",
    color: "var(--c-de)",
    lang: "de",
    frontLabel: "Słówko po niemiecku",
    intro: "Fiszki ze słówkami z lekcji i krótkie lekcje gramatyki z testem na koniec."
  }
};
