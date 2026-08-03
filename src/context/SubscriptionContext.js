// Контекст подписки: один источник правды о доступности функций.
//
// Тариф и остаток лимитов считает СЕРВЕР (backend/plans.js + db.js) — здесь
// мы их только показываем. Так лимиты нельзя обойти из приложения, а расход
// считается по фактическим токенам ответа модели.
//
// Уровни:
// - «Бесплатный» — всё приложение работает, ИИ выключен.
// - «Помощник» / «Помощник Макс» — ИИ включён, с месячным лимитом.
// - Пробный период после регистрации — на условиях «Помощника».
//
// isBasic — можно ли пользоваться приложением (всегда true: бесплатный тариф
//           даёт полноценную CRM);
// isPro   — доступен ли ИИ прямо сейчас (тариф позволяет и лимит не исчерпан).

import React, {
  createContext, useContext, useEffect, useState, useCallback,
} from "react";
import { apiGetSubscription } from "../api/backend";
import { useAuth } from "./AuthContext";

const EMPTY = {
  planId: "free",
  planTitle: "Бесплатный",
  source: "free",
  trialDaysLeft: 0,
  ai: false,
  limits: { requests: 0, tokens: 0 },
  used: { requests: 0, tokens: 0 },
  left: { requests: 0, tokens: 0 },
};

const SubscriptionContext = createContext({
  ...EMPTY,
  isBasic: true,
  isPro: false,
  loading: true,
  refresh: async () => {},
});

export function SubscriptionProvider({ children }) {
  const { user } = useAuth();
  const token = user?.token || null;
  const [sub, setSub] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setSub(EMPTY); setLoading(false); return; }
    try {
      // Токен уже установлен в api/backend при входе — берём его оттуда.
      const { getApiToken } = await import("../api/backend");
      const t = getApiToken();
      if (!t) { setLoading(false); return; }
      const data = await apiGetSubscription(t);
      setSub(data);
    } catch (e) {
      // Нет связи — не блокируем приложение, оставляем прошлое состояние.
    } finally {
      setLoading(false);
    }
  }, [user, token]);

  useEffect(() => { refresh(); }, [refresh]);

  // ИИ доступен, если тариф это позволяет и остался лимит.
  const isPro = !!sub.ai && sub.left.requests > 0 && sub.left.tokens > 0;

  return (
    <SubscriptionContext.Provider
      value={{ ...sub, isBasic: true, isPro, loading, refresh }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
