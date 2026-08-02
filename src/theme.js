// Дизайн-токены приложения. Одно место для палитры, отступов, скруглений и
// теней — меняешь здесь, меняется во всём приложении.

// Палитра «тёплый минимализм»: спокойный фон, глубокая зелень как основной
// цвет, тёплая глина как акцент. Старые ключи сохранены, чтобы не ломать
// существующие экраны.
export const C = {
  bg: "#F4F6F3",        // фон приложения — чуть теплее и мягче
  surface: "#FFFFFF",   // карточки и поля
  ink: "#222E28",       // основной текст
  inkSoft: "#63706A",   // второстепенный текст
  inkFaint: "#98A29C",  // подписи, плейсхолдеры
  primary: "#2F5A49",   // основной зелёный
  primarySoft: "#E6EDE9",// светлая заливка зелёного
  accent: "#BE6E4B",    // тёплый акцент (глина)
  accentSoft: "#F6E9E1",// светлая заливка акцента
  line: "#E7ECE8",      // тонкие разделители
  lineSoft: "#F0F3F0",  // почти невидимые линии
  white: "#FFFFFF",
  danger: "#C2534B",    // удаление/ошибки
};

// Шкала отступов — кратно 4. Пользуйся ими вместо «магических» чисел.
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// Скругления углов.
export const R = { sm: 10, md: 14, lg: 18, pill: 999 };

// Мягкие тени (работают и в вебе через react-native-web). Лёгкая
// приподнятость вместо жёстких рамок — так интерфейс выглядит чище.
export const SHADOW = {
  card: {
    shadowColor: "#1C2B23",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  soft: {
    shadowColor: "#1C2B23",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
};

// В React Native нет Georgia на Android. Для реального проекта подключите шрифт
// через expo-font. Пока используем системную serif-подстановку.
export const SERIF = { fontFamily: undefined, fontWeight: "700" };
