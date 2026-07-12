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
  chats: "practice.chats.v1",
  blocks: "practice.blocks.v1",
  installedAt: "practice.installedAt.v1",
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
export async function addClient({ name, birthDate, request, format, phone, contactVia }) {
  const clients = await getClients();
  const client = {
    id: Date.now(),
    name: name.trim(),
    birthDate: (birthDate || "").toString().trim(),
    request: (request || "").trim(),
    format: (format || "").trim() || "Онлайн",
    phone: (phone || "").trim(),
    contactVia: (contactVia || "").trim(),
    status: "Активный",
    since: new Date().toLocaleDateString("ru-RU", { month: "short", year: "numeric" }),
    nextSession: "—",
    sessionsCount: 0,
    sessions: [],
  };
  await saveClients([client, ...clients]);
  return client;
}

// Удалить клиента вместе с его историей и журналом контактов.
export async function deleteClient(id) {
  const clients = await getClients();
  await saveClients(clients.filter((c) => c.id !== id));
}

// Обновить данные клиента (редактирование карточки).
export async function updateClient(id, patch) {
  const clients = await getClients();
  const next = clients.map((c) => (c.id === id ? { ...c, ...patch } : c));
  await saveClients(next);
  return next.find((c) => c.id === id) || null;
}

// Добавить заметку к сессии конкретного клиента и сохранить.
export async function addSessionNote(clientId, note) {
  const clients = await getClients();
  const next = clients.map((c) => {
    if (c.id !== clientId) return c;
    const sessions = c.sessions || [];
    const n = sessions.reduce((m, s) => Math.max(m, s.n || 0), 0) + 1;
    const entry = {
      n,
      date: new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }),
      note,
      mood: "→ Ровно",
    };
    const nextSessions = [entry, ...sessions];
    return { ...c, sessionsCount: nextSessions.length, sessions: nextSessions };
  });
  await saveClients(next);
  return next;
}

// Заметка/статус события переносится в историю сессий клиента.
// Повторное сохранение того же события обновляет запись, а не дублирует
// (связь — по eventId).
const STATUS_MOOD = {
  progress: "↑ Прогресс",
  stable: "→ Стабильно",
  regress: "↓ Регресс",
  none: "—",
};

// При переносе записи (старое событие удаляется, создаётся новое)
// перевешиваем запись в истории клиента на новое событие и обновляем дату.
export async function relinkClientHistoryEvent(clientId, oldEventId, event) {
  const clients = await getClients();
  const next = clients.map((c) => {
    if (c.id !== clientId) return c;
    const sessions = (c.sessions || []).map((s) => {
      if (s.eventId !== oldEventId) return s;
      const [y, m, d] = (event.date || "").split("-").map(Number);
      const dateStr = y
        ? new Date(y, m - 1, d).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })
        : s.date;
      return { ...s, eventId: event.id, date: dateStr };
    });
    return { ...c, sessions };
  });
  await saveClients(next);
}

export async function syncEventToClientHistory(event) {
  if (!event?.clientId) return;
  const clients = await getClients();
  const next = clients.map((c) => {
    if (c.id !== event.clientId) return c;
    const sessions = [...(c.sessions || [])];
    const idx = sessions.findIndex((s) => s.eventId === event.id);
    const [y, m, d] = (event.date || "").split("-").map(Number);
    const dateStr = y
      ? new Date(y, m - 1, d).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })
      : "";
    if (idx >= 0) {
      sessions[idx] = {
        ...sessions[idx],
        date: dateStr || sessions[idx].date,
        note: (event.note || "").trim() || sessions[idx].note,
        mood: STATUS_MOOD[event.status] || sessions[idx].mood,
      };
    } else {
      const n = sessions.reduce((mx, s) => Math.max(mx, s.n || 0), 0) + 1;
      sessions.unshift({
        n,
        date: dateStr,
        note: (event.note || "").trim(),
        mood: STATUS_MOOD[event.status] || "—",
        eventId: event.id,
      });
    }
    return { ...c, sessions, sessionsCount: sessions.length };
  });
  await saveClients(next);
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
  return read(KEYS.profile, {
    activity: "", approach: "", strengths: "", voice: "", workRules: "",
  });
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

// Обновить запись контента (например, текст/заметку к теме).
export async function updateContentItem(section, id, patch) {
  const content = await getContent();
  content[section] = content[section].map((i) => (i.id === id ? { ...i, ...patch } : i));
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
// { days: {0..6: bool}, start: "10:00", end: "19:00",
//   from: "ГГГГ-ММ-ДД" | "", to: "ГГГГ-ММ-ДД" | "" } (0 = воскресенье)
// from/to — период действия графика; пустые = бессрочно.

export async function getSchedule() {
  return read(KEYS.schedule, {
    days: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: false, 0: false },
    start: "10:00",
    end: "19:00",
    from: "",
    to: "",
  });
}

export async function saveSchedule(schedule) {
  await write(KEYS.schedule, schedule);
}

// ---------- Закрытое время (серые плашки в календаре) ----------
// Блок: { id, date: "ГГГГ-ММ-ДД", start: "12:00", end: "14:00", title: "Обед" }

export async function getBlocks() {
  return read(KEYS.blocks, []);
}

export async function addBlock({ date, start, end, title }) {
  const blocks = await getBlocks();
  const item = { id: Date.now(), date, start, end, title: (title || "").trim() };
  await write(KEYS.blocks, [...blocks, item]);
  return item;
}

export async function updateBlock(id, patch) {
  const blocks = await getBlocks();
  const next = blocks.map((b) => (b.id === id ? { ...b, ...patch } : b));
  await write(KEYS.blocks, next);
  return next.find((b) => b.id === id);
}

export async function deleteBlock(id) {
  const blocks = await getBlocks();
  await write(KEYS.blocks, blocks.filter((b) => b.id !== id));
}

// ---------- Напоминания (генерирует ИИ) ----------
// { items: [{client, segment, reason, action, done?, doneType?, doneNote?}],
//   updatedAt: timestamp }

export async function getReminders() {
  return read(KEYS.reminders, { items: [], updatedAt: 0 });
}

export async function saveReminders(items) {
  await write(KEYS.reminders, { items, updatedAt: Date.now() });
}

// Отметить напоминание выполненным (галочка «связалась»).
export async function markReminderDone(index, { type, note }) {
  const st = await getReminders();
  const items = [...(st.items || [])];
  if (items[index]) {
    items[index] = { ...items[index], done: true, doneType: type, doneNote: note };
  }
  await write(KEYS.reminders, { items, updatedAt: st.updatedAt || Date.now() });
  return items;
}

// ---------- Контакты с клиентом вне сессий (звонок/встреча/сообщение) ----------
// Хранятся у клиента: touches: [{id, date "ГГГГ-ММ-ДД", type, note, reason}].
// ИИ учитывает их, планируя следующие касания.

export async function addClientTouch(clientName, { type, note, reason }) {
  const clients = await getClients();
  const next = clients.map((c) => {
    if (c.name !== clientName) return c;
    const touch = {
      id: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      type,
      note: (note || "").trim(),
      reason: reason || "",
    };
    return { ...c, touches: [touch, ...(c.touches || [])].slice(0, 20) };
  });
  await saveClients(next);
}

// ---------- Диалоги с ассистентом ----------
// { activeId: id | null, list: [{ id, title, messages, updatedAt }] } — до 10 диалогов.

export async function getChatState() {
  return read(KEYS.chats, { activeId: null, list: [] });
}

export async function saveChatState(state) {
  const list = (state.list || [])
    .map((c) => ({ ...c, messages: (c.messages || []).slice(-60) }))
    .slice(0, 10);
  await write(KEYS.chats, { activeId: state.activeId ?? null, list });
}

// ---------- Дата первого запуска (для бесплатного периода) ----------

export async function getInstalledAt() {
  let ts = await read(KEYS.installedAt, null);
  if (!ts) {
    ts = Date.now();
    await write(KEYS.installedAt, ts);
  }
  return ts;
}

// ---------- Полная очистка (для отладки) ----------

export async function clearAllData() {
  await Promise.all(Object.values(KEYS).map((k) => AsyncStorage.removeItem(k)));
}
