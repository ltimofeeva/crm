// Чат с ассистентом. Диалоги сохраняются на устройстве (до 10):
// панель слева — список последних диалогов и кнопка нового, как в Claude.

import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { C } from "../theme";
import { PrimaryButton } from "../components/ui";
import { sendChat, buildFullContext, UNPACK_SYSTEM } from "../api/ai";
import { getChatState, saveChatState } from "../storage/store";
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
  const [convos, setConvos] = useState([]);
  const [input, setInput] = useState(route.params?.preset || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [system, setSystem] = useState("");
  const [ready, setReady] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const scrollRef = useRef(null);
  const activeIdRef = useRef(null);

  useEffect(() => {
    (async () => {
      let s = await buildFullContext();
      // Режим «распаковки» из настроек: добавляем роль интервьюера.
      if (route.params?.unpack) s = `${s}\n\n${UNPACK_SYSTEM}`;
      setSystem(s);
      const st = await getChatState();
      setConvos(st.list || []);
      activeIdRef.current = st.activeId || null;
      const active = (st.list || []).find((c) => c.id === st.activeId);
      setMessages(active?.messages || []);
      setReady(true);
    })();
  }, [route.params?.unpack]);

  // Сохраняем активный диалог после каждого изменения.
  useEffect(() => {
    if (!ready || messages.length === 0) return;
    let id = activeIdRef.current;
    if (!id) {
      id = Date.now();
      activeIdRef.current = id;
    }
    setConvos((prev) => {
      const title = (messages.find((m) => m.role === "user")?.content || "Диалог").slice(0, 42);
      const exists = prev.some((c) => c.id === id);
      const list = (exists
        ? prev.map((c) => (c.id === id ? { ...c, messages, updatedAt: Date.now() } : c))
        : [{ id, title, messages, updatedAt: Date.now() }, ...prev]
      ).slice(0, 10);
      saveChatState({ activeId: id, list });
      return list;
    });
  }, [messages, ready]);

  const newChat = () => {
    activeIdRef.current = null;
    setMessages([]);
    setError(null);
    setPanelOpen(false);
    saveChatState({ activeId: null, list: convos });
  };

  const switchTo = (c) => {
    activeIdRef.current = c.id;
    setMessages(c.messages || []);
    setError(null);
    setPanelOpen(false);
    saveChatState({ activeId: c.id, list: convos });
  };

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
      setError("Не удалось получить ответ. Проверьте интернет и попробуйте ещё раз.");
      setMessages((p) => p.slice(0, -1)); setInput(userText);
    } finally {
      setLoading(false);
    }
  };

  // Функции ИИ доступны только по подписке «Помощник Про».
  if (!subLoading && !isPro) {
    return (
      <View style={styles.lockWrap}>
        <Text style={styles.lockTitle}>Ассистент доступен в «Помощник Про»</Text>
        <Text style={styles.lockText}>
          Подготовка к сессиям, анализ клиентов, напоминания, идеи контента и
          тексты сообщений — в полной подписке «Помощник Про».
        </Text>
        <PrimaryButton title="Оформить подписку" onPress={() => navigation.navigate("Paywall")} />
      </View>
    );
  }

  const fmtDate = (ts) => new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Верхняя панель чата: диалоги и новый диалог */}
      <View style={styles.topBar}>
        <Pressable onPress={() => setPanelOpen(true)} style={styles.topBtn}>
          <Text style={styles.topBtnT}>☰ Диалоги{convos.length ? ` (${convos.length})` : ""}</Text>
        </Pressable>
        <Pressable onPress={newChat} style={styles.topBtn}>
          <Text style={styles.topBtnT}>＋ Новый</Text>
        </Pressable>
      </View>

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

      {/* Панель диалогов слева */}
      {panelOpen && (
        <View style={styles.overlay}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Диалоги</Text>
            <Pressable onPress={newChat} style={styles.panelNew}>
              <Text style={styles.panelNewT}>＋ Новый диалог</Text>
            </Pressable>
            <ScrollView>
              {convos.length === 0 && (
                <Text style={styles.panelEmpty}>Пока нет сохранённых диалогов.</Text>
              )}
              {convos.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => switchTo(c)}
                  style={[styles.panelItem, c.id === activeIdRef.current && styles.panelItemActive]}
                >
                  <Text style={styles.panelItemT} numberOfLines={2}>{c.title}</Text>
                  <Text style={styles.panelItemD}>{fmtDate(c.updatedAt)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <Pressable style={styles.backdrop} onPress={() => setPanelOpen(false)} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  lockWrap: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  lockTitle: { fontSize: 17, fontWeight: "600", color: C.ink, textAlign: "center" },
  lockText: { fontSize: 13, color: C.inkSoft, textAlign: "center", lineHeight: 19, marginBottom: 8 },
  topBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 10, gap: 8 },
  topBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  topBtnT: { fontSize: 12, color: C.ink, fontWeight: "600" },
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
  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: "row" },
  panel: { width: "76%", maxWidth: 340, backgroundColor: C.white, borderRightWidth: 1, borderRightColor: C.line, padding: 14, paddingTop: 16 },
  backdrop: { flex: 1, backgroundColor: "rgba(36,51,44,0.35)" },
  panelTitle: { fontSize: 16, fontWeight: "700", color: C.ink, marginBottom: 10 },
  panelNew: { backgroundColor: C.primarySoft, borderRadius: 12, padding: 12, marginBottom: 12 },
  panelNewT: { fontSize: 13, color: C.primary, fontWeight: "700" },
  panelEmpty: { fontSize: 12, color: C.inkSoft, lineHeight: 17 },
  panelItem: { paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10, marginBottom: 2 },
  panelItemActive: { backgroundColor: C.bg },
  panelItemT: { fontSize: 13, color: C.ink, lineHeight: 18 },
  panelItemD: { fontSize: 11, color: C.inkSoft, marginTop: 2 },
});
