// Проверка живости для Vercel: открыть /api/health — должно вернуть ok.
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({ ok: true, model: process.env.CLAUDE_MODEL || "claude-opus-4-8" });
}
