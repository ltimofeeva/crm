// Прокси к Claude API для хостинга на Vercel (serverless-функция).
// Vercel отдаёт эту функцию по адресу /api/chat. Секретный ключ живёт
// в переменной окружения ANTHROPIC_API_KEY (задаётся в панели Vercel),
// в приложение он не попадает.
//
// Аналог backend/server.js, но в формате serverless (не Express).

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";

// Разрешаем запросы с сайта (в т.ч. с vigroup74.ru).
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  try {
    const { system, messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages обязателен" });
      return;
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
    res.status(200).json({ text });
  } catch (e) {
    console.error("chat error:", e?.message || e);
    res.status(500).json({ error: "AI request failed" });
  }
}
