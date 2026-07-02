import React, { useState, useRef, useEffect } from "react";
import {
  Calendar, Users, PenLine, LayoutDashboard, Sparkles, ChevronLeft,
  Plus, Clock, Video, MapPin, Search, Circle, CheckCircle2,
  FileText, Lightbulb, Send, ChevronRight, X, Wallet,
  BarChart3, TrendingUp, TrendingDown, ArrowRight
} from "lucide-react";

/* ---------- Палитра ---------- */
const C = {
  bg: "#F3F5F2",
  ink: "#24332C",
  inkSoft: "#5D6B63",
  primary: "#33604F",
  primarySoft: "#E3ECE7",
  accent: "#C2734F",
  accentSoft: "#F6E9E1",
  line: "#E2E7E2",
};
const serif = { fontFamily: "Georgia, 'Times New Roman', serif" };

/* ---------- Мок-данные ---------- */

const CLIENTS = [
  {
    id: 1, name: "Анна Морозова", age: 34, since: "сент. 2025",
    request: "Тревожность, панические атаки", format: "Онлайн",
    phone: "+7 951 ХХХ ХХ 11", sessionsCount: 14, status: "Активный",
    nextSession: "Сегодня, 14:00",
    sessions: [
      { date: "3 июн 2026", n: 14, note: "Закрепили технику дыхания 4-7-8. Анна впервые за месяц без эпизодов ПА. Обсудили триггер — звонки от руководителя.", mood: "↑ Стабильнее" },
      { date: "27 мая 2026", n: 13, note: "Эпизод ПА в метро во вторник. Разобрали по протоколу КПТ: мысль → эмоция → телесная реакция. ДЗ — дневник тревоги.", mood: "↓ Спад" },
      { date: "20 мая 2026", n: 12, note: "Работа с катастрофизацией. Хорошо идёт когнитивная реструктуризация, видит автоматические мысли сама.", mood: "→ Ровно" },
    ],
  },
  {
    id: 2, name: "Дмитрий Калнс", age: 41, since: "янв. 2026",
    request: "Выгорание, конфликт на работе", format: "Кабинет",
    phone: "+7 951 ХХХ ХХ 82", sessionsCount: 9, status: "Активный",
    nextSession: "Сегодня, 17:30",
    sessions: [
      { date: "4 июн 2026", n: 9, note: "Принял решение о переговорах с партнёром вместо ухода. Снизилась руминация по вечерам. Сон 6→7 часов.", mood: "↑ Стабильнее" },
      { date: "28 мая 2026", n: 8, note: "Колесо баланса: работа 9/10 по занятости, 2/10 по удовлетворённости. Сформулировали 3 личные границы.", mood: "→ Ровно" },
    ],
  },
  {
    id: 3, name: "Елена Тарасова", age: 28, since: "март 2026",
    request: "Самооценка, отношения", format: "Онлайн",
    phone: "+7 951 ХХХ ХХ 07", sessionsCount: 6, status: "Активный",
    nextSession: "Чт, 11:00",
    sessions: [
      { date: "2 июн 2026", n: 6, note: "Тема внутреннего критика. Упражнение «голос критика / голос поддержки» — отозвалось, завершили в ресурсе.", mood: "↓ Спад" },
    ],
  },
  {
    id: 4, name: "Игорь Северин", age: 37, since: "окт. 2025",
    request: "Развод, адаптация", format: "Кабинет",
    phone: "+7 951 ХХХ ХХ 33", sessionsCount: 18, status: "Пауза",
    nextSession: "—",
    sessions: [
      { date: "14 мая 2026", n: 18, note: "Завершающая сессия цикла. Цели достигнуты, договорились о паузе с поддерживающими встречами раз в месяц.", mood: "↑ Стабильнее" },
    ],
  },
];

const TODAY = [
  { time: "10:00", client: "Супервизия (групповая)", type: "video", dur: "90 мин", own: true },
  { time: "14:00", client: "Анна Морозова", type: "video", dur: "50 мин", session: 15 },
  { time: "16:00", client: "Первичная — Марта В.", type: "video", dur: "30 мин", isNew: true },
  { time: "17:30", client: "Дмитрий Калнс", type: "office", dur: "50 мин", session: 10 },
];

const WEEK = [
  { day: "Пн", date: 8, slots: ["11:00 · Елена Т.", "15:00 · свободно", "17:00 · Игорь С."] },
  { day: "Вт", date: 9, slots: ["10:00 · свободно", "14:00 · Анна М.", "18:00 · свободно"] },
  { day: "Ср", date: 10, today: true, slots: ["10:00 · Супервизия", "14:00 · Анна М.", "16:00 · Первичная, Марта В.", "17:30 · Дмитрий К."] },
  { day: "Чт", date: 11, slots: ["11:00 · Елена Т.", "13:00 · свободно", "16:00 · свободно"] },
  { day: "Пт", date: 12, slots: ["10:00 · свободно", "12:00 · Дмитрий К."] },
];

const CONTENT = {
  ideas: [
    { id: 1, title: "5 признаков выгорания, которые легко пропустить", src: "из сессий за май" },
    { id: 2, title: "Почему «просто успокойся» не работает при ПА", src: "частый вопрос клиентов" },
    { id: 3, title: "Внутренний критик: чей это голос на самом деле?", src: "тема недели" },
  ],
  drafts: [
    { id: 4, title: "Техника 4-7-8: дыхание против тревоги", channel: "Instagram · карусель", progress: "Текст готов, нужны слайды" },
    { id: 5, title: "Как выбрать психолога: чек-лист", channel: "Telegram · лонгрид", progress: "Черновик 70%" },
  ],
  published: [
    { id: 6, title: "Границы — это не стены, а двери", channel: "Telegram", date: "5 июн", stats: "1 240 просмотров · 18 заявок" },
    { id: 7, title: "Дневник тревоги: шаблон + инструкция", channel: "Instagram", date: "1 июн", stats: "3 100 охват · 96 сохранений" },
  ],
};

/* ---------- Аналитика: недельные тренды ---------- */

// доход в тыс. ₽, sessions — число проведённых сессий, окна — сколько свободных слотов осталось
const WEEKLY = [
  { label: "5 мая", revenue: 24, sessions: 11, freeSlots: 6 },
  { label: "12 мая", revenue: 26, sessions: 12, freeSlots: 5 },
  { label: "19 мая", revenue: 22, sessions: 10, freeSlots: 7 },
  { label: "26 мая", revenue: 30, sessions: 13, freeSlots: 3 },
  { label: "2 июн", revenue: 28, sessions: 12, freeSlots: 4 },
  { label: "9 июн", revenue: 20, sessions: 9, freeSlots: 6, partial: true },
];

// воронка привлечения за месяц
const FUNNEL = [
  { label: "Охват контента", value: 4340, sub: "Telegram + Instagram" },
  { label: "Заявки", value: 34, sub: "написали в директ" },
  { label: "Первичные консультации", value: 11, sub: "дошли до встречи" },
  { label: "Стали постоянными", value: 6, sub: "продолжили терапию" },
];

const PREV_MONTH = {
  income: 102, // тыс. ₽ за май
  sessions: 46,
  avgCheck: 4300,
  activeClients: 11,
  retention: "≈ 55% заявок → первичная, 55% первичных → постоянные",
  fillRate: "≈ 68% рабочих окон заполнено",
};

/* ---------- Контекст практики для ИИ ---------- */

const PRACTICE_CONTEXT = `
Ты — ИИ-ассистент внутри CRM частной практики психолога Елены Кузнецовой.
Сегодня: среда, 10 июня 2026.

Твои задачи:
1. Контент. Придумывать идеи и писать черновики постов (Telegram, Instagram)
   на основе реальной деятельности эксперта: тем из сессий, частых запросов
   клиентов и того, что уже сработало в опубликованном.
2. Бизнес-анализ. Разбирать деятельность практики по цифрам: доход, загрузка,
   средний чек, число активных клиентов, воронка «контент → заявки → оплаты».
   По запросу составлять пошаговые планы роста (например, выйти на доход x2):
   через цену, число сессий, удержание, наполнение свободных окон, контент.
   Считай на основе реальных данных ниже, показывай арифметику (сколько сессий
   по какой цене даёт цель), предлагай 2-3 реалистичных сценария.
3. Работа с клиентами. Готовить к сессиям, суммировать историю и динамику
   каждого клиента, предлагать структуру заметок.

Важные правила:
- В клинических вопросах ты помощник по организации, а НЕ супервизор и не
  клинический консультант: не ставь диагнозы и не давай директивных
  клинических рекомендаций — только напоминай факты из заметок и предлагай
  вопросы для размышления.
- В бизнес-планах не обещай гарантированный доход и не подталкивай к тактикам,
  которые вредят качеству терапии или этике (перегруз, давление на клиентов,
  манипулятивный маркетинг). Честно отмечай допущения и риски.
- Отвечай кратко и по делу, на русском, без лишних вступлений.
- Форматируй ответы простым текстом с короткими абзацами и списками через тире,
  без markdown-разметки (#, **, и т.д.).

ДАННЫЕ ПРАКТИКИ (JSON):
Клиенты: ${JSON.stringify(CLIENTS.map(c => ({
  имя: c.name, возраст: c.age, в_терапии_с: c.since, запрос: c.request,
  формат: c.format, сессий: c.sessionsCount, статус: c.status,
  следующая_сессия: c.nextSession,
  заметки: c.sessions.map(s => ({ дата: s.date, номер: s.n, заметка: s.note, динамика: s.mood }))
})))}

Расписание сегодня: ${JSON.stringify(TODAY)}
Контент-план: ${JSON.stringify(CONTENT)}
Финансы июня: доход 120000 рублей, план 210000 рублей, не оплачено 4000 рублей (Анна Морозова, 3 июня), средний чек 4300 рублей.

Недельные тренды (доход в тыс. рублей, sessions — проведено сессий, freeSlots — осталось свободных окон): ${JSON.stringify(WEEKLY)}
Воронка привлечения за месяц: ${JSON.stringify(FUNNEL)}
Итоги прошлого месяца (май): ${JSON.stringify(PREV_MONTH)}
`;

/* ---------- Анализ клиента ИИ ---------- */

const ANALYSIS_CACHE = {};

async function fetchClientAnalysis(client) {
  if (ANALYSIS_CACHE[client.id]) return ANALYSIS_CACHE[client.id];

  const prompt = `Проанализируй клиента «${client.name}» на основе данных практики.
Ответь ТОЛЬКО валидным JSON без markdown-обёртки и пояснений, по схеме:
{
  "summary": "2-3 предложения: общая картина и динамика терапии",
  "trend": "up" | "flat" | "down",
  "themes": ["3-4 ключевые темы из заметок, коротко"],
  "watch": ["2-3 пункта, на что обратить внимание (факты из заметок, без диагнозов)"],
  "questions": ["2-3 вопроса, которые стоит поднять на следующей сессии"]
}
Помни: ты не супервизор, опирайся только на факты из заметок.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: PRACTICE_CONTEXT,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await response.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .replace(/```json|```/g, "")
    .trim();
  const parsed = JSON.parse(text);
  ANALYSIS_CACHE[client.id] = parsed;
  return parsed;
}

function ClientAnalysis({ client }) {
  const [state, setState] = useState(ANALYSIS_CACHE[client.id] ? "done" : "idle");
  const [analysis, setAnalysis] = useState(ANALYSIS_CACHE[client.id] || null);

  const run = async () => {
    setState("loading");
    try {
      const a = await fetchClientAnalysis(client);
      setAnalysis(a);
      setState("done");
    } catch (e) {
      setState("error");
    }
  };

  if (state === "idle" || state === "error") {
    return (
      <div>
        <button
          onClick={run}
          className="w-full flex items-center justify-center gap-2 text-sm py-3 rounded-2xl"
          style={{ background: C.primarySoft, color: C.primary }}
        >
          <Sparkles size={15} /> Анализ ИИ по клиенту
        </button>
        {state === "error" && (
          <p className="text-[12px] text-center mt-2" style={{ color: C.accent }}>
            Не удалось построить анализ. Попробуйте ещё раз.
          </p>
        )}
      </div>
    );
  }

  if (state === "loading") {
    return (
      <Card className="p-4 flex items-center gap-3">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((d) => (
            <span
              key={d}
              className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{ background: C.primary, animationDelay: `${d * 0.15}s` }}
            />
          ))}
        </div>
        <p className="text-[13px]" style={{ color: C.inkSoft }}>
          Ассистент читает {client.sessions.length} заметки и историю терапии…
        </p>
      </Card>
    );
  }

  const trendLabel =
    analysis.trend === "up" ? "↑ Положительная динамика"
    : analysis.trend === "down" ? "↓ Требует внимания"
    : "→ Стабильно";

  return (
    <Card className="p-4 space-y-3" >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={14} style={{ color: C.primary }} />
          <p className="text-[13px] font-medium" style={{ color: C.ink }}>Анализ ИИ</p>
        </div>
        <Tag tone={analysis.trend === "down" ? "clay" : "green"}>{trendLabel}</Tag>
      </div>

      <p className="text-[13px] leading-relaxed" style={{ color: C.ink }}>{analysis.summary}</p>

      <div>
        <p className="text-[11px] mb-1.5 tracking-wide" style={{ color: C.inkSoft }}>КЛЮЧЕВЫЕ ТЕМЫ</p>
        <div className="flex flex-wrap gap-1.5">
          {analysis.themes.map((t, i) => <Tag key={i}>{t}</Tag>)}
        </div>
      </div>

      <div>
        <p className="text-[11px] mb-1.5 tracking-wide" style={{ color: C.inkSoft }}>ОБРАТИТЬ ВНИМАНИЕ</p>
        <div className="space-y-1">
          {analysis.watch.map((w, i) => (
            <p key={i} className="text-[13px] leading-snug flex gap-1.5" style={{ color: C.ink }}>
              <span style={{ color: C.accent }}>—</span> {w}
            </p>
          ))}
        </div>
      </div>

      <div className="p-3 rounded-xl" style={{ background: C.bg }}>
        <p className="text-[11px] mb-1.5 tracking-wide" style={{ color: C.inkSoft }}>ВОПРОСЫ К СЛЕДУЮЩЕЙ СЕССИИ</p>
        <div className="space-y-1">
          {analysis.questions.map((q, i) => (
            <p key={i} className="text-[13px] leading-snug" style={{ color: C.ink }}>{i + 1}. {q}</p>
          ))}
        </div>
      </div>

      <p className="text-[10px] leading-snug" style={{ color: C.inkSoft }}>
        Анализ построен только по вашим заметкам. Это не клиническая оценка и не замена супервизии.
      </p>
    </Card>
  );
}

/* ---------- Мелкие элементы ---------- */

const Tag = ({ children, tone = "green" }) => (
  <span
    className="text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap"
    style={{
      background: tone === "clay" ? C.accentSoft : C.primarySoft,
      color: tone === "clay" ? C.accent : C.primary,
    }}
  >
    {children}
  </span>
);

const Card = ({ children, className = "", onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-2xl ${onClick ? "cursor-pointer active:scale-[0.99] transition-transform" : ""} ${className}`}
    style={{ border: `1px solid ${C.line}` }}
  >
    {children}
  </div>
);

const H1 = ({ children, sub }) => (
  <div className="mb-4">
    <h1 className="text-[22px] leading-tight" style={{ ...serif, color: C.ink }}>{children}</h1>
    {sub && <p className="text-[13px] mt-1" style={{ color: C.inkSoft }}>{sub}</p>}
  </div>
);

/* ---------- ИИ-ассистент ---------- */

const QUICK_PROMPTS = [
  "Подготовь меня к сессии с Анной в 14:00",
  "Проанализируй прошлый месяц и дай план выйти на доход x2",
  "3 идеи постов из тем этой недели",
  "Что важно не забыть сегодня?",
];

function AIChat({ onClose, presetPrompt }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState(presetPrompt || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;
    setError(null);
    setInput("");

    const history = [...messages, { role: "user", content: userText }];
    setMessages(history);
    setLoading(true);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: PRACTICE_CONTEXT,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await response.json();
      const reply = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (!reply) throw new Error("empty");
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setError("Не удалось получить ответ. Проверьте соединение и попробуйте ещё раз.");
      setMessages((prev) => prev.slice(0, -1));
      setInput(userText);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 max-w-md mx-auto flex flex-col" style={{ background: C.bg }}>
      <header
        className="px-4 py-3 flex items-center gap-3"
        style={{ background: C.bg, borderBottom: `1px solid ${C.line}` }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: C.primary }}
        >
          <Sparkles size={15} color="#fff" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: C.ink }}>Ассистент практики</p>
          <p className="text-[11px]" style={{ color: C.inkSoft }}>
            Знает ваших клиентов, расписание и контент-план
          </p>
        </div>
        <button onClick={onClose} className="p-2 -mr-2" style={{ color: C.inkSoft }}>
          <X size={20} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-4 pt-4">
            <p className="text-[13px] text-center px-6 leading-relaxed" style={{ color: C.inkSoft }}>
              Спросите про любого клиента, попросите подготовить к сессии
              или придумать пост — у ассистента есть контекст всей практики.
            </p>
            <div className="space-y-2">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="w-full text-left text-[13px] p-3 rounded-2xl bg-white active:scale-[0.99] transition-transform"
                  style={{ border: `1px solid ${C.line}`, color: C.ink }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-relaxed whitespace-pre-wrap"
              style={
                m.role === "user"
                  ? { background: C.primary, color: "#fff", borderBottomRightRadius: 6 }
                  : { background: "#fff", color: C.ink, border: `1px solid ${C.line}`, borderBottomLeftRadius: 6 }
              }
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div
              className="px-4 py-3 rounded-2xl flex gap-1.5 items-center"
              style={{ background: "#fff", border: `1px solid ${C.line}` }}
            >
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ background: C.inkSoft, animationDelay: `${d * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="text-[12px] text-center" style={{ color: C.accent }}>{error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pt-2 pb-5" style={{ background: C.bg, borderTop: `1px solid ${C.line}` }}>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Спросите ассистента…"
            rows={1}
            className="flex-1 px-3.5 py-2.5 rounded-2xl text-sm outline-none resize-none bg-white"
            style={{ border: `1px solid ${C.line}`, color: C.ink, maxHeight: 96 }}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40"
            style={{ background: C.primary }}
          >
            <Send size={16} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Сегодня ---------- */

function Dashboard({ openClient, openAI }) {
  return (
    <div className="space-y-5">
      <H1 sub="4 встречи · 1 первичная · окно 12:00–14:00">Среда, 10 июня</H1>

      <div className="grid grid-cols-3 gap-2">
        {[
          { l: "Сессий / нед", v: "12" },
          { l: "Клиентов", v: "11" },
          { l: "Июнь", v: "120 000 ₽" },
        ].map((s) => (
          <Card key={s.l} className="p-3 text-center">
            <p className="text-lg" style={{ ...serif, color: C.ink }}>{s.v}</p>
            <p className="text-[11px] mt-0.5" style={{ color: C.inkSoft }}>{s.l}</p>
          </Card>
        ))}
      </div>

      <div>
        <p className="text-xs font-medium mb-2 tracking-wide" style={{ color: C.inkSoft }}>СЕГОДНЯ</p>
        <div className="space-y-2">
          {TODAY.map((a) => (
            <Card
              key={a.time}
              className="p-3.5 flex items-center gap-3"
              onClick={!a.own && !a.isNew ? () => openClient(a.client) : undefined}
            >
              <div className="text-center w-12 shrink-0">
                <p className="font-medium text-[15px]" style={{ color: C.ink }}>{a.time}</p>
                <p className="text-[10px]" style={{ color: C.inkSoft }}>{a.dur}</p>
              </div>
              <div className="w-px self-stretch" style={{ background: C.line }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: C.ink }}>{a.client}</p>
                <p className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: C.inkSoft }}>
                  {a.type === "video" ? <Video size={11} /> : <MapPin size={11} />}
                  {a.type === "video" ? "Видео" : "Кабинет"}
                  {a.session && ` · №${a.session}`}
                </p>
              </div>
              {a.isNew && <Tag tone="clay">Первичная</Tag>}
              {a.own && <Tag>Своё</Tag>}
              {!a.own && !a.isNew && <ChevronRight size={16} style={{ color: C.inkSoft }} />}
            </Card>
          ))}
        </div>
      </div>

      <Card
        className="p-3.5 flex items-start gap-2.5"
        onClick={() => openAI("Подготовь меня к сессии с Анной в 14:00")}
      >
        <Sparkles size={16} className="mt-0.5 shrink-0" style={{ color: C.accent }} />
        <div className="flex-1">
          <p className="text-[13px] leading-snug" style={{ color: C.ink }}>
            Через 2 часа сессия с Анной Морозовой — попросить ассистента подготовить сводку?
          </p>
          <p className="text-[11px] mt-1" style={{ color: C.primary }}>Подготовить →</p>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Календарь ---------- */

function CalendarView() {
  const [sel, setSel] = useState(2);
  const d = WEEK[sel];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <H1>8–12 июня</H1>
        <button
          className="flex items-center gap-1.5 text-[13px] text-white px-3.5 py-2 rounded-xl shrink-0"
          style={{ background: C.primary }}
        >
          <Plus size={15} /> Запись
        </button>
      </div>

      <div className="flex gap-2">
        {WEEK.map((w, i) => (
          <button
            key={w.day}
            onClick={() => setSel(i)}
            className="flex-1 py-2.5 rounded-xl text-center"
            style={{
              background: i === sel ? C.primary : "#fff",
              border: `1px solid ${i === sel ? C.primary : C.line}`,
              color: i === sel ? "#fff" : C.inkSoft,
            }}
          >
            <p className="text-[11px]">{w.day}</p>
            <p className="text-base" style={serif}>{w.date}</p>
            {w.today && (
              <div
                className="w-1 h-1 rounded-full mx-auto mt-0.5"
                style={{ background: i === sel ? "#fff" : C.accent }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {d.slots.map((s, i) => {
          const free = s.includes("свободно");
          const parts = s.split(" · ");
          const time = parts[0];
          const rest = parts.slice(1).join(" · ");
          return (
            <div
              key={i}
              className="p-3.5 rounded-2xl flex items-center gap-3"
              style={{
                background: free ? "transparent" : "#fff",
                border: `1px ${free ? "dashed" : "solid"} ${C.line}`,
              }}
            >
              <p className="text-sm font-medium w-12" style={{ color: free ? C.inkSoft : C.ink }}>{time}</p>
              <p className="text-sm flex-1" style={{ color: free ? C.inkSoft : C.ink }}>
                {free ? "Свободное окно" : rest}
              </p>
              {free && <Plus size={16} style={{ color: C.primary }} />}
            </div>
          );
        })}
      </div>

      <Card className="p-3.5">
        <p className="text-[13px] leading-snug" style={{ color: C.inkSoft }}>
          Онлайн-запись для клиентов:{" "}
          <span style={{ color: C.primary }}>booking.mypractice.lv/elena</span>
        </p>
      </Card>
    </div>
  );
}

/* ---------- Клиенты ---------- */

function ClientList({ open, query, setQuery }) {
  const list = CLIENTS.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <H1>Клиенты</H1>
        <button
          className="flex items-center gap-1.5 text-[13px] text-white px-3.5 py-2 rounded-xl shrink-0"
          style={{ background: C.primary }}
        >
          <Plus size={15} /> Новый
        </button>
      </div>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-3" style={{ color: C.inkSoft }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white text-sm outline-none"
          style={{ border: `1px solid ${C.line}`, color: C.ink }}
        />
      </div>
      <div className="space-y-2">
        {list.map((c) => (
          <Card key={c.id} className="p-3.5 flex items-center gap-3" onClick={() => open(c.id)}>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm shrink-0"
              style={{ background: C.primarySoft, color: C.primary, ...serif }}
            >
              {c.name.split(" ").map((w) => w[0]).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: C.ink }}>{c.name}</p>
              <p className="text-[11px] truncate" style={{ color: C.inkSoft }}>{c.request}</p>
            </div>
            <div className="text-right shrink-0">
              <Tag tone={c.status === "Пауза" ? "clay" : "green"}>{c.status}</Tag>
              <p className="text-[10px] mt-1" style={{ color: C.inkSoft }}>{c.sessionsCount} сессий</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ClientCard({ client, back, openAI }) {
  const [note, setNote] = useState("");
  const [sessions, setSessions] = useState(client.sessions);
  const [noteOpen, setNoteOpen] = useState(false);

  const addNote = () => {
    if (!note.trim()) return;
    setSessions([{ date: "10 июн 2026", n: client.sessionsCount + 1, note, mood: "→ Ровно" }, ...sessions]);
    setNote("");
    setNoteOpen(false);
  };

  return (
    <div className="space-y-4 pb-4">
      <button onClick={back} className="flex items-center gap-1 text-[13px]" style={{ color: C.inkSoft }}>
        <ChevronLeft size={15} /> Все клиенты
      </button>

      <Card className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl" style={{ ...serif, color: C.ink }}>{client.name}</h1>
            <p className="text-[12px] mt-0.5" style={{ color: C.inkSoft }}>
              {client.age} лет · с {client.since} · {client.sessionsCount} сессий
            </p>
          </div>
          <Tag tone={client.status === "Пауза" ? "clay" : "green"}>{client.status}</Tag>
        </div>
        <div className="space-y-2 mt-3 text-sm">
          <div className="p-3 rounded-xl" style={{ background: C.bg }}>
            <p className="text-[11px] mb-0.5" style={{ color: C.inkSoft }}>Запрос</p>
            <p className="text-[13px]" style={{ color: C.ink }}>{client.request}</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: C.bg }}>
            <p className="text-[11px] mb-0.5" style={{ color: C.inkSoft }}>Формат · контакт</p>
            <p className="text-[13px]" style={{ color: C.ink }}>{client.format} · {client.phone}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-3 text-[13px]">
          <Clock size={13} style={{ color: C.primary }} />
          <span style={{ color: C.ink }}>Следующая: {client.nextSession}</span>
        </div>
      </Card>

      {!noteOpen && (
        <button
          onClick={() => setNoteOpen(true)}
          className="w-full flex items-center justify-center gap-2 text-sm text-white py-3 rounded-2xl"
          style={{ background: C.accent }}
        >
          <PenLine size={15} /> Заметка к сессии
        </button>
      )}

      {noteOpen && (
        <Card className="p-4">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Темы, динамика, домашнее задание…"
            rows={4}
            autoFocus
            className="w-full p-3 rounded-xl text-sm outline-none resize-none"
            style={{ border: `1px solid ${C.line}`, color: C.ink, background: C.bg }}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setNoteOpen(false)}
              className="flex-1 text-sm py-2.5 rounded-xl"
              style={{ border: `1px solid ${C.line}`, color: C.inkSoft }}
            >
              Отмена
            </button>
            <button
              onClick={addNote}
              className="flex-1 text-sm text-white py-2.5 rounded-xl"
              style={{ background: C.accent }}
            >
              Сохранить
            </button>
          </div>
        </Card>
      )}

      <ClientAnalysis client={client} />

      <div>
        <p className="text-xs font-medium mb-2 tracking-wide" style={{ color: C.inkSoft }}>ИСТОРИЯ СЕССИЙ</p>
        <div className="relative pl-5">
          <div className="absolute left-1.5 top-1 bottom-1 w-px" style={{ background: C.line }} />
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.n} className="relative">
                <Circle
                  size={8}
                  className="absolute -left-[18px] top-2"
                  style={{ color: C.primary, fill: C.primary }}
                />
                <Card className="p-3.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[13px] font-medium" style={{ color: C.ink }}>
                      №{s.n} · {s.date}
                    </p>
                    <Tag tone={s.mood.startsWith("↓") ? "clay" : "green"}>{s.mood}</Tag>
                  </div>
                  <p className="text-[13px] leading-relaxed" style={{ color: C.inkSoft }}>{s.note}</p>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Контент ---------- */

function ContentView({ openAI }) {
  const [seg, setSeg] = useState("ideas");
  const segs = [
    { key: "ideas", title: "Идеи", icon: Lightbulb, items: CONTENT.ideas },
    { key: "drafts", title: "Черновики", icon: FileText, items: CONTENT.drafts },
    { key: "published", title: "Готово", icon: Send, items: CONTENT.published },
  ];
  const active = segs.find((s) => s.key === seg);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <H1>Контент</H1>
        <button
          onClick={() => openAI("Предложи 3 новые идеи постов на основе тем из последних сессий и того, что уже сработало в опубликованном")}
          className="flex items-center gap-1.5 text-[13px] px-3.5 py-2 rounded-xl shrink-0"
          style={{ background: C.primarySoft, color: C.primary }}
        >
          <Sparkles size={15} /> Идеи от ИИ
        </button>
      </div>

      <div className="flex p-1 rounded-xl gap-1" style={{ background: "#E9EDE9" }}>
        {segs.map((s) => (
          <button
            key={s.key}
            onClick={() => setSeg(s.key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px]"
            style={{
              background: seg === s.key ? "#fff" : "transparent",
              color: seg === s.key ? C.ink : C.inkSoft,
              boxShadow: seg === s.key ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            }}
          >
            <s.icon size={13} />
            {s.title}
            <span className="text-[11px]" style={{ color: C.inkSoft }}>{s.items.length}</span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {active.items.map((it) => (
          <Card
            key={it.id}
            className="p-3.5"
            onClick={
              seg !== "published"
                ? () => openAI(`Помоги с постом «${it.title}»${it.channel ? ` для канала ${it.channel}` : ""}: напиши черновик текста`)
                : undefined
            }
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-snug flex-1" style={{ color: C.ink }}>{it.title}</p>
              {seg !== "published" && <Sparkles size={13} className="shrink-0 mt-0.5" style={{ color: C.inkSoft }} />}
            </div>
            {it.src && <p className="text-[12px] mt-1.5" style={{ color: C.inkSoft }}>💭 {it.src}</p>}
            {it.channel && <p className="text-[12px] mt-1.5" style={{ color: C.inkSoft }}>{it.channel}</p>}
            {it.progress && (
              <div className="mt-2"><Tag tone="clay">{it.progress}</Tag></div>
            )}
            {it.stats && (
              <p className="text-[12px] mt-1.5" style={{ color: C.primary }}>
                {it.date} · {it.stats}
              </p>
            )}
          </Card>
        ))}
      </div>

      {seg === "published" && (
        <Card className="p-3.5 flex items-start gap-2.5">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: C.primary }} />
          <p className="text-[13px] leading-snug" style={{ color: C.ink }}>
            «Дневник тревоги» — 96 сохранений. Практические шаблоны работают лучше всего.
          </p>
        </Card>
      )}
    </div>
  );
}

/* ---------- Аналитика ---------- */

function TrendChart({ data, metric, unit }) {
  const values = data.map((d) => d[metric]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const W = 320, H = 150, padX = 14, padTop = 16, padBot = 26;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBot;
  const step = innerW / (data.length - 1);
  const y = (v) => padTop + innerH - ((v - min) / (max - min || 1)) * innerH;
  const pts = data.map((d, i) => [padX + i * step, y(d[metric])]);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${path} L${pts[pts.length - 1][0].toFixed(1)},${padTop + innerH} L${pts[0][0].toFixed(1)},${padTop + innerH} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.primary} stopOpacity="0.18" />
          <stop offset="100%" stopColor={C.primary} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#fill)" />
      <path d={path} fill="none" stroke={C.primary} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle
            cx={p[0]} cy={p[1]} r={data[i].partial ? 3.5 : 3}
            fill={data[i].partial ? C.bg : C.primary}
            stroke={C.primary} strokeWidth={data[i].partial ? 2 : 0}
          />
          <text x={p[0]} y={p[1] - 8} textAnchor="middle" fontSize="10" fill={C.ink} fontWeight="600">
            {data[i][metric]}
          </text>
          <text x={p[0]} y={H - 8} textAnchor="middle" fontSize="9" fill={C.inkSoft}>
            {data[i].label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Analytics({ openAI }) {
  const [metric, setMetric] = useState("revenue");
  const metrics = {
    revenue: { title: "Доход", unit: "тыс. ₽" },
    sessions: { title: "Загрузка", unit: "сессий" },
  };

  // тренд: сравниваем последние 2 полные недели
  const full = WEEKLY.filter((w) => !w.partial);
  const last = full[full.length - 1][metric];
  const prev = full[full.length - 2][metric];
  const deltaPct = Math.round(((last - prev) / prev) * 100);
  const up = deltaPct >= 0;

  const totalRev = WEEKLY.reduce((s, w) => s + w.revenue, 0);
  const totalSess = WEEKLY.reduce((s, w) => s + w.sessions, 0);
  const totalFree = WEEKLY.reduce((s, w) => s + w.freeSlots, 0);
  const fill = Math.round((totalSess / (totalSess + totalFree)) * 100);

  const funnelMax = FUNNEL[0].value;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <H1>Аналитика</H1>
        <button
          onClick={() => openAI("Проанализируй мои недельные тренды дохода и загрузки, воронку привлечения и итоги прошлого месяца. Составь пошаговый план выхода на доход x2 в следующем месяце: посчитай арифметику цели, предложи 2-3 реалистичных сценария и честно отметь риски.")}
          className="flex items-center gap-1.5 text-[13px] px-3.5 py-2 rounded-xl shrink-0"
          style={{ background: C.primary, color: "#fff" }}
        >
          <Sparkles size={15} /> Разбор ИИ
        </button>
      </div>

      {/* Ключевые показатели */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3">
          <div className="flex items-center gap-1" style={{ color: up ? C.primary : C.accent }}>
            {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span className="text-sm font-medium">{up ? "+" : ""}{deltaPct}%</span>
          </div>
          <p className="text-[11px] mt-1" style={{ color: C.inkSoft }}>{metrics[metric].title} к пред. неделе</p>
        </Card>
        <Card className="p-3">
          <p className="text-lg" style={{ ...serif, color: C.ink }}>{fill}%</p>
          <p className="text-[11px] mt-0.5" style={{ color: C.inkSoft }}>Заполняемость окон</p>
        </Card>
        <Card className="p-3">
          <p className="text-lg" style={{ ...serif, color: C.ink }}>{totalFree}</p>
          <p className="text-[11px] mt-0.5" style={{ color: C.inkSoft }}>Свободных окон / 6 нед</p>
        </Card>
      </div>

      {/* Переключатель метрики + график */}
      <Card className="p-4">
        <div className="flex p-1 rounded-xl gap-1 mb-4" style={{ background: "#E9EDE9" }}>
          {Object.keys(metrics).map((k) => (
            <button
              key={k}
              onClick={() => setMetric(k)}
              className="flex-1 py-2 rounded-lg text-[13px]"
              style={{
                background: metric === k ? "#fff" : "transparent",
                color: metric === k ? C.ink : C.inkSoft,
                boxShadow: metric === k ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              {metrics[k].title}
            </button>
          ))}
        </div>
        <TrendChart data={WEEKLY} metric={metric} unit={metrics[metric].unit} />
        <p className="text-[11px] text-center mt-2" style={{ color: C.inkSoft }}>
          {metrics[metric].title}, {metrics[metric].unit} · последняя неделя неполная
        </p>
        <div className="flex justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
          <span className="text-[12px]" style={{ color: C.inkSoft }}>За 6 недель</span>
          <span className="text-[12px] font-medium" style={{ color: C.ink }}>
            {metric === "revenue" ? `${totalRev} тыс. ₽` : `${totalSess} сессий`}
          </span>
        </div>
      </Card>

      {/* Воронка */}
      <div>
        <p className="text-xs font-medium mb-2 tracking-wide" style={{ color: C.inkSoft }}>
          ВОРОНКА: КОНТЕНТ → КЛИЕНТЫ
        </p>
        <Card className="p-4 space-y-3">
          {FUNNEL.map((f, i) => {
            const w = Math.max(8, (f.value / funnelMax) * 100);
            const conv = i > 0 ? Math.round((f.value / FUNNEL[i - 1].value) * 100) : null;
            return (
              <div key={f.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px]" style={{ color: C.ink }}>{f.label}</span>
                  <span className="text-[13px] font-medium" style={{ color: C.ink }}>
                    {f.value.toLocaleString("ru")}
                  </span>
                </div>
                <div className="h-6 rounded-lg overflow-hidden flex items-center" style={{ background: C.bg }}>
                  <div
                    className="h-full rounded-lg flex items-center px-2"
                    style={{ width: `${w}%`, background: i === FUNNEL.length - 1 ? C.accent : C.primary, minWidth: 40 }}
                  >
                    {conv !== null && (
                      <span className="text-[10px] text-white whitespace-nowrap">{conv}%</span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: C.inkSoft }}>{f.sub}</p>
              </div>
            );
          })}
        </Card>
      </div>

      <Card className="p-3.5 flex items-start gap-2.5" onClick={() => openAI("Где в моей воронке контент → заявки → первичные → постоянные я теряю больше всего людей и что конкретно можно улучшить?")}>
        <Lightbulb size={16} className="mt-0.5 shrink-0" style={{ color: C.accent }} />
        <div className="flex-1">
          <p className="text-[13px] leading-snug" style={{ color: C.ink }}>
            До первичной доходит примерно каждая третья заявка — узкое место воронки. Спросить ИИ, как поднять конверсию?
          </p>
          <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: C.primary }}>
            Разобрать <ArrowRight size={12} />
          </p>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Финансы ---------- */

function Finance({ openAI }) {
  const rows = [
    { date: "9 июн", client: "Елена Тарасова", sum: "4 000 ₽", paid: true },
    { date: "8 июн", client: "Игорь Северин", sum: "4 000 ₽", paid: true },
    { date: "4 июн", client: "Дмитрий Калнс", sum: "5 000 ₽", paid: true },
    { date: "3 июн", client: "Анна Морозова", sum: "4 000 ₽", paid: false },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <H1>Финансы</H1>
        <button
          onClick={() => openAI("Проанализируй мою деятельность за прошлый месяц (доход, загрузку, средний чек, воронку из контента в заявки) и составь конкретный пошаговый план, как выйти на доход x2 в следующем месяце. Опирайся на реальные цифры практики, предложи реалистичные варианты и честно отметь риски.")}
          className="flex items-center gap-1.5 text-[13px] px-3.5 py-2 rounded-xl shrink-0"
          style={{ background: C.primarySoft, color: C.primary }}
        >
          <Sparkles size={15} /> Анализ бизнеса
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { l: "Июнь", v: "120 000 ₽" },
          { l: "Ожидает", v: "4 000 ₽" },
          { l: "Ср. чек", v: "4 300 ₽" },
        ].map((s) => (
          <Card key={s.l} className="p-3 text-center">
            <p className="text-lg" style={{ ...serif, color: C.ink }}>{s.v}</p>
            <p className="text-[11px] mt-0.5" style={{ color: C.inkSoft }}>{s.l}</p>
          </Card>
        ))}
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <Card key={i} className="p-3.5 flex items-center gap-3">
            <p className="text-[12px] w-12 shrink-0" style={{ color: C.inkSoft }}>{r.date}</p>
            <p className="text-sm flex-1 truncate" style={{ color: C.ink }}>{r.client}</p>
            <p className="text-sm font-medium" style={{ color: C.ink }}>{r.sum}</p>
            <Tag tone={r.paid ? "green" : "clay"}>{r.paid ? "Оплачено" : "Ожидает"}</Tag>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------- Каркас приложения ---------- */

export default function PsyCRMMobileAI() {
  const [tab, setTab] = useState("dashboard");
  const [clientId, setClientId] = useState(null);
  const [query, setQuery] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPreset, setAiPreset] = useState("");

  const NAV = [
    { id: "dashboard", label: "Сегодня", icon: LayoutDashboard },
    { id: "clients", label: "Клиенты", icon: Users },
    { id: "content", label: "Контент", icon: PenLine },
    { id: "analytics", label: "Аналитика", icon: BarChart3 },
    { id: "finance", label: "Финансы", icon: Wallet },
  ];

  const openAI = (preset = "") => {
    setAiPreset(preset);
    setAiOpen(true);
  };

  const openClientByName = (name) => {
    const c = CLIENTS.find((x) => x.name === name);
    if (c) { setClientId(c.id); setTab("clients"); }
  };

  const client = CLIENTS.find((c) => c.id === clientId);

  return (
    <div className="min-h-screen max-w-md mx-auto flex flex-col" style={{ background: C.bg }}>
      <header
        className="px-4 py-3 flex items-center justify-between sticky top-0 z-10"
        style={{ background: C.bg, borderBottom: `1px solid ${C.line}` }}
      >
        <p className="text-base" style={{ ...serif, color: C.ink }}>Практика</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setTab("calendar"); setClientId(null); }}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              background: tab === "calendar" ? C.primary : C.primarySoft,
              color: tab === "calendar" ? "#fff" : C.primary,
            }}
            aria-label="Календарь"
          >
            <Calendar size={16} />
          </button>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs"
            style={{ background: C.primarySoft, color: C.primary, ...serif }}
          >
            ЕК
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 pb-28 overflow-y-auto">
        {tab === "dashboard" && <Dashboard openClient={openClientByName} openAI={openAI} />}
        {tab === "calendar" && <CalendarView />}
        {tab === "clients" && !client && (
          <ClientList open={setClientId} query={query} setQuery={setQuery} />
        )}
        {tab === "clients" && client && (
          <ClientCard client={client} back={() => setClientId(null)} openAI={openAI} />
        )}
        {tab === "content" && <ContentView openAI={openAI} />}
        {tab === "analytics" && <Analytics openAI={openAI} />}
        {tab === "finance" && <Finance openAI={openAI} />}
      </main>

      <button
        onClick={() => openAI()}
        className="fixed bottom-24 right-4 p-3.5 rounded-full shadow-lg z-20 active:scale-95 transition-transform"
        style={{ background: C.primary }}
        aria-label="Открыть ИИ-ассистента"
      >
        <Sparkles size={22} color="#fff" />
      </button>

      <nav
        className="fixed bottom-0 left-0 right-0 max-w-md mx-auto flex justify-around px-2 pt-2 pb-4 z-10"
        style={{ background: "#fff", borderTop: `1px solid ${C.line}` }}
      >
        {NAV.map((n) => {
          const active = tab === n.id;
          return (
            <button
              key={n.id}
              onClick={() => { setTab(n.id); setClientId(null); }}
              className="flex flex-col items-center gap-1 px-2 py-1 rounded-xl"
              style={{ color: active ? C.primary : C.inkSoft }}
            >
              <n.icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-[10px]" style={{ fontWeight: active ? 600 : 400 }}>
                {n.label}
              </span>
            </button>
          );
        })}
      </nav>

      {aiOpen && (
        <AIChat
          onClose={() => { setAiOpen(false); setAiPreset(""); }}
          presetPrompt={aiPreset}
        />
      )}
    </div>
  );
}
