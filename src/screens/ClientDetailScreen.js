import React, { useState, useEffect } from "react";
import { ScrollView, View, Text, TextInput, StyleSheet, ActivityIndicator } from "react-native";
import { C, SERIF } from "../theme";
import { Card, Tag, PrimaryButton } from "../components/ui";
import { getClients, addSessionNote } from "../storage/store";
import { analyzeClient, buildContext } from "../api/ai";
import { useSubscription } from "../context/SubscriptionContext";

const TREND = {
  up: { label: "↑ Динамика положительная", tone: "green" },
  flat: { label: "→ Стабильно", tone: "green" },
  down: { label: "↓ Требует внимания", tone: "clay" },
};

export default function ClientDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { isPro } = useSubscription();
  const [client, setClient] = useState(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [aState, setAState] = useState("idle"); // idle | loading | done | error

  const reload = async () => {
    const all = await getClients();
    setClient(all.find((c) => c.id === id) || null);
  };
  useEffect(() => { reload(); }, [id]);

  if (!client) return <View style={styles.wrap}><Text style={{ color: C.inkSoft }}>Загрузка…</Text></View>;

  const saveNote = async () => {
    if (!note.trim()) return;
    await addSessionNote(client.id, note.trim());
    setNote(""); setNoteOpen(false);
    reload();
  };

  const runAnalysis = async () => {
    // Анализ ИИ — платная функция: без подписки отправляем на экран оформления.
    if (!isPro) {
      navigation.navigate("Paywall");
      return;
    }
    setAState("loading");
    try {
      const all = await getClients();
      const res = await analyzeClient({ client, system: buildContext(all) });
      setAnalysis(res); setAState("done");
    } catch (e) {
      setAState("error");
    }
  };

  const trend = analysis ? (TREND[analysis.trend] || TREND.flat) : null;

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Card style={styles.head}>
        <View style={styles.headTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, SERIF]}>{client.name}</Text>
            <Text style={styles.meta}>
              {[client.age ? `${client.age} лет` : null, client.since ? `с ${client.since}` : null, `${client.sessionsCount || 0} сессий`].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <Tag tone={client.status === "Пауза" ? "clay" : "green"}>{client.status}</Tag>
        </View>
        <View style={styles.field}><Text style={styles.fieldL}>Запрос</Text><Text style={styles.fieldV}>{client.request || "—"}</Text></View>
        <View style={styles.field}><Text style={styles.fieldL}>Формат · контакт</Text><Text style={styles.fieldV}>{[client.format, client.phone].filter(Boolean).join(" · ") || "—"}</Text></View>
        <Text style={styles.next}>Следующая: {client.nextSession}</Text>
      </Card>

      {!noteOpen && (
        <View style={styles.actions}>
          <View style={{ flex: 1 }}><PrimaryButton title="Заметка" tone="accent" onPress={() => setNoteOpen(true)} /></View>
          <View style={{ flex: 1 }}><PrimaryButton title="Анализ ИИ" tone="soft" onPress={runAnalysis} /></View>
        </View>
      )}

      {noteOpen && (
        <Card style={{ padding: 14 }}>
          <TextInput
            value={note} onChangeText={setNote} multiline
            placeholder="Темы, динамика, домашнее задание…" placeholderTextColor={C.inkSoft}
            style={styles.textarea}
          />
          <View style={styles.actions}>
            <View style={{ flex: 1 }}><PrimaryButton title="Отмена" tone="soft" onPress={() => setNoteOpen(false)} /></View>
            <View style={{ flex: 1 }}><PrimaryButton title="Сохранить" tone="accent" onPress={saveNote} /></View>
          </View>
        </Card>
      )}

      {aState === "loading" && (
        <Card style={styles.analysis}><ActivityIndicator color={C.primary} /><Text style={styles.aLoad}>Ассистент читает заметки…</Text></Card>
      )}
      {aState === "error" && (
        <Card style={styles.analysis}><Text style={{ color: C.accent, fontSize: 13 }}>Не удалось получить анализ. Проверьте, что бэкенд запущен.</Text></Card>
      )}
      {aState === "done" && analysis && (
        <Card style={styles.analysis}>
          <View style={styles.aHeadRow}>
            <Text style={styles.aHead}>Анализ ИИ</Text>
            {trend && <Tag tone={trend.tone}>{trend.label}</Tag>}
          </View>
          <Text style={styles.aSummary}>{analysis.summary}</Text>
          {analysis.themes?.length ? (
            <>
              <Text style={styles.aLabel}>Ключевые темы</Text>
              <View style={styles.themeWrap}>{analysis.themes.map((t, i) => <Tag key={i}>{t}</Tag>)}</View>
            </>
          ) : null}
          {analysis.attention?.length ? (
            <>
              <Text style={styles.aLabel}>Обратить внимание</Text>
              {analysis.attention.map((t, i) => <Text key={i} style={styles.bullet}>— {t}</Text>)}
            </>
          ) : null}
          {analysis.questions?.length ? (
            <>
              <Text style={styles.aLabel}>Вопросы к следующей сессии</Text>
              {analysis.questions.map((t, i) => <Text key={i} style={styles.bullet}>— {t}</Text>)}
            </>
          ) : null}
          <Text style={styles.disclaimer}>Не клиническая оценка и не замена супервизии. Построено по вашим заметкам.</Text>
        </Card>
      )}

      <Text style={styles.section}>ИСТОРИЯ СЕССИЙ</Text>
      {(client.sessions || []).length === 0 && (
        <Card style={{ padding: 14 }}>
          <Text style={{ fontSize: 13, color: C.inkSoft, lineHeight: 19 }}>
            Пока нет заметок. После сессии нажмите «Заметка» и запишите главное —
            темы, динамику, договорённости. По этим записям ассистент будет
            готовить вас к следующим встречам.
          </Text>
        </Card>
      )}
      {(client.sessions || []).map((s) => (
        <Card key={s.n} style={styles.sess}>
          <View style={styles.sessTop}>
            <Text style={styles.sessN}>№{s.n} · {s.date}</Text>
            <Tag tone={s.mood?.startsWith("↓") ? "clay" : "green"}>{s.mood}</Tag>
          </View>
          <Text style={styles.sessNote}>{s.note}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  head: { padding: 16, marginBottom: 12 },
  headTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  title: { fontSize: 20, color: C.ink },
  meta: { fontSize: 12, color: C.inkSoft, marginTop: 2 },
  field: { backgroundColor: C.bg, borderRadius: 12, padding: 12, marginTop: 8 },
  fieldL: { fontSize: 11, color: C.inkSoft, marginBottom: 2 },
  fieldV: { fontSize: 13, color: C.ink },
  next: { fontSize: 13, color: C.ink, marginTop: 10 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  textarea: { minHeight: 90, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, fontSize: 14, color: C.ink, backgroundColor: C.bg, textAlignVertical: "top" },
  analysis: { padding: 16, marginTop: 12, alignItems: "flex-start" },
  aLoad: { fontSize: 13, color: C.inkSoft, marginTop: 8 },
  aHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: 6 },
  aHead: { fontSize: 14, fontWeight: "600", color: C.ink },
  aSummary: { fontSize: 13, color: C.ink, lineHeight: 19 },
  aLabel: { fontSize: 11, fontWeight: "600", color: C.inkSoft, letterSpacing: 0.3, marginTop: 12, marginBottom: 6 },
  themeWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  bullet: { fontSize: 13, color: C.inkSoft, lineHeight: 19, marginBottom: 2 },
  disclaimer: { fontSize: 11, color: C.inkSoft, marginTop: 12, fontStyle: "italic" },
  section: { fontSize: 12, fontWeight: "600", color: C.inkSoft, letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  sess: { padding: 14, marginBottom: 8 },
  sessTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  sessN: { fontSize: 13, fontWeight: "600", color: C.ink },
  sessNote: { fontSize: 13, color: C.inkSoft, lineHeight: 19 },
});
