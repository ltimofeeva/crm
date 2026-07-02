// Клиент для обращения к ИИ. НЕ обращается к Anthropic напрямую —
// только к вашему бэкенду (backend/server.js), где лежит API-ключ.
// Так ключ никогда не попадает в телефон. См. SECURITY.md.

import { BACKEND_URL } from "../config";
import {
  TODAY, CONTENT, WEEKLY, FUNNEL, PREV_MONTH,
} from "../data/seed";

// Собираем контекст практики для системного промпта.
export function buildContext(clients) {
  return `
Ты — ИИ-ассистент внутри CRM частной практики психолога.
Сегодня: среда, 10 июня 2026.

Твои задачи:
1. Контент. Идеи и черновики постов (Telegram, Instagram) на основе тем из
   сессий, частых запросов клиентов и того, что уже сработало.
2. Бизнес-анализ. Разбор практики по цифрам (доход, загрузка, средний чек,
   воронка контент→заявки→оплаты) и пошаговые планы роста с арифметикой цели,
   2-3 реалистичными сценариями и честными рисками.
3. Работа с клиентами. Подготовка к сессиям, сводки истории и динамики,
   структура заметок.

Правила:
- В клинических вопросах ты помощник по организации, НЕ супервизор: без диагнозов
  и директивных клинических рекомендаций, только факты из заметок и вопросы для размышления.
- В бизнес-планах не обещай гарантированный доход, не толкай к перегрузу или
  манипулятивному маркетингу; помечай допущения и риски.
- Кратко, по-русски, простым текстом без markdown-разметки.

ДАННЫЕ ПРАКТИКИ (JSON):
Клиенты: ${JSON.stringify((clients || []).map((c) => ({
    имя: c.name, возраст: c.age, запрос: c.request, формат: c.format,
    сессий: c.sessionsCount, статус: c.status, следующая: c.nextSession,
    заметки: c.sessions.map((s) => ({ дата: s.date, номер: s.n, заметка: s.note, динамика: s.mood })),
  })))}
Расписание сегодня: ${JSON.stringify(TODAY)}
Контент-план: ${JSON.stringify(CONTENT)}
Недельные тренды: ${JSON.stringify(WEEKLY)}
Воронка: ${JSON.stringify(FUNNEL)}
Прошлый месяц: ${JSON.stringify(PREV_MONTH)}
Финансы июня: доход 120000 ₽, план 210000 ₽, не оплачено 4000 ₽, средний чек 4300 ₽.
`;
}

// Отправить диалог ассистенту. messages: [{role, content}].
export async function sendChat({ messages, system }) {
  const res = await fetch(`${BACKEND_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, system }),
  });
  if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
  const data = await res.json();
  return data.text || "";
}

// Структурированный анализ клиента. Возвращает объект по схеме.
export async function analyzeClient({ client, system }) {
  const prompt =
    `Проанализируй клиента «${client.name}» ТОЛЬКО по заметкам психолога. ` +
    `Верни СТРОГО JSON без markdown, по схеме: ` +
    `{"summary": "2-3 предложения", "trend": "up|flat|down", ` +
    `"themes": ["тема1","тема2","тема3"], ` +
    `"attention": ["пункт1","пункт2"], ` +
    `"questions": ["вопрос1","вопрос2"]}. ` +
    `Без диагнозов. attention — факты из заметок, о которых легко забыть. ` +
    `questions — вопросы к началу следующей сессии.`;
  const res = await fetch(`${BACKEND_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      system,
    }),
  });
  if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
  const data = await res.json();
  let text = (data.text || "").trim().replace(/^```json/i, "").replace(/```$/,"").trim();
  return JSON.parse(text);
}
