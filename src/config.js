import Constants from "expo-constants";

// URL вашего бэкенда (прокси к Claude API). Меняется в app.json → extra.backendUrl,
// либо здесь напрямую. Для запуска на телефоне через Expo Go localhost НЕ подойдёт —
// нужен адрес в локальной сети (например http://192.168.1.50:8787) или туннель.
// Подробности в README.md, раздел «Шаг 5».
export const BACKEND_URL =
  Constants?.expoConfig?.extra?.backendUrl ||
  Constants?.manifest?.extra?.backendUrl ||
  // Рабочий сервер ИИ (Vercel). Используется, если адрес из app.json не
  // подставился при сборке (так бывает в веб-сборке Expo).
  "https://crm-ujn8.vercel.app";
