// Контекст подписки: один источник правды о том, доступны ли платные
// (ИИ) функции. Экраны берут статус через useSubscription().

import React, {
  createContext, useContext, useEffect, useState, useCallback,
} from "react";
import {
  configurePurchases, hasActiveSubscription, isBillingConfigured,
} from "../api/purchases";

const SubscriptionContext = createContext({
  isPro: true,          // активна ли подписка (или биллинг не настроен)
  billingEnabled: false, // подключён ли реальный биллинг (RevenueCat)
  loading: true,
  refresh: async () => {},
});

export function SubscriptionProvider({ children }) {
  const [isPro, setIsPro] = useState(true);
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      await configurePurchases();
      setBillingEnabled(isBillingConfigured());
      setIsPro(await hasActiveSubscription());
    } catch (e) {
      // При ошибке не блокируем приложение.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <SubscriptionContext.Provider value={{ isPro, billingEnabled, loading, refresh }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
