// Иконки нижнего меню — аккуратные линейные значки на react-native-svg
// (без внешних библиотек). Цвет меняется по активности вкладки.

import React from "react";
import Svg, { Path, Circle, Rect, Line } from "react-native-svg";

// Каждая иконка рисуется в системе координат 24×24, обводкой.
function Icon({ children, size = 24, color = "#000", fill = "none", sw = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
      stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
}

const ICONS = {
  // Сегодня — лента дел на день
  Today: (p) => (
    <Icon {...p}>
      <Line x1="8" y1="6" x2="21" y2="6" />
      <Line x1="8" y1="12" x2="21" y2="12" />
      <Line x1="8" y1="18" x2="21" y2="18" />
      <Circle cx="3.5" cy="6" r="1" fill={p.color} stroke="none" />
      <Circle cx="3.5" cy="12" r="1" fill={p.color} stroke="none" />
      <Circle cx="3.5" cy="18" r="1" fill={p.color} stroke="none" />
    </Icon>
  ),
  // Календарь
  CalendarTab: (p) => (
    <Icon {...p}>
      <Rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <Line x1="3" y1="9" x2="21" y2="9" />
      <Line x1="8" y1="2.5" x2="8" y2="6" />
      <Line x1="16" y1="2.5" x2="16" y2="6" />
    </Icon>
  ),
  // Клиенты — два человека
  Clients: (p) => (
    <Icon {...p}>
      <Circle cx="9" cy="8" r="3.2" />
      <Path d="M3.5 20v-1.5a4.5 4.5 0 0 1 4.5-4.5h2a4.5 4.5 0 0 1 4.5 4.5V20" />
      <Path d="M16 5.2a3.2 3.2 0 0 1 0 6.1" />
      <Path d="M18.5 14.2a4.5 4.5 0 0 1 3 4.3V20" />
    </Icon>
  ),
  // Контент — карандаш
  Content: (p) => (
    <Icon {...p}>
      <Path d="M12 20h9" />
      <Path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </Icon>
  ),
  // Аналитика — столбцы
  Analytics: (p) => (
    <Icon {...p}>
      <Line x1="6" y1="20" x2="6" y2="13" />
      <Line x1="12" y1="20" x2="12" y2="4" />
      <Line x1="18" y1="20" x2="18" y2="9" />
    </Icon>
  ),
  // Ещё — шестерёнка
  Settings: (p) => (
    <Icon {...p} sw={1.8}>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
    </Icon>
  ),
};

export default function TabIcon({ route, color, size }) {
  const Cmp = ICONS[route];
  if (!Cmp) return null;
  return <Cmp color={color} size={size} />;
}
