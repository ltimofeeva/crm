import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { C } from "../theme";
import { PrimaryButton } from "../components/ui";
import { sendChat, buildFullContext, UNPACK_SYSTEM } from "../api/ai";
import { useSubscription } from "../context/SubscriptionContext";

const QUICK = [
  "Подготовь меня к следующей сессии с клиентом",
  "Составь удобную структуру заметки после сессии",
  "3 идеи постов для продвижения практики",
  "Помоги посчитать план дохода на следующий месяц",
];

export default function AIChatScreen({ route, navigation }) {
  const { isPro, loading: subLoading } = useSubscription();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState(route.params?.preset || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [system, setSystem] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    (async () => {
      let s = await buildFullContext();
      // Режим «распаковки» из настроек: добавляем роль интервьюера.
      if (route.params?.unpack) s = `${s}\n\n${UNPACK_SYSTEM}`;
      setSystem(s);
    })();
  }, [route.params?.unpack]);

  const send = async (text) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;
    setError(null); setInput("");
    const history = [...messages, { role: "user", content: userText }];
    setMessages(history); setLoading(true);
    try {
      const reply = await sendChat({ messages: history, system });
      setMessages((p) => [...p, { role: "assistant", content: reply }]);
    } catch (e) {
      setError("Не удалось получить ответ. Проверьте, что бэкенд запущен и адрес в config.js верный.");
      setMessages((p) => p.slice(0, -1)); setInput(userText);
    } finally {
      setLoading(false);
    }
  };

  // ИИ-ассистент — платная функция: без активной подписки показываем замок.
  if (!subLoading && !isPro) {
    return (
      <View style={styles.lockWrap}>
        <Text style={styles.lockTitle}>Ассистент доступен по подписке</Text>
        <Text style={styles.lockText}>
          Подготовка к сессиям, анализ клиентов, бизнес-разбор и идеи контента —
          в подписке «Практика Про».
        </Text>
        <PrimaryButton title="Оформить подписку" onPress={() => navigation.navigate("Paywall")} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View style={{ paddingTop: 8 }}>
            <Text style={styles.intro}>Спросите про клиента, попросите подготовить к сессии, разобрать бизнес или придумать пост — у ассистента есть контекст всей практики.</Text>
            {QUICK.map((q) => (
              <Pressable key={q} onPress={() => send(q)} style={styles.quick}>
                <Text style={styles.quickText}>{q}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubbleRow, { justifyContent: m.role === "user" ? "flex-end" : "flex-start" }]}>
            <View style={[styles.bubble, m.role === "user" ? styles.user : styles.assistant]}>
              <Text style={[styles.bubbleText, { color: m.role === "user" ? C.white : C.ink }]}>{m.content}</Text>
            </View>
          </View>
        ))}
        {loading && <View style={styles.bubbleRow}><View style={[styles.bubble, styles.assistant]}><ActivityIndicator color={C.inkSoft} /></View></View>}
        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          value={input} onChangeText={setInput} multiline
          placeholder="Спросите ассистента…" placeholderTextColor={C.inkSoft}
          style={styles.input}
        />
        <Pressable onPress={() => send()} disabled={loading || !input.trim()} style={[styles.sendBtn, { opacity: loading || !input.trim() ? 0.4 : 1 }]}>
          <Text style={styles.sendText}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  lockWrap: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  lockTitle: { fontSize: 17, fontWeight: "600", color: C.ink, textAlign: "center" },
  lockText: { fontSize: 13, color: C.inkSoft, textAlign: "center", lineHeight: 19, marginBottom: 8 },
  scroll: { padding: 16 },
  intro: { fontSize: 13, color: C.inkSoft, textAlign: "center", lineHeight: 19, paddingHorizontal: 12, marginBottom: 16 },
  quick: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12, marginBottom: 8 },
  quickText: { fontSize: 13, color: C.ink },
  bubbleRow: { flexDirection: "row", marginBottom: 10 },
  bubble: { maxWidth: "85%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  user: { backgroundColor: C.primary, borderBottomRightRadius: 6 },
  assistant: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderBottomLeftRadius: 6 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  error: { fontSize: 12, color: C.accent, textAlign: "center", marginTop: 8 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg },
  input: { flex: 1, maxHeight: 120, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.ink },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  sendText: { color: C.white, fontSize: 18, fontWeight: "700" },
});
