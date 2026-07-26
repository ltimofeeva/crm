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
