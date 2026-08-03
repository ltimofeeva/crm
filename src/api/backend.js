// Обращения к серверу аккаунтов и данных (на том же VPS, что и приложение).
// BACKEND_URL пустой = тот же домен (относительные пути).

import { BACKEND_URL } from "../config";

// Токен входа. Хранится здесь, чтобы им могли пользоваться и синхронизация
// данных, и запросы к ИИ (к /api/chat теперь пускают только своих).
let authToken = null;
export function setApiToken(t) { authToken = t || null; }
export function getApiToken() { return authToken; }

async function post(pathname, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${BACKEND_URL}${pathname}`, {
      method: "POST", headers, body: JSON.stringify(body || {}),
    });
  } catch (e) {
    throw new Error("Нет связи с сервером. Проверьте интернет.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ошибка сервера (${res.status}).`);
  return data;
}

export function apiRegister(login, password) {
  return post("/api/auth/register", { login, password });
}

export function apiLogin(login, password) {
  return post("/api/auth/login", { login, password });
}

export async function apiLogout(token) {
  try { await post("/api/auth/logout", {}, token); } catch (e) {}
}

// Загрузить данные пользователя с сервера. При недействительном токене
// бросает ошибку "unauthorized".
export async function apiGetData(token) {
  let res;
  try {
    res = await fetch(`${BACKEND_URL}/api/data`, { headers: { Authorization: `Bearer ${token}` } });
  } catch (e) {
    throw new Error("network");
  }
  if (res.status === 401) throw new Error("unauthorized");
  const data = await res.json().catch(() => ({}));
  return data.data || {};
}

// Текущий тариф и остаток лимитов ИИ.
export async function apiGetSubscription(token) {
  let res;
  try {
    res = await fetch(`${BACKEND_URL}/api/subscription`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    throw new Error("network");
  }
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("server");
  return res.json();
}

// Список тарифов для экрана подписки.
export async function apiGetPlans() {
  const res = await fetch(`${BACKEND_URL}/api/plans`);
  if (!res.ok) throw new Error("server");
  const data = await res.json();
  return data.plans || [];
}

// Сохранить данные пользователя на сервер.
export async function apiPutData(token, data) {
  await fetch(`${BACKEND_URL}/api/data`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  });
}
