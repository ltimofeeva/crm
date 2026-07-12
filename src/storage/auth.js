// Локальные аккаунты (регистрация/вход) — хранятся на устройстве.
//
// ВАЖНО ПРО БЕЗОПАСНОСТЬ: это MVP-уровень. Пароли хранятся не в открытом
// виде (солёный хеш), но это НЕ серверная аутентификация: данные не
// синхронизируются между устройствами и восстановление пароля здесь
// формальное. Для боевой версии аккаунты и подписку нужно вынести на
// сервер (см. SECURITY.md и приоритет №2 в CLAUDE.md).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { phoneDigits } from "../utils/phone";

const ACCOUNTS_KEY = "practice.accounts.v1";
const SESSION_KEY = "practice.session.v1";

// Простой солёный хеш пароля (без нативных крипто-модулей, чтобы не усложнять
// установку). Несколько раундов перемешивания. Не банковский уровень —
// достаточно, чтобы не хранить пароль открытым текстом на устройстве.
function hashPassword(password, salt) {
  const input = `${salt}|${password}|${salt}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x1234567;
  for (let round = 0; round < 5; round++) {
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i) + round;
      h1 = (h1 ^ c) >>> 0;
      h1 = (h1 * 0x01000193) >>> 0;
      h2 = ((h2 << 5) + h2 + c) >>> 0;
    }
  }
  return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0"));
}

function randomSalt() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// Логин может быть телефоном или почтой — приводим к сравнимому виду.
export function loginKey(login) {
  const s = String(login || "").trim();
  if (s.includes("@")) return { type: "email", key: normalizeEmail(s) };
  const digits = phoneDigits(s);
  if (digits) return { type: "phone", key: digits };
  return { type: "email", key: s.toLowerCase() };
}

export async function getAccounts() {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

async function saveAccounts(list) {
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

// Есть ли уже аккаунт с таким логином (телефон/почта).
export async function findAccount(login) {
  const { type, key } = loginKey(login);
  const accounts = await getAccounts();
  return accounts.find((a) => a.loginType === type && a.loginKey === key) || null;
}

// Регистрация. Возвращает { ok, error, account }.
export async function registerAccount({ login, password }) {
  const value = String(login || "").trim();
  const { type, key } = loginKey(value);
  if (!key) return { ok: false, error: "Укажите телефон или почту." };
  if (type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(key)) {
    return { ok: false, error: "Похоже, почта указана неверно." };
  }
  if (type === "phone" && key.length < 10) {
    return { ok: false, error: "Похоже, номер телефона указан не полностью." };
  }
  if ((password || "").length < 6) {
    return { ok: false, error: "Пароль должен быть не короче 6 символов." };
  }
  const existing = await findAccount(value);
  if (existing) return { ok: false, error: "Аккаунт с таким логином уже есть. Войдите." };

  const salt = randomSalt();
  const account = {
    id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    loginType: type,
    loginKey: key,
    display: type === "phone" ? value : key,
    email: type === "email" ? key : "",
    phone: type === "phone" ? value : "",
    salt,
    passHash: hashPassword(password, salt),
    createdAt: Date.now(),
  };
  const accounts = await getAccounts();
  await saveAccounts([...accounts, account]);
  return { ok: true, account };
}

// Вход. Возвращает { ok, error, account }.
export async function loginAccount({ login, password }) {
  const account = await findAccount(login);
  if (!account) return { ok: false, error: "Аккаунт не найден. Проверьте логин или зарегистрируйтесь." };
  if (account.passHash !== hashPassword(password, account.salt)) {
    return { ok: false, error: "Неверный пароль." };
  }
  return { ok: true, account };
}

// Сессия «запомнить меня»: сохранённый id аккаунта для автологина.
export async function saveSession(accountId) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ accountId }));
}

export async function getSession() {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export async function clearSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

// Публичное представление аккаунта (без соли и хеша).
export function publicAccount(a) {
  if (!a) return null;
  return { id: a.id, loginType: a.loginType, display: a.display, email: a.email, phone: a.phone };
}
