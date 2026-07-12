// Контекст авторизации: кто вошёл, вход/выход, «запомнить меня».
// Аккаунты хранятся на устройстве (см. src/storage/auth.js).

import React, {
  createContext, useContext, useEffect, useState, useCallback,
} from "react";
import {
  registerAccount, loginAccount, getAccounts, getSession,
  saveSession, clearSession, publicAccount,
} from "../storage/auth";

const AuthContext = createContext({
  user: null,          // { id, loginType, display, email, phone } | null
  loading: true,
  signIn: async () => ({ ok: false }),
  signUp: async () => ({ ok: false }),
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // При старте: если была сессия «запомнить меня» — входим автоматически.
  useEffect(() => {
    (async () => {
      try {
        const session = await getSession();
        if (session?.accountId) {
          const account = (await getAccounts()).find((a) => a.id === session.accountId);
          if (account) setUser(publicAccount(account));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async ({ login, password, remember }) => {
    const res = await loginAccount({ login, password });
    if (!res.ok) return res;
    setUser(publicAccount(res.account));
    if (remember) await saveSession(res.account.id);
    else await clearSession();
    return { ok: true };
  }, []);

  const signUp = useCallback(async ({ login, password, remember }) => {
    const res = await registerAccount({ login, password });
    if (!res.ok) return res;
    setUser(publicAccount(res.account));
    if (remember) await saveSession(res.account.id);
    else await clearSession();
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
