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
  subscriptionFor, checkAiAllowed, addUsage, setPlan,
  ensureSlug, userBySlug,
} from "./db.js";
import { planList } from "./plans.js";
import {
  freeSlots, createBooking, pendingBookings, ackBookings,
  bookingSettings, onlineProducts,
} from "./booking.js";

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

// ---------- Онлайн-запись ----------

// Простое ограничение частоты для публичных адресов: страница открыта всем,
// без него календарь можно забить ложными записями.
const hits = new Map();
function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const rec = hits.get(key);
  if (!rec || now > rec.reset) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (rec.count >= limit) return false;
  rec.count++;
  return true;
}
// Раз в час подчищаем счётчики, чтобы карта не росла бесконечно.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
}, 3600000).unref?.();

const clientIp = (req) =>
  (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.ip || "?";

// Ссылка специалиста на свою страницу записи.
app.get("/api/booking/link", requireAuth, (req, res) => {
  const slug = ensureSlug(req.userId);
  res.json({ slug, path: `/z/${slug}` });
});

// Брони, которые приложение ещё не забрало.
app.get("/api/booking/pending", requireAuth, (req, res) => {
  res.json({ bookings: pendingBookings(req.userId) });
});

// Приложение сообщает, что перенесло брони в календарь.
app.post("/api/booking/ack", requireAuth, (req, res) => {
  res.json(ackBookings(req.userId, (req.body && req.body.ids) || []));
});

// --- Публичные адреса (без входа) ---

// Данные страницы записи: имя специалиста и доступные услуги.
app.get("/api/z/:slug", (req, res) => {
  if (!rateLimit(`p:${clientIp(req)}`, 120, 60000)) {
    return res.status(429).json({ error: "Слишком часто. Подождите минуту." });
  }
  const u = userBySlug(req.params.slug);
  if (!u) return res.status(404).json({ error: "Страница записи не найдена." });
  const data = getData(u.id);
  const settings = bookingSettings(data);
  if (!settings.enabled) {
    return res.status(404).json({ error: "Онлайн-запись сейчас отключена." });
  }
  // Логин специалиста (телефон/почта) наружу не отдаём — только то, что он
  // сам написал о себе.
  const profile = data?.profile || {};
  res.json({
    about: profile.activity || "",
    note: settings.note || "",
    tz: settings.tz || "",
    products: onlineProducts(data),
  });
});

// Свободные окошки под выбранную услугу.
app.get("/api/z/:slug/slots", (req, res) => {
  if (!rateLimit(`s:${clientIp(req)}`, 120, 60000)) {
    return res.status(429).json({ error: "Слишком часто. Подождите минуту." });
  }
  const u = userBySlug(req.params.slug);
  if (!u) return res.status(404).json({ error: "Страница записи не найдена." });
  const r = freeSlots(u.id, req.query.productId);
  if (r.error) return res.status(400).json(r);
  res.json({ days: r.days, product: r.product });
});

// Запись клиента.
app.post("/api/z/:slug/book", (req, res) => {
  const ip = clientIp(req);
  if (!rateLimit(`b:${ip}`, 5, 3600000)) {
    return res.status(429).json({
      error: "С этого устройства уже сделано несколько записей. Попробуйте позже или напишите специалисту.",
    });
  }
  const u = userBySlug(req.params.slug);
  if (!u) return res.status(404).json({ error: "Страница записи не найдена." });
  const r = createBooking(u.id, req.body || {});
  if (r.error) return res.status(400).json(r);
  res.json({ ok: true, booking: r.booking });
});

// Сама страница записи.
app.get("/z/:slug", (_req, res) => {
  res.sendFile(path.join(__dirname, "booking-page.html"));
});

// ---------- Продающая страница о продукте ----------
// Лежит по адресу /lp, чтобы не мешать приложению на главной. Когда захотите
// показывать её на главной, а приложение перенести — скажите, это отдельный шаг
// (нужно поправить адрес запуска в manifest.json, иначе у тех, кто уже добавил
// иконку на экран «Домой», приложение откроется не туда).

app.use("/lp/img", express.static(path.join(__dirname, "site", "img")));

app.get("/lp", (_req, res) => {
  res.sendFile(path.join(__dirname, "site", "index.html"));
});

// ---------- Тарифы и подписка ----------

// Список тарифов — нужен экрану «Подписка» (доступен без входа).
app.get("/api/plans", (_req, res) => res.json({ plans: planList() }));

// Текущий тариф и остаток лимитов.
app.get("/api/subscription", requireAuth, (req, res) => {
  const sub = subscriptionFor(req.userId);
  if (!sub) return res.status(404).json({ error: "Аккаунт не найден" });
  res.json(sub);
});

// Подключение тарифа вручную — после того, как оплата получена.
// Защищено отдельным паролем ADMIN_TOKEN из .env (не паролем аккаунта).
app.post("/api/admin/plan", (req, res) => {
  const secret = process.env.ADMIN_TOKEN;
  if (!secret) return res.status(503).json({ error: "ADMIN_TOKEN не задан на сервере" });
  const given = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (given !== secret) return res.status(401).json({ error: "Неверный ключ администратора" });
  const { login, plan, months } = req.body || {};
  const r = setPlan(login, plan, Number(months) || 1);
  if (r.error) return res.status(400).json(r);
  res.json(r);
});

// Основной эндпоинт: { system?: string, messages: [{role, content}] } -> { text }
// Требует входа: иначе ключом Anthropic мог бы пользоваться кто угодно,
// и никакие лимиты не работали бы.
app.post("/api/chat", requireAuth, async (req, res) => {
  try {
    const { system, messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages обязателен" });
    }

    // Проверяем тариф и остаток лимита ДО обращения к модели.
    const allowed = checkAiAllowed(req.userId);
    if (!allowed.ok) {
      return res.status(402).json({ error: allowed.message, reason: allowed.reason });
    }

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      system: system || undefined,
      messages,
    });

    // Записываем фактический расход — по ответу модели, а не по нашей оценке.
    const usage = response.usage || {};
    addUsage(req.userId, {
      inputTokens: (usage.input_tokens || 0)
        + (usage.cache_read_input_tokens || 0)
        + (usage.cache_creation_input_tokens || 0),
      outputTokens: usage.output_tokens || 0,
    });

    const text = (response.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    res.json({ text, subscription: subscriptionFor(req.userId) });
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
