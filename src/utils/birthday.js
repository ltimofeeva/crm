// Работа с датой рождения клиента. Хранится строкой «ДД.ММ.ГГГГ».

// Маска ввода: оставляем только цифры и расставляем точки (15031990 → 15.03.1990).
export function formatBirthDate(value) {
  const d = value.replace(/\D/g, "").slice(0, 8);
  let out = d.slice(0, 2);
  if (d.length >= 3) out += "." + d.slice(2, 4);
  if (d.length >= 5) out += "." + d.slice(4, 8);
  return out;
}

// Разбор «ДД.ММ.ГГГГ» (год можно не указывать). null — если это не дата.
export function parseBirthDate(str) {
  const m = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/.exec((str || "").trim());
  if (!m) return null;
  const day = +m[1], month = +m[2], year = m[3] ? +m[3] : null;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return { day, month, year };
}

// Ближайший день рождения: через сколько дней (0 — сегодня), сколько
// исполняется лет (если год известен) и дата словами («14 июля»).
export function birthdayStatus(str, today = new Date()) {
  const b = parseBirthDate(str);
  if (!b) return null;
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = new Date(t0.getFullYear(), b.month - 1, b.day);
  if (next < t0) next = new Date(t0.getFullYear() + 1, b.month - 1, b.day);
  const days = Math.round((next - t0) / 86400000);
  const turns = b.year ? next.getFullYear() - b.year : null;
  const dateLabel = next.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  return { days, turns, dateLabel };
}

// Текущий возраст по дате рождения (null, если год не указан).
export function currentAge(str, today = new Date()) {
  const b = parseBirthDate(str);
  if (!b || !b.year) return null;
  let age = today.getFullYear() - b.year;
  const passed =
    today.getMonth() + 1 > b.month ||
    (today.getMonth() + 1 === b.month && today.getDate() >= b.day);
  if (!passed) age -= 1;
  return age;
}

// Склонение: 31 год, 22 года, 35 лет.
export function yearsWord(n) {
  const d10 = n % 10, d100 = n % 100;
  if (d10 === 1 && d100 !== 11) return "год";
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return "года";
  return "лет";
}

// Приведение даты из Excel/CSV к «ДД.ММ.ГГГГ»: понимает 15.03.1990,
// 15/03/90, 1990-03-15 и числовые даты Excel (дни с 1900 года).
export function normalizeBirthDate(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (/^\d{4,6}$/.test(s)) {
    const n = parseInt(s, 10);
    if (n > 15000 && n < 80000) {
      const d = new Date(Math.round((n - 25569) * 86400000));
      const p = (x) => String(x).padStart(2, "0");
      return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
    }
    return "";
  }
  let m = /^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/.exec(s);
  if (m) {
    let y = m[3] || "";
    if (y.length === 2) y = (+y > new Date().getFullYear() % 100 ? "19" : "20") + y;
    return `${m[1].padStart(2, "0")}.${m[2].padStart(2, "0")}${y ? "." + y : ""}`;
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[3].padStart(2, "0")}.${m[2].padStart(2, "0")}.${m[1]}`;
  return "";
}
