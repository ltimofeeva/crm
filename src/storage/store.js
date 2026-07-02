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
import { SEED_CLIENTS } from "../data/seed";

const CLIENTS_KEY = "practice.clients.v1";

export async function getClients() {
  try {
    const raw = await AsyncStorage.getItem(CLIENTS_KEY);
    if (raw) return JSON.parse(raw);
    // Первый запуск — засеваем демо-данными.
    await AsyncStorage.setItem(CLIENTS_KEY, JSON.stringify(SEED_CLIENTS));
    return SEED_CLIENTS;
  } catch (e) {
    console.warn("getClients error", e);
    return SEED_CLIENTS;
  }
}

export async function saveClients(clients) {
  try {
    await AsyncStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
  } catch (e) {
    console.warn("saveClients error", e);
  }
}

// Добавить заметку к сессии конкретного клиента и сохранить.
export async function addSessionNote(clientId, note) {
  const clients = await getClients();
  const next = clients.map((c) => {
    if (c.id !== clientId) return c;
    const n = c.sessionsCount + 1;
    const entry = {
      n,
      date: new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }),
      note,
      mood: "→ Ровно",
    };
    return { ...c, sessionsCount: n, sessions: [entry, ...c.sessions] };
  });
  await saveClients(next);
  return next;
}

// Полный сброс к демо-данным (пункт в настройках / для отладки).
export async function resetToSeed() {
  await AsyncStorage.setItem(CLIENTS_KEY, JSON.stringify(SEED_CLIENTS));
  return SEED_CLIENTS;
}
