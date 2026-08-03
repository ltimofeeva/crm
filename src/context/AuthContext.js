// Контекст авторизации: аккаунты и данные хранятся на СЕРВЕРЕ, поэтому вход
// работает с любого устройства. Локально держим только токен сессии (для
// «запомнить меня») и кэш данных (подтягивается с сервера при входе).

import React, {
  createContext, useContext, useEffect, useState, useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  apiRegister, apiLogin, apiLogout, apiGetData, setApiToken,
} from "../api/backend";
import {
  setSyncToken, importAll, clearUserData, pushAllNow,
} from "../storage/store";

const SESSION_KEY = "practice.session.v2"; // { token, user }

const AuthContext = createContext({
  user: null,
  loading: true,
  signIn: async () => ({ ok: false }),
  signUp: async () => ({ ok: false }),
  signOut: async () => {},
});

async function saveSession(token, user) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }));
}
async function readSession() {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
async function clearSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // При старте: если была сессия «запомнить меня» — входим и подтягиваем
  // данные с сервера.
  useEffect(() => {
    (async () => {
      try {
        const session = await readSession();
        if (session?.token) {
          setSyncToken(session.token); setApiToken(session.token);
          setUser(session.user);
          try {
            const data = await apiGetData(session.token);
            await importAll(data);
          } catch (e) {
            if (e.message === "unauthorized") {
              // Токен больше не действует — выходим.
              setSyncToken(null); setApiToken(null);
              await clearSession();
              await clearUserData();
              setUser(null);
            }
            // при сетевой ошибке остаёмся с локальным кэшем
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async ({ login, password, remember }) => {
    try {
      const { token, user: u } = await apiLogin(login, password);
      setSyncToken(token); setApiToken(token);
      // Загружаем данные аккаунта с сервера (заменяют локальные).
      try {
        const data = await apiGetData(token);
        await importAll(data);
      } catch (e) { /* нет сети — покажем что есть, синхронизируется позже */ }
      setUser(u);
      if (remember) await saveSession(token, u); else await clearSession();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, []);

  const signUp = useCallback(async ({ login, password, remember }) => {
    try {
      const { token, user: u } = await apiRegister(login, password);
      setSyncToken(token); setApiToken(token);
      // Новый аккаунт: переносим на сервер уже введённые локально данные
      // (если что-то есть), чтобы не потерялись.
      await pushAllNow();
      setUser(u);
      if (remember) await saveSession(token, u); else await clearSession();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, []);

  const signOut = useCallback(async () => {
    const session = await readSession();
    setSyncToken(null); setApiToken(null);
    await clearSession();
    await clearUserData();
    setUser(null);
    if (session?.token) apiLogout(session.token);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
