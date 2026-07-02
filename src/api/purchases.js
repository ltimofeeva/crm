// Подписка через RevenueCat (react-native-purchases).
// RevenueCat — прослойка над встроенными покупками App Store и Google Play:
// один и тот же код работает и на iOS, и на Android, а статус подписки
// хранится на серверах RevenueCat (бесплатно до $2.5k дохода в месяц).
//
// Важно: нативный модуль покупок работает ТОЛЬКО в собранном приложении
// (EAS build / dev client), но НЕ в Expo Go. Поэтому здесь всё обёрнуто
// в проверки: если ключи RevenueCat не заданы или модуль недоступен —
// приложение работает в «режиме разработки» и ничего не блокирует.

import Constants from "expo-constants";
import { Platform } from "react-native";

const extra = Constants?.expoConfig?.extra || Constants?.manifest?.extra || {};

// Название «права» (entitlement) в RevenueCat, которое открывает ИИ-функции.
export const ENTITLEMENT_ID = extra.revenueCatEntitlement || "pro";

const API_KEY =
  Platform.OS === "ios" ? extra.revenueCatIosKey : extra.revenueCatAndroidKey;

let Purchases = null;
let configured = false;

function loadModule() {
  if (Purchases) return Purchases;
  try {
    // Лениво, чтобы Expo Go без нативного модуля не падал при импорте.
    Purchases = require("react-native-purchases").default;
  } catch (e) {
    Purchases = null;
  }
  return Purchases;
}

// Биллинг включён = ключи заданы и нативный модуль успешно настроен.
export function isBillingConfigured() {
  return configured;
}

// Вызывается один раз при старте приложения.
export async function configurePurchases() {
  if (configured) return true;
  if (!API_KEY) return false; // ключи не заданы — режим разработки
  const P = loadModule();
  if (!P) return false; // Expo Go: нативного модуля нет
  try {
    P.configure({ apiKey: API_KEY });
    configured = true;
    return true;
  } catch (e) {
    return false;
  }
}

// Активна ли подписка. Если биллинг не настроен — не блокируем функции,
// чтобы можно было разрабатывать и тестировать без магазинов.
export async function hasActiveSubscription() {
  if (!configured) return true;
  try {
    const info = await Purchases.getCustomerInfo();
    return !!info?.entitlements?.active?.[ENTITLEMENT_ID];
  } catch (e) {
    return false;
  }
}

// Список пакетов подписки (месяц/год…) из текущего Offering в RevenueCat.
export async function getSubscriptionPackages() {
  if (!configured) return [];
  const offerings = await Purchases.getOfferings();
  return offerings?.current?.availablePackages || [];
}

// Купить пакет. Возвращает true, если подписка стала активной.
export async function purchasePackage(pkg) {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
}

// Восстановить покупки (обязательная кнопка по правилам App Store).
export async function restorePurchases() {
  const customerInfo = await Purchases.restorePurchases();
  return !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
}
