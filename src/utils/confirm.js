// Кроссплатформенное окно подтверждения «Да/Нет».
// Alert.alert с кнопками не работает в браузере (react-native-web),
// поэтому на вебе используем window.confirm.

import { Alert, Platform } from "react-native";

export function confirmAsync(title, message, okText = "Да", cancelText = "Нет") {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: "cancel", onPress: () => resolve(false) },
      { text: okText, onPress: () => resolve(true) },
    ]);
  });
}
