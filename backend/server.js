// Бэкенд-прокси к Claude API.
// Задача: принимать запросы от мобильного приложения и пересылать их в Anthropic,
// подставляя секретный ключ. Ключ живёт ТОЛЬКО здесь (в .env), не в телефоне.

import "dotenv/config";
import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
app.use(cors());               // для продакшена ограничьте origin вашим доменом
app.use(express.json({ limit: "1mb" }));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";

// Проверка живости
app.get("/health", (_req, res) => res.json({ ok: true, model: MODEL }));

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

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Backend слушает http://localhost:${PORT}  (модель: ${MODEL})`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("!! ANTHROPIC_API_KEY не задан. Создайте backend/.env из .env.example");
  }
});
