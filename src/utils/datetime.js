// Общие функции дат и времени.

export const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function dateKey(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export function showDate(iso) {
  if (!iso) return "";
  const [y, mo, d] = iso.split("-");
  return `${d}.${mo}.${y}`;
}

// Сетка месяца, недели начинаются с понедельника.
export function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const shift = (first.getDay() + 6) % 7;
  const daysIn = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < shift; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// "12:30" → минуты от полуночи; некорректное значение → NaN.
export function toMin(t) {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec((t || "").trim());
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : NaN;
}

// Маска времени --:-- — только цифры, двоеточие ставится само.
export function maskTime(v) {
  const d = (v || "").replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

export function validTime(t) {
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test((t || "").trim());
}

// «14» при уходе с поля → «14:00»; «1430» → «14:30».
export function normalizeTime(v) {
  const d = (v || "").replace(/\D/g, "");
  if (!d) return "";
  let hh = parseInt(d.slice(0, 2), 10);
  let mm = d.length > 2 ? parseInt(d.slice(2, 4).padEnd(2, "0"), 10) : 0;
  if (isNaN(hh)) return "";
  hh = Math.min(hh, 23);
  mm = Math.min(isNaN(mm) ? 0 : mm, 59);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
