import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { C, SERIF } from "../theme";

// Ссылка «Вернуться в чат» — открывает ассистента с сохранённой историей.
export function ChatReturnLink({ onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.chatLink}>
      <Text style={styles.chatLinkT}>💬 Вернуться в чат →</Text>
    </Pressable>
  );
}

export function Card({ children, style, onPress }) {
  const Comp = onPress ? Pressable : View;
  return (
    <Comp
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        style,
        onPress && pressed ? { opacity: 0.85 } : null,
      ]}
    >
      {children}
    </Comp>
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
    <View style={{ marginBottom: 16 }}>
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
      style={({ pressed }) => [styles.btn, { backgroundColor: bg, opacity: pressed ? 0.9 : 1 }]}
    >
      {icon}
      <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chatLink: { alignSelf: "flex-start", marginBottom: 10 },
  chatLinkT: { fontSize: 12, color: C.primary, fontWeight: "600" },
  card: {
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
  },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, alignSelf: "flex-start" },
  tagText: { fontSize: 11 },
  h1: { fontSize: 22, color: C.ink, lineHeight: 26 },
  sub: { fontSize: 13, color: C.inkSoft, marginTop: 4 },
  btn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  btnText: { fontSize: 13, fontWeight: "600" },
});
