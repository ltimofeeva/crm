// Локальное хранилище данных практики.
//
// ВАЖНО ПРО БЕЗОПАСНОСТЬ (читайте SECURITY.md):
// Данные о клиентах психолога — чувствительная категория (здоровье). Здесь для
// старта используется AsyncStorage — это НЕзашифрованное локальное хранилище.
// Для боевой версии заметки о клиентах должны храниться зашифрованными
// (SQLCipher / шифрование на устройстве) и/или на защищённом бэкенде с
// аутентификацией и согласием клиента. Весь доступ к данным идёт через этот
// модуль, поэтому заменить хранилище на зашифрованное можно в одном месте.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  clients: "practice.clients.v1",
  events: "practice.events.v1",
  products: "practice.products.v1",
  profile: "practice.profile.v1",
  content: "practice.content.v1",
  schedule: "practice.schedule.v1",
  reminders: "practice.reminders.v1",
};

async function read(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn("storage read error", key, e);
    return fallback;
  }
}

async function write(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("storage write error", key, e);
  }
}

// ---------- Клиенты ----------

export async function getClients() {
  return read(KEYS.clients, []);
}

export async function saveClients(clients) {
  await write(KEYS.clients, clients);
}

// Добавить нового клиента. Обязательное поле — только имя.
export async function addClient({ name, age, request, format, phone }) {
  const clients = await getClients();
  const client = {
    id: Date.now(),
    name: name.trim(),
    age: (age || "").toString().trim(),
    request: (request || "").trim(),
    format: (format || "").trim() || "Онлайн",
    phone: (phone || "").trim(),
    status: "Активный",
    since: new Date().toLocaleDateString("ru-RU", { month: "short", year: "numeric" }),
    nextSession: "—",
    sessionsCount: 0,
    sessions: [],
  };
  await saveClients([client, ...clients]);
  return client;
}

// Добавить заметку к сессии конкретного клиента и сохранить.
export async function addSessionNote(clientId, note) {
  const clients = await getClients();
  const next = clients.map((c) => {
    if (c.id !== clientId) return c;
    const n = (c.sessionsCount || 0) + 1;
    const entry = {
      n,
      date: new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }),
      note,
      mood: "→ Ровно",
    };
    return { ...c, sessionsCount: n, sessions: [entry, ...(c.sessions || [])] };
  });
  await saveClients(next);
  return next;
}

// ---------- События календаря ----------
// Событие: { id, date: "ГГГГ-ММ-ДД", time: "ЧЧ:ММ", durationMin, title,
//   clientId?, clientName?, productId?, productName?, type: "session"|"other",
//   note: "", status: "none"|"progress"|"stable"|"regress" }

export async function getEvents() {
  return read(KEYS.events, []);
}

export async function addEvent(event) {
  const events = await getEvents();
  const item = {
    id: Date.now(),
    type: "session",
    note: "",
    status: "none",
    durationMin: 50,
    ...event,
  };
  const next = [...events, item].sort((a, b) =>
    (a.date + a.time).localeCompare(b.date + b.time));
  await write(KEYS.events, next);
  return item;
}

export async function updateEvent(id, patch) {
  const events = await getEvents();
  const next = events.map((e) => (e.id === id ? { ...e, ...patch } : e));
  await write(KEYS.events, next);
  return next.find((e) => e.id === id);
}

export async function deleteEvent(id) {
  const events = await getEvents();
  await write(KEYS.events, events.filter((e) => e.id !== id));
}

// ---------- Продукты (услуги специалиста) ----------
// Продукт: { id, name, durationMin, price, about }

export async function getProducts() {
  return read(KEYS.products, []);
}

export async function addProduct({ name, durationMin, price, about }) {
  const products = await getProducts();
  const item = {
    id: Date.now(),
    name: (name || "").trim(),
    durationMin: parseInt(durationMin, 10) || 50,
    price: parseInt(price, 10) || 0,
    about: (about || "").trim(),
  };
  await write(KEYS.products, [...products, item]);
  return item;
}

export async function deleteProduct(id) {
  const products = await getProducts();
  await write(KEYS.products, products.filter((p) => p.id !== id));
}

// ---------- Профиль специалиста («О себе») ----------

export async function getProfile() {
  return read(KEYS.profile, { activity: "", approach: "", strengths: "" });
}

export async function saveProfile(profile) {
  await write(KEYS.profile, profile);
}

// ---------- Контент ----------
// { ideas: [...], drafts: [...], planned: [...] }, элемент: { id, title, extra }

export async function getContent() {
  return read(KEYS.content, { ideas: [], drafts: [], planned: [] });
}

export async function saveContent(content) {
  await write(KEYS.content, content);
}

export async function addContentItem(section, item) {
  const content = await getContent();
  content[section] = [{ id: Date.now() + Math.random(), ...item }, ...content[section]];
  await saveContent(content);
  return content;
}

export async function moveContentItem(from, to, id) {
  const content = await getContent();
  const item = content[from].find((i) => i.id === id);
  if (!item) return content;
  content[from] = content[from].filter((i) => i.id !== id);
  content[to] = [item, ...content[to]];
  await saveContent(content);
  return content;
}

export async function deleteContentItem(section, id) {
  const content = await getContent();
  content[section] = content[section].filter((i) => i.id !== id);
  await saveContent(content);
  return content;
}

// ---------- График работы ----------
// { days: {0..6: bool}, start: "10:00", end: "19:00" } (0 = воскресенье)

export async function getSchedule() {
  return read(KEYS.schedule, {
    days: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: false, 0: false },
    start: "10:00",
    end: "19:00",
  });
}

export async function saveSchedule(schedule) {
  await write(KEYS.schedule, schedule);
}

// ---------- Напоминания (генерирует ИИ) ----------
// { items: [{client, segment, reason, action}], updatedAt: timestamp }

export async function getReminders() {
  return read(KEYS.reminders, { items: [], updatedAt: 0 });
}

export async function saveReminders(items) {
  await write(KEYS.reminders, { items, updatedAt: Date.now() });
}

// ---------- Полная очистка (для отладки) ----------

export async function clearAllData() {
  await Promise.all(Object.values(KEYS).map((k) => AsyncStorage.removeItem(k)));
}
