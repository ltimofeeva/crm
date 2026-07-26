// Бэкенд-прокси к Claude API.
// Задача: принимать запросы от мобильного приложения и пересылать их в Anthropic,
// подставляя секретный ключ. Ключ живёт ТОЛЬКО здесь (в .env), не в телефоне.

import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import {
  register, login, userIdByToken, revokeToken, getData, setData,
} from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());               // для продакшена ограничьте origin вашим доменом
app.use(express.json({ limit: "5mb" }));

// Отдаём собранное веб-приложение (папка public), чтобы его можно было
// открыть по адресу сервера и добавить «на экран Домой» как иконку.
app.use(express.static(path.join(__dirname, "public")));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";

// Проверка живости
app.get("/health", (_req, res) => res.json({ ok: true, model: MODEL }));

// ---------- Аккаунты (общие для всех устройств) ----------

app.post("/api/auth/register", (req, res) => {
  const r = register(req.body || {});
  if (r.error) return res.status(400).json(r);
  res.json(r); // { token, user }
});

app.post("/api/auth/login", (req, res) => {
  const r = login(req.body || {});
  if (r.error) return res.status(400).json(r);
  res.json(r); // { token, user }
});

app.post("/api/auth/logout", (req, res) => {
  const t = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  revokeToken(t);
  res.json({ ok: true });
});

// Middleware: проверка токена.
function requireAuth(req, res, next) {
  const t = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const uid = userIdByToken(t);
  if (!uid) return res.status(401).json({ error: "Не авторизован" });
  req.userId = uid;
  next();
}

// ---------- Данные пользователя (синхронизация между устройствами) ----------

app.get("/api/data", requireAuth, (req, res) => {
  res.json({ data: getData(req.userId) });
});

app.put("/api/data", requireAuth, (req, res) => {
  setData(req.userId, (req.body && req.body.data) || {});
  res.json({ ok: true });
});

// Основной эндпоинт: { system?: string, messages: [{role, content}] } -> { text }
app.post("/api/chat", async (req, res) => {
  try {
    const { system, messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages обязателен" });
    }
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      system: system || undefined,
      messages,
    });
    const text = (response.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    res.json({ text });
  } catch (e) {
    console.error("chat error:", e?.message || e);
    res.status(500).json({ error: "AI request failed" });
  }
});

// SPA-фолбэк: любые остальные GET-адреса отдают index.html приложения
// (кроме API и проверки живости).
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api") || req.path === "/health") return next();
  const indexPath = path.join(__dirname, "public", "index.html");
  res.sendFile(indexPath, (err) => { if (err) next(); });
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Backend слушает http://localhost:${PORT}  (модель: ${MODEL})`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("!! ANTHROPIC_API_KEY не задан. Создайте backend/.env из .env.example");
  }
});
