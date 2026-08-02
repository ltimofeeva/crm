import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { C, S, R, SHADOW, SERIF } from "../theme";

// Значок «мозг» в правом верхнем углу экрана — открывает ассистента
// с сохранёнными диалогами.
export function BrainButton({ onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.brain, pressed && { opacity: 0.85 }]}
    >
      <Text style={{ fontSize: 18 }}>🧠</Text>
    </Pressable>
  );
}

export function Card({ children, style, onPress }) {
  // ВАЖНО: функцию в style понимает только Pressable. У обычного View такой
  // style молча игнорируется — и карточка теряет фон, отступы и скругление.
  // Поэтому для некликабельных карточек передаём обычный массив стилей.
  if (!onPress) {
    return <View style={[styles.card, style]}>{children}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        style,
        pressed ? { opacity: 0.9 } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function Tag({ children, tone = "green" }) {
  const clay = tone === "clay";
  return (
    <View style={[styles.tag, { backgroundColor: clay ? C.accentSoft : C.primarySoft }]}>
      <Text style={[styles.tagText, { color: clay ? C.accent : C.primary }]}>{children}</Text>
    </View>
  );
}

export function H1({ children, sub }) {
  return (
    <View style={{ marginBottom: S.lg }}>
      <Text style={[styles.h1, SERIF]}>{children}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

export function PrimaryButton({ title, onPress, icon, tone = "primary" }) {
  const bg = tone === "soft" ? C.primarySoft : tone === "accent" ? C.accent : C.primary;
  const fg = tone === "soft" ? C.primary : C.white;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg },
        tone !== "soft" && SHADOW.soft,
        pressed && { opacity: 0.9 },
      ]}
    >
      {icon}
      <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  brain: {
    width: 40, height: 40, borderRadius: R.pill, backgroundColor: C.white,
    borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center",
    ...SHADOW.soft,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.lineSoft,
    ...SHADOW.card,
  },
  tag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: R.pill, alignSelf: "flex-start" },
  tagText: { fontSize: 11, fontWeight: "600" },
  h1: { fontSize: 24, color: C.ink, lineHeight: 28, letterSpacing: -0.3 },
  sub: { fontSize: 13, color: C.inkSoft, marginTop: 5, lineHeight: 18 },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 11, borderRadius: R.md,
  },
  btnText: { fontSize: 13, fontWeight: "700" },
});
