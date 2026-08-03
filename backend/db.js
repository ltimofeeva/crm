// Серверное хранилище аккаунтов и данных пользователей.
// Хранится в файлах в папке backend/data (она не в git — это личные данные).
// Пароли — солёный scrypt-хеш (встроенный модуль crypto, без зависимостей).
//
// ВАЖНО: для боевой нагрузки лучше вынести в полноценную БД (PostgreSQL) и
// шифровать данные в покое (см. SECURITY.md). Для одного специалиста файловое
// хранилище надёжно и достаточно.

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { getPlan, TRIAL_DAYS } from "./plans.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const USERDATA_DIR = path.join(DATA_DIR, "users");

fs.mkdirSync(USERDATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [], tokens: {} }));
}

function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")); }
  catch (e) { return { users: [], tokens: {} }; }
}
function writeUsers(db) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(db));
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString("hex");
}

// Логин может быть телефоном или почтой — приводим к сравнимому виду.
export function loginKey(login) {
  const s = String(login || "").trim();
  if (s.includes("@")) return { type: "email", key: s.toLowerCase() };
  let d = s.replace(/\D/g, "");
  if (d.startsWith("7") || d.startsWith("8")) d = d.slice(1);
  if (d) return { type: "phone", key: d };
  return { type: "email", key: s.toLowerCase() };
}

function publicUser(u) {
  return { id: u.id, loginType: u.loginType, display: u.display, email: u.email, phone: u.phone };
}

export function register({ login, password }) {
  const value = String(login || "").trim();
  const { type, key } = loginKey(value);
  if (!key) return { error: "Укажите телефон или почту." };
  if (type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(key)) {
    return { error: "Похоже, почта указана неверно." };
  }
  if (type === "phone" && key.length < 10) {
    return { error: "Похоже, номер телефона указан не полностью." };
  }
  if (String(password || "").length < 6) {
    return { error: "Пароль должен быть не короче 6 символов." };
  }
  const db = readUsers();
  if (db.users.find((u) => u.loginType === type && u.loginKey === key)) {
    return { error: "Аккаунт с таким логином уже есть. Войдите." };
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const user = {
    id: "u_" + crypto.randomBytes(8).toString("hex"),
    loginType: type,
    loginKey: key,
    display: type === "phone" ? value : key,
    email: type === "email" ? key : "",
    phone: type === "phone" ? value : "",
    salt,
    passHash: hashPassword(password, salt),
    createdAt: Date.now(),
    plan: "free",
    planUntil: 0,
    // Пробный период на условиях «Помощника» — чтобы человек успел
    // попробовать ИИ до оплаты.
    trialUntil: Date.now() + TRIAL_DAYS * 86400000,
    usage: null,
  };
  db.users.push(user);
  const token = crypto.randomBytes(24).toString("hex");
  db.tokens[token] = user.id;
  writeUsers(db);
  return { token, user: publicUser(user) };
}

export function login({ login, password }) {
  const { type, key } = loginKey(login);
  const db = readUsers();
  const user = db.users.find((u) => u.loginType === type && u.loginKey === key);
  if (!user) return { error: "Аккаунт не найден. Проверьте логин или зарегистрируйтесь." };
  if (user.passHash !== hashPassword(password, user.salt)) {
    return { error: "Неверный пароль." };
  }
  const token = crypto.randomBytes(24).toString("hex");
  db.tokens[token] = user.id;
  writeUsers(db);
  return { token, user: publicUser(user) };
}

export function userIdByToken(token) {
  if (!token) return null;
  const db = readUsers();
  return db.tokens[token] || null;
}

export function revokeToken(token) {
  if (!token) return;
  const db = readUsers();
  if (db.tokens[token]) { delete db.tokens[token]; writeUsers(db); }
}

// ---- Данные пользователя (клиенты, заметки, продукты и т.д.) ----

export function getData(userId) {
  const f = path.join(USERDATA_DIR, `${userId}.json`);
  if (!fs.existsSync(f)) return {};
  try { return JSON.parse(fs.readFileSync(f, "utf8")); }
  catch (e) { return {}; }
}

export function setData(userId, data) {
  const f = path.join(USERDATA_DIR, `${userId}.json`);
  fs.writeFileSync(f, JSON.stringify(data || {}));
}

// ---- Ссылка на онлайн-запись ----

// Короткий адрес вида /z/ab12cd34. Выдаётся один раз и больше не меняется:
// специалист уже разослал ссылку клиентам, и она должна работать всегда.
export function ensureSlug(userId) {
  const db = readUsers();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return null;
  if (!user.slug) {
    let slug;
    do { slug = crypto.randomBytes(4).toString("hex"); }
    while (db.users.some((u) => u.slug === slug));
    user.slug = slug;
    writeUsers(db);
  }
  return user.slug;
}

export function userBySlug(slug) {
  if (!slug) return null;
  const db = readUsers();
  const u = db.users.find((x) => x.slug === String(slug).toLowerCase());
  return u ? { id: u.id, display: u.display } : null;
}

// ---- Тариф и расход ИИ ----

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Действующий тариф: оплаченный, иначе пробный период, иначе бесплатный.
// Возвращает { plan, source, trialDaysLeft, paidUntil }.
export function effectivePlan(user) {
  const now = Date.now();
  if (user?.plan && user.plan !== "free" && (user.planUntil || 0) > now) {
    return {
      plan: getPlan(user.plan),
      source: "paid",
      trialDaysLeft: 0,
      paidUntil: user.planUntil,
    };
  }
  if ((user?.trialUntil || 0) > now) {
    return {
      plan: getPlan("standard"),
      source: "trial",
      trialDaysLeft: Math.ceil((user.trialUntil - now) / 86400000),
      paidUntil: 0,
    };
  }
  return { plan: getPlan("free"), source: "free", trialDaysLeft: 0, paidUntil: 0 };
}

// Расход за текущий месяц. При смене месяца счётчики обнуляются.
export function getUsage(user) {
  const month = currentMonth();
  const u = user?.usage;
  if (!u || u.month !== month) {
    return { month, requests: 0, inputTokens: 0, outputTokens: 0 };
  }
  return {
    month,
    requests: u.requests || 0,
    inputTokens: u.inputTokens || 0,
    outputTokens: u.outputTokens || 0,
  };
}

function withUser(userId, fn) {
  const db = readUsers();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return null;
  const out = fn(user, db);
  writeUsers(db);
  return out;
}

// Сводка по подписке для приложения.
export function subscriptionFor(userId) {
  const db = readUsers();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return null;
  const { plan, source, trialDaysLeft, paidUntil } = effectivePlan(user);
  const usage = getUsage(user);
  const tokensUsed = usage.inputTokens + usage.outputTokens;
  return {
    planId: plan.id,
    planTitle: plan.title,
    source,
    trialDaysLeft,
    paidUntil,
    ai: plan.ai,
    limits: { requests: plan.requests, tokens: plan.tokens },
    used: { requests: usage.requests, tokens: tokensUsed },
    left: {
      requests: Math.max(0, plan.requests - usage.requests),
      tokens: Math.max(0, plan.tokens - tokensUsed),
    },
  };
}

// Можно ли сейчас обратиться к ИИ. Возвращает { ok } или { ok:false, reason, message }.
export function checkAiAllowed(userId) {
  const db = readUsers();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return { ok: false, reason: "no_user", message: "Аккаунт не найден." };
  const { plan } = effectivePlan(user);
  if (!plan.ai) {
    return {
      ok: false,
      reason: "no_plan",
      message: "ИИ-ассистент доступен в платных тарифах. Откройте «Подписка», чтобы подключить.",
    };
  }
  const usage = getUsage(user);
  if (usage.requests >= plan.requests) {
    return {
      ok: false,
      reason: "limit_requests",
      message: `Закончились запросы к ИИ в этом месяце (${plan.requests}). Лимит обновится 1-го числа, или перейдите на тариф побольше.`,
    };
  }
  if (usage.inputTokens + usage.outputTokens >= plan.tokens) {
    return {
      ok: false,
      reason: "limit_tokens",
      message: "Исчерпан месячный объём ИИ по тарифу. Лимит обновится 1-го числа, или перейдите на тариф побольше.",
    };
  }
  return { ok: true };
}

// Записать фактический расход после ответа модели.
export function addUsage(userId, { inputTokens = 0, outputTokens = 0 }) {
  return withUser(userId, (user) => {
    const usage = getUsage(user);
    user.usage = {
      month: usage.month,
      requests: usage.requests + 1,
      inputTokens: usage.inputTokens + inputTokens,
      outputTokens: usage.outputTokens + outputTokens,
    };
    return user.usage;
  });
}

// Подключить тариф вручную (после подтверждения оплаты).
export function setPlan(login, planId, months = 1) {
  const { type, key } = loginKey(login);
  const db = readUsers();
  const user = db.users.find((u) => u.loginType === type && u.loginKey === key);
  if (!user) return { error: "Аккаунт не найден." };
  if (!getPlan(planId) || (planId !== "free" && getPlan(planId).id !== planId)) {
    return { error: "Неизвестный тариф." };
  }
  user.plan = planId;
  // Продлеваем от текущей даты окончания, если подписка ещё активна.
  const base = Math.max(Date.now(), user.planUntil || 0);
  user.planUntil = planId === "free" ? 0 : base + months * 30 * 86400000;
  writeUsers(db);
  return { ok: true, plan: planId, until: user.planUntil, user: publicUser(user) };
}
