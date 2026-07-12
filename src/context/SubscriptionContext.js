// Контекст подписки: один источник правды о доступности функций.
//
// Уровни доступа:
// - Пробный период 4 дня с первого запуска: доступно всё.
// - «Помощник» (basic): базовый функционал приложения (CRM, календарь, контент).
// - «Помощник Про» (pro): дополнительно все функции ИИ.
// - Биллинг не настроен (режим разработки): всё открыто.
//
// isBasic — можно ли пользоваться приложением; isPro — доступен ли ИИ.

import React, {
  createContext, useContext, useEffect, useState, useCallback,
} from "react";
import {
  configurePurchases, getSubscriptionTier, isBillingConfigured, TRIAL_DAYS,
  identifyUser,
} from "../api/purchases";
import { getInstalledAt } from "../storage/store";
import { useAuth } from "./AuthContext";

const SubscriptionContext = createContext({
  tier: "dev",          // dev | trial | none | basic | pro
  isBasic: true,        // доступен ли базовый функционал
  isPro: true,          // доступны ли функции ИИ
  trialDaysLeft: 0,
  billingEnabled: false,
  loading: true,
  refresh: async () => {},
});

export function SubscriptionProvider({ children }) {
  const { user } = useAuth();
  const appUserId = user?.id || null;
  const [state, setState] = useState({
    tier: "dev", isBasic: true, isPro: true, trialDaysLeft: 0,
    billingEnabled: false, loading: true,
  });

  const refresh = useCallback(async () => {
    try {
      await configurePurchases();
      // Подписка проверяется по аккаунту: привязываем покупки к логину.
      if (appUserId) await identifyUser(appUserId);
      const billingEnabled = isBillingConfigured();
      const tier = await getSubscriptionTier();

      const installedAt = await getInstalledAt();
      const daysUsed = (Date.now() - installedAt) / 86400000;
      const trialDaysLeft = Math.max(0, Math.ceil(TRIAL_DAYS - daysUsed));
      const trialActive = trialDaysLeft > 0;

      let isBasic;
      let isPro;
      let effectiveTier = tier;
      if (tier === "dev") {
        isBasic = true; isPro = true;
      } else if (tier === "pro") {
        isBasic = true; isPro = true;
      } else if (tier === "basic") {
        isBasic = true; isPro = false;
      } else {
        // Подписки нет: во время пробного периода открыто всё.
        isBasic = trialActive; isPro = trialActive;
        effectiveTier = trialActive ? "trial" : "none";
      }

      setState({
        tier: effectiveTier, isBasic, isPro, trialDaysLeft,
        billingEnabled, loading: false,
      });
    } catch (e) {
      // При ошибке не блокируем приложение.
      setState((s) => ({ ...s, loading: false }));
    }
  }, [appUserId]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <SubscriptionContext.Provider value={{ ...state, refresh }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
