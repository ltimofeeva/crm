import React, { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ScrollView, View, Text, TextInput, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { C, SERIF } from "../theme";
import * as Clipboard from "expo-clipboard";
import { Card, Tag, PrimaryButton } from "../components/ui";
import { getClients, getEvents, addSessionNote, updateClient } from "../storage/store";
import { analyzeClient, buildFullContext } from "../api/ai";
import { useSubscription } from "../context/SubscriptionContext";
import { currentAge, yearsWord, formatBirthDate } from "../utils/birthday";
import { formatPhone } from "../utils/phone";
import { CONTACT_CHANNELS } from "./ClientsScreen";

const TREND = {
  up: { label: "↑ Динамика положительная", tone: "green" },
  flat: { label: "→ Стабильно", tone: "green" },
  down: { label: "↓ Требует внимания", tone: "clay" },
};

// Склонение посещений: 1 сессия, 2 сессии, 5 сессий.
function sessionsWord(n) {
  const d10 = n % 10, d100 = n % 100;
  if (d10 === 1 && d100 !== 11) return "сессия";
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return "сессии";
  return "сессий";
}

// «15 июля, 14:00» для ближайшей записи.
function fmtNext(e) {
  const [y, m, d] = e.date.split("-").map(Number);
  const day = new Date(y, m - 1, d).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  return `${day}, ${e.time}`;
}

export default function ClientDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { isPro } = useSubscription();
  const [client, setClient] = useState(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [aState, setAState] = useState("idle"); // idle | loading | done | error
  const [copied, setCopied] = useState(false);
  const [nextEvent, setNextEvent] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);

  const copyPhone = async () => {
    if (!client?.phone) return;
    await Clipboard.setStringAsync(client.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const reload = useCallback(async () => {
    const all = await getClients();
    setClient(all.find((c) => c.id === id) || null);
    // Ближайшая запись клиента из календаря.
    const now = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const nowStamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}`;
    const upcoming = (await getEvents())
      .filter((e) => e.clientId === id && `${e.date} ${e.time}` >= nowStamp)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    setNextEvent(upcoming[0] || null);
  }, [id]);
  // Перечитываем при каждом возврате на экран — чтобы заметки из событий
  // и другие изменения появлялись сразу.
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

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
      const system = await buildFullContext();
      const res = await analyzeClient({ client, system });
      setAnalysis(res); setAState("done");
    } catch (e) {
      setAState("error");
    }
  };

  const trend = analysis ? (TREND[analysis.trend] || TREND.flat) : null;

  const openEdit = () => {
    setEditForm({
      name: client.name || "",
      birthDate: client.birthDate || "",
      request: client.request || "",
      format: client.format || "",
      phone: client.phone || "",
      contactVia: client.contactVia || "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editForm.name.trim()) return;
    await updateClient(client.id, {
      name: editForm.name.trim(),
      birthDate: editForm.birthDate.trim(),
      request: editForm.request.trim(),
      format: editForm.format.trim(),
      phone: editForm.phone.trim(),
      contactVia: editForm.contactVia,
    });
    setEditOpen(false);
    reload();
  };

  const setE = (key) => (v) => setEditForm((f) => ({ ...f, [key]: v }));

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Card style={styles.head}>
        {!editOpen ? (
          <>
            <View style={styles.headTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, SERIF]}>{client.name}</Text>
                <Text style={styles.meta}>
                  {client.birthDate
                    ? `🎂 ${client.birthDate}${(() => { const a = currentAge(client.birthDate); return a != null ? ` (${a} ${yearsWord(a)})` : ""; })()}`
                    : (client.age ? `${client.age} лет` : "")}
                </Text>
              </View>
              <Tag tone={client.status === "Пауза" ? "clay" : "green"}>{client.status}</Tag>
            </View>
            <View style={styles.field}><Text style={styles.fieldL}>Запрос</Text><Text style={styles.fieldV}>{client.request || "—"}</Text></View>
            <View style={styles.field}>
              <Text style={styles.fieldL}>Кол-во посещений</Text>
              <Text style={styles.fieldV}>{client.sessionsCount || 0} {sessionsWord(client.sessionsCount || 0)}</Text>
            </View>
            <View style={styles.field}><Text style={styles.fieldL}>Формат</Text><Text style={styles.fieldV}>{client.format || "—"}</Text></View>
            <View style={styles.field}><Text style={styles.fieldL}>Связаться в</Text><Text style={styles.fieldV}>{client.contactVia || "—"}</Text></View>
            <View style={styles.field}>
              <Text style={styles.fieldL}>Контакт</Text>
              <Text style={styles.fieldV}>{client.phone || "—"}</Text>
              {client.phone ? (
                <Text style={styles.copyLink} onPress={copyPhone}>
                  {copied ? "Скопировано ✓" : "⧉ Скопировать номер"}
                </Text>
              ) : null}
            </View>
            <Text style={styles.next}>Следующая запись: {nextEvent ? fmtNext(nextEvent) : "—"}</Text>
            <Text style={styles.editLink} onPress={openEdit}>✎ Редактировать карточку</Text>
          </>
        ) : (
          <>
            <Text style={styles.editTitle}>Редактирование карточки</Text>
            <TextInput value={editForm.name} onChangeText={setE("name")} placeholder="Имя и фамилия *" placeholderTextColor={C.inkSoft} style={styles.input} />
            <TextInput
              value={editForm.birthDate}
              onChangeText={(v) => setEditForm((f) => ({ ...f, birthDate: formatBirthDate(v) }))}
              placeholder="Дата рождения: ДД.ММ.ГГГГ" placeholderTextColor={C.inkSoft}
              keyboardType="numeric" maxLength={10} style={styles.input}
            />
            <TextInput value={editForm.request} onChangeText={setE("request")} placeholder="Запрос" placeholderTextColor={C.inkSoft} style={styles.input} />
            <TextInput value={editForm.format} onChangeText={setE("format")} placeholder="Формат: Онлайн / Кабинет" placeholderTextColor={C.inkSoft} style={styles.input} />
            <TextInput
              value={editForm.phone}
              onChangeText={(v) => setEditForm((f) => ({ ...f, phone: formatPhone(v) }))}
              placeholder="+7 (___) ___-__-__" placeholderTextColor={C.inkSoft}
              keyboardType="phone-pad" maxLength={18} style={styles.input}
            />
            <Text style={styles.fieldL}>Связаться в</Text>
            <View style={styles.channelRow}>
              {CONTACT_CHANNELS.map((ch) => (
                <Pressable
                  key={ch}
                  onPress={() => setEditForm((f) => ({ ...f, contactVia: f.contactVia === ch ? "" : ch }))}
                  style={[styles.channelChip, editForm.contactVia === ch && styles.channelChipOn]}
                >
                  <Text style={[styles.channelT, editForm.contactVia === ch && styles.channelTOn]}>{ch}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.actions}>
              <View style={{ flex: 1 }}><PrimaryButton title="Отмена" tone="soft" onPress={() => setEditOpen(false)} /></View>
              <View style={{ flex: 1 }}><PrimaryButton title="Сохранить" tone="accent" onPress={saveEdit} /></View>
            </View>
          </>
        )}
      </Card>

      {!noteOpen && (
        <View style={styles.actions}>
          <View style={{ flex: 1 }}><PrimaryButton title="Заметка" tone="accent" onPress={() => setNoteOpen(true)} /></View>
          <View style={{ flex: 1 }}><PrimaryButton title="Проанализировать клиента" tone="soft" onPress={runAnalysis} /></View>
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
          {analysis.results?.length ? (
            <>
              <Text style={styles.aLabel}>Результаты по сессиям</Text>
              {analysis.results.map((t, i) => <Text key={i} style={styles.bullet}>— {t}</Text>)}
            </>
          ) : null}
          {analysis.products?.length ? (
            <>
              <Text style={styles.aLabel}>Какие продукты могут подойти</Text>
              {analysis.products.map((t, i) => <Text key={i} style={styles.bullet}>— {t}</Text>)}
            </>
          ) : null}
          {analysis.approach ? (
            <>
              <Text style={styles.aLabel}>Как взаимодействовать</Text>
              <Text style={styles.bullet}>{analysis.approach}</Text>
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

      {(client.touches || []).length > 0 && (
        <>
          <Text style={styles.section}>СВЯЗЬ С КЛИЕНТОМ</Text>
          {(client.touches || []).map((t) => (
            <Card key={t.id} style={styles.touch}>
              <View style={styles.touchTop}>
                <Text style={styles.touchType}>
                  {t.type === "Звонок" ? "📞" : t.type === "Встреча" ? "🤝" : "💬"} {t.type}
                </Text>
                <Text style={styles.touchDate}>{t.date ? t.date.split("-").reverse().join(".") : ""}</Text>
              </View>
              {t.note ? <Text style={styles.touchNote}>{t.note}</Text> : null}
              {t.reason ? <Text style={styles.touchReason}>Повод: {t.reason}</Text> : null}
            </Card>
          ))}
        </>
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
      {(client.sessions || []).map((s, idx) => (
        <Card key={`${s.n}-${idx}`} style={styles.sess}>
          <View style={styles.sessTop}>
            <Text style={styles.sessN}>№{s.n}{s.date ? ` · ${s.date}` : ""}</Text>
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
  copyLink: { fontSize: 12, color: C.primary, fontWeight: "600", marginTop: 6 },
  next: { fontSize: 13, color: C.ink, marginTop: 10 },
  editLink: { fontSize: 13, color: C.primary, fontWeight: "600", marginTop: 10 },
  editTitle: { fontSize: 14, fontWeight: "600", color: C.ink, marginBottom: 10 },
  input: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.ink, marginBottom: 8,
  },
  channelRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  channelChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line },
  channelChipOn: { backgroundColor: C.primary, borderColor: C.primary },
  channelT: { fontSize: 12, color: C.ink },
  channelTOn: { color: C.white },
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
  touch: { padding: 12, marginBottom: 8 },
  touchTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  touchType: { fontSize: 13, fontWeight: "600", color: C.ink },
  touchDate: { fontSize: 11, color: C.inkSoft },
  touchNote: { fontSize: 13, color: C.ink, lineHeight: 18 },
  touchReason: { fontSize: 11, color: C.inkSoft, marginTop: 4, fontStyle: "italic" },
  sess: { padding: 14, marginBottom: 8 },
  sessTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  sessN: { fontSize: 13, fontWeight: "600", color: C.ink },
  sessNote: { fontSize: 13, color: C.inkSoft, lineHeight: 19 },
});
