// Онлайн-запись: расчёт свободных окошек и хранение броней.
//
// ── Почему брони лежат ОТДЕЛЬНО от остальных данных ──────────────────────
// Приложение синхронизируется «целым куском»: отправляет на сервер весь набор
// данных сразу. Если бы сервер дописывал бронь прямо туда, следующая отправка
// из приложения затёрла бы её — клиент увидел бы «вы записаны», а специалист
// записи не увидел бы вовсе.
// Поэтому брони складываются в собственный файл. Приложение при открытии
// забирает новые брони, превращает их в обычные записи календаря и сообщает
// серверу «принято» — после этого бронь помечается как перенесённая.
// ─────────────────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { getData } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOOKINGS_DIR = path.join(__dirname, "data", "bookings");
fs.mkdirSync(BOOKINGS_DIR, { recursive: true });

const file = (userId) => path.join(BOOKINGS_DIR, `${userId}.json`);

function readBookings(userId) {
  const f = file(userId);
  if (!fs.existsSync(f)) return [];
  try { return JSON.parse(fs.readFileSync(f, "utf8")); }
  catch (e) { return []; }
}

function writeBookings(userId, list) {
  fs.writeFileSync(file(userId), JSON.stringify(list));
}

// ---------- Время ----------

const p2 = (n) => String(n).padStart(2, "0");

export function toMin(t) {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(String(t || "").trim());
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : NaN;
}

export function fromMin(m) {
  return `${p2(Math.floor(m / 60))}:${p2(m % 60)}`;
}

function dateKey(d) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

function addDaysIso(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

// ---------- Настройки онлайн-записи ----------

export const BOOKING_DEFAULTS = {
  enabled: false,
  stepMin: 60,        // шаг сетки окошек
  bufferMin: 0,       // перерыв между встречами
  minLeadHours: 3,    // нельзя записаться позже чем за N часов до начала
  maxDaysAhead: 30,   // на сколько дней вперёд открыт календарь
  tz: "",             // часовой пояс специалиста (только для подписи)
  note: "",           // произвольная подсказка клиенту
};

export function bookingSettings(data) {
  return { ...BOOKING_DEFAULTS, ...(data?.booking || {}) };
}

// Услуги, доступные для онлайн-записи.
export function onlineProducts(data) {
  return (data?.products || [])
    .filter((p) => p.online && Number(p.durationMin) > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      durationMin: Number(p.durationMin),
      price: Number(p.price) || 0,
      description: p.about || "",
    }));
}

// ---------- Занятое время ----------

// Все занятые промежутки на дату: записи, свои дела и ещё не перенесённые
// в приложение брони. Возвращает [{ from, to }] в минутах от полуночи.
function busyIntervals(data, bookings, iso) {
  const out = [];
  for (const e of data?.events || []) {
    if (e.date !== iso) continue;
    const s = toMin(e.time);
    if (!Number.isFinite(s)) continue;
    out.push({ from: s, to: s + (Number(e.durationMin) || 50) });
  }
  for (const b of data?.blocks || []) {
    if (b.date !== iso) continue;
    const s = toMin(b.start); const e = toMin(b.end);
    if (Number.isFinite(s) && Number.isFinite(e) && e > s) out.push({ from: s, to: e });
  }
  // Брони, которые приложение ещё не забрало. После переноса они уже есть
  // среди events, поэтому здесь учитываются только «свежие» — двойного счёта нет.
  for (const b of bookings) {
    if (b.date !== iso || b.importedAt || b.canceledAt) continue;
    const s = toMin(b.time);
    if (!Number.isFinite(s)) continue;
    out.push({ from: s, to: s + (Number(b.durationMin) || 50) });
  }
  return out;
}

function isWorkday(schedule, iso) {
  if (!schedule) return false;
  const inPeriod = (!schedule.from || iso >= schedule.from) && (!schedule.to || iso <= schedule.to);
  if (!inPeriod) return false;
  return !!schedule.days?.[new Date(iso + "T00:00:00").getDay()];
}

// Свободные окошки под конкретную услугу.
// Возвращает [{ date, slots: ["10:00", ...] }] — только даты, где что-то есть.
export function freeSlots(userId, productId, now = new Date()) {
  const data = getData(userId);
  const settings = bookingSettings(data);
  if (!settings.enabled) return { error: "Онлайн-запись сейчас недоступна." };

  const product = onlineProducts(data).find((p) => String(p.id) === String(productId));
  if (!product) return { error: "Услуга недоступна для онлайн-записи." };

  const schedule = data?.schedule;
  const workStart = toMin(schedule?.start);
  const workEnd = toMin(schedule?.end);
  if (!Number.isFinite(workStart) || !Number.isFinite(workEnd) || workEnd <= workStart) {
    return { error: "У специалиста не заполнен рабочий график." };
  }

  const bookings = readBookings(userId);
  const step = Math.max(5, Number(settings.stepMin) || 60);
  const buffer = Math.max(0, Number(settings.bufferMin) || 0);
  const dur = product.durationMin;
  const todayIso = dateKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const earliest = nowMin + (Number(settings.minLeadHours) || 0) * 60;
  const horizon = Math.max(1, Number(settings.maxDaysAhead) || 30);

  const days = [];
  for (let i = 0; i <= horizon; i++) {
    const iso = addDaysIso(todayIso, i);
    if (!isWorkday(schedule, iso)) continue;

    const busy = busyIntervals(data, bookings, iso);
    const slots = [];
    for (let t = workStart; t + dur <= workEnd; t += step) {
      // Слишком близко к текущему моменту — не предлагаем.
      if (iso === todayIso && t < earliest) continue;
      // Перерыв учитывается с обеих сторон: между встречами должно
      // оставаться не меньше bufferMin минут.
      const conflict = busy.some((b) => t < b.to + buffer && b.from < t + dur + buffer);
      if (!conflict) slots.push(fromMin(t));
    }
    if (slots.length) days.push({ date: iso, slots });
  }
  return { product, settings, days };
}

// ---------- Создание брони ----------

// Пишется синхронно, без await между проверкой и записью: иначе два клиента,
// нажавшие «записаться» одновременно, могли бы занять одно и то же окно.
export function createBooking(userId, { productId, date, time, name, contact, contactVia }) {
  const clean = (v, max) => String(v || "").trim().slice(0, max);
  const who = clean(name, 80);
  const how = clean(contact, 80);
  if (who.length < 2) return { error: "Укажите, как вас зовут." };
  if (how.length < 5) return { error: "Укажите телефон или ник в мессенджере." };

  const data = getData(userId);
  const settings = bookingSettings(data);
  if (!settings.enabled) return { error: "Онлайн-запись сейчас недоступна." };
  const product = onlineProducts(data).find((p) => String(p.id) === String(productId));
  if (!product) return { error: "Услуга недоступна для онлайн-записи." };

  // Проверяем, что выбранное время действительно свободно ПРЯМО СЕЙЧАС.
  const avail = freeSlots(userId, productId);
  if (avail.error) return { error: avail.error };
  const day = avail.days.find((d) => d.date === date);
  if (!day || !day.slots.includes(time)) {
    return { error: "Это время уже заняли. Выберите, пожалуйста, другое." };
  }

  const list = readBookings(userId);
  const booking = {
    id: "bk_" + crypto.randomBytes(6).toString("hex"),
    date,
    time,
    durationMin: product.durationMin,
    productId: product.id,
    productName: product.name,
    price: product.price,
    clientName: who,
    clientContact: how,
    contactVia: clean(contactVia, 30),
    createdAt: Date.now(),
    importedAt: null,
    canceledAt: null,
  };
  list.push(booking);
  writeBookings(userId, list);
  return { ok: true, booking };
}

// ---------- Обмен с приложением ----------

// Брони, которые приложение ещё не забрало.
export function pendingBookings(userId) {
  return readBookings(userId).filter((b) => !b.importedAt && !b.canceledAt);
}

// Пометить брони как перенесённые в календарь приложения.
export function ackBookings(userId, ids) {
  const set = new Set(ids || []);
  const list = readBookings(userId);
  let changed = 0;
  for (const b of list) {
    if (set.has(b.id) && !b.importedAt) { b.importedAt = Date.now(); changed++; }
  }
  if (changed) writeBookings(userId, list);
  return { ok: true, acked: changed };
}
