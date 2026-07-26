// Обращения к серверу аккаунтов и данных (на том же VPS, что и приложение).
// BACKEND_URL пустой = тот же домен (относительные пути).

import { BACKEND_URL } from "../config";

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

// Сохранить данные пользователя на сервер.
export async function apiPutData(token, data) {
  await fetch(`${BACKEND_URL}/api/data`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  });
}
