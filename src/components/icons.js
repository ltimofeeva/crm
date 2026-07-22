// Набор линейных иконок в стиле нижнего меню (react-native-svg).
// Используются в карточке клиента: редактировать, удалить, отмена, сохранить.

import React from "react";
import Svg, { Path, Line, Polyline } from "react-native-svg";

function Base({ children, size = 22, color = "#000", sw = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
}

// Карандаш — «редактировать»
export function PencilIcon(p) {
  return (
    <Base {...p}>
      <Path d="M12 20h9" />
      <Path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </Base>
  );
}

// Корзина — «удалить»
export function TrashIcon(p) {
  return (
    <Base {...p}>
      <Path d="M3 6h18" />
      <Path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <Line x1="10" y1="11" x2="10" y2="17" />
      <Line x1="14" y1="11" x2="14" y2="17" />
    </Base>
  );
}

// Крестик — «отмена»
export function CloseIcon(p) {
  return (
    <Base {...p}>
      <Line x1="6" y1="6" x2="18" y2="18" />
      <Line x1="18" y1="6" x2="6" y2="18" />
    </Base>
  );
}

// Дискета — «сохранить»
export function SaveIcon(p) {
  return (
    <Base {...p}>
      <Path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <Polyline points="17 21 17 13 7 13 7 21" />
      <Polyline points="7 3 7 8 15 8" />
    </Base>
  );
}
