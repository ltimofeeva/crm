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

const CLIENTS_KEY = "practice.clients.v1";

export async function getClients() {
  try {
    const raw = await AsyncStorage.getItem(CLIENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("getClients error", e);
    return [];
  }
}

export async function saveClients(clients) {
  try {
    await AsyncStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
  } catch (e) {
    console.warn("saveClients error", e);
  }
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

// Полная очистка данных (для отладки).
export async function clearAllData() {
  await AsyncStorage.removeItem(CLIENTS_KEY);
}
