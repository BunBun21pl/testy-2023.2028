// Drobne pomocniki do budowania interfejsu

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Bardzo prosty markdown do lekcji gramatyki: **pogrubienie**, *kursywa*,
// `kod`, listy zaczynające się od „- ”, puste linie = nowe akapity.
export function md(text) {
  const inline = s => esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
  const blocks = String(text ?? "").trim().split(/\n\s*\n/);
  return blocks.map(block => {
    // W jednym bloku mogą być zwykłe linie i lista – grupujemy je po kolei.
    let html = "", para = [], items = [];
    const flushPara = () => { if (para.length) html += "<p>" + para.map(inline).join("<br>") + "</p>"; para = []; };
    const flushList = () => { if (items.length) html += "<ul>" + items.map(i => "<li>" + inline(i) + "</li>").join("") + "</ul>"; items = []; };
    for (const line of block.split("\n")) {
      if (/^\s*-\s+/.test(line)) { flushPara(); items.push(line.replace(/^\s*-\s+/, "")); }
      else { flushList(); para.push(line); }
    }
    flushPara(); flushList();
    return html;
  }).join("");
}

export function plural(n, one, few, many) {
  if (n === 1) return one;
  const d = n % 10, t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
}

let toastTimer;
export function toast(message, kind = "info") {
  let box = document.getElementById("toast");
  if (!box) {
    box = el('<div id="toast" role="status" aria-live="polite"></div>');
    document.body.appendChild(box);
  }
  box.textContent = message;
  box.className = "show " + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.className = ""), 3200);
}

export async function fetchJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Nie udało się wczytać pliku ${path} (${res.status})`);
  return res.json();
}

export function formatDate(ts) {
  const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
  if (!d) return "";
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" }) + ", " +
    d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

export function errorBox(message) {
  return `<div class="notice error">${esc(message)}</div>`;
}
