// Диагностика: делает один маленький запрос к Claude и показывает результат
// или ТОЧНЫЙ текст ошибки. Открывается в браузере (GET) — удобно проверять.
// После отладки этот файл можно удалить.

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const keyInfo = {
    keySet: Boolean(process.env.ANTHROPIC_API_KEY),
    keyStart: (process.env.ANTHROPIC_API_KEY || "").slice(0, 8),
    keyLength: (process.env.ANTHROPIC_API_KEY || "").length,
    model: MODEL,
  };
  try {
    const r = await client.messages.create({
      model: MODEL,
      max_tokens: 50,
      messages: [{ role: "user", content: "Ответь одним словом: работает" }],
    });
    const text = (r.content || []).filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
    res.status(200).json({ ok: true, reply: text, ...keyInfo });
  } catch (e) {
    res.status(200).json({
      ok: false,
      errorStatus: e?.status || null,
      errorType: e?.error?.type || e?.name || null,
      errorMessage: e?.message || String(e),
      ...keyInfo,
    });
  }
}
