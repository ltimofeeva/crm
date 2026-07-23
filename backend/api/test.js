// Диагностика: делает ТЯЖЁЛЫЙ запрос к Claude (как настоящий в приложении)
// и показывает, сколько он длился и что вернул. Если Vercel обрывает по
// таймауту — страница не откроется/покажет ошибку Vercel (504). Это и
// проверяем. После отладки файл можно удалить.

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const started = Date.now();
  try {
    const r = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: "Ты помощник психолога-частника. Отвечай строго в формате JSON.",
      messages: [{
        role: "user",
        content:
          "Предложи 5 идей для постов в соцсетях для психолога. Верни строго JSON: " +
          '{"ideas":[{"title":"...","format":"пост|рилс|карусель","why":"..."}]}',
      }],
    });
    const text = (r.content || []).filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
    res.status(200).json({
      ok: true,
      elapsedMs: Date.now() - started,
      replyLength: text.length,
      replyStart: text.slice(0, 120),
      model: MODEL,
    });
  } catch (e) {
    res.status(200).json({
      ok: false,
      elapsedMs: Date.now() - started,
      errorStatus: e?.status || null,
      errorType: e?.error?.type || e?.name || null,
      errorMessage: e?.message || String(e),
      model: MODEL,
    });
  }
}
