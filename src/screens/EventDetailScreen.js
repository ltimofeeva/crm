// Карточка события: заметка и статус динамики (нет статуса / прогресс /
// стабильность / регресс). Открывается по нажатию на событие в «Сегодня»
// и в «Календаре».

import React, { useState, useEffect } from "react";
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import { confirmAsync } from "../utils/confirm";
import { C, SERIF } from "../theme";
import { Card, Tag, PrimaryButton } from "../components/ui";
import {
  getEvents, updateEvent, deleteEvent, syncEventToClientHistory,
} from "../storage/store";

const STATUSES = [
  { key: "none", label: "Нет статуса" },
  { key: "progress", label: "↑ Прогресс" },
  { key: "stable", label: "→ Стабильность" },
  { key: "regress", label: "↓ Регресс" },
];

function fmtDay(key) {
  const [y, m, d] = key.split("-").map(Number);
  const s = new Date(y, m - 1, d).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function EventDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const [event, setEvent] = useState(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("none");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const e = (await getEvents()).find((x) => x.id === id);
      if (e) { setEvent(e); setNote(e.note || ""); setStatus(e.status || "none"); }
    })();
  }, [id]);

  if (!event) return <View style={styles.wrap}><Text style={{ color: C.inkSoft }}>Загрузка…</Text></View>;

  const save = async () => {
    const updated = await updateEvent(id, { note: note.trim(), status });
    // Если событие привязано к клиенту — заметка и статус попадают
    // в его историю сессий (и увеличивают счётчик сессий).
    if (updated?.clientId && (note.trim() || status !== "none")) {
      await syncEventToClientHistory(updated);
    }
    // После сохранения окно закрывается автоматически.
    navigation.goBack();
  };

  const remove = async () => {
    const who = event.clientName || event.title;
    if (await confirmAsync(
      "Удаление события",
      `Вы действительно хотите удалить событие для ${who} на ${fmtDay(event.date)}, ${event.time}?`,
      "Удалить", "Отмена",
    )) {
      await deleteEvent(id);
      navigation.goBack();
    }
  };

  // Перенос: открываем календарь в режиме переноса — специалист листает
  // даты, жмёт «＋ Запись», данные подставляются автоматически.
  const goReschedule = () => {
    navigation.navigate("Root", { screen: "CalendarTab", params: { rescheduleId: id } });
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Card style={{ padding: 16 }}>
        <Text style={[styles.title, SERIF]}>{event.title}</Text>
        <Text style={styles.meta}>
          {fmtDay(event.date)} · {event.time} · {event.durationMin} мин
        </Text>
        {event.productName ? <View style={{ marginTop: 8 }}><Tag>{event.productName}</Tag></View> : null}
        <View style={{ marginTop: 12, alignSelf: "flex-start" }}>
          <PrimaryButton title="Перенести запись" tone="soft" onPress={goReschedule} />
        </View>
      </Card>

      <Text style={styles.section}>СТАТУС ВСТРЕЧИ</Text>
      <View style={styles.chipsRow}>
        {STATUSES.map((s) => (
          <Pressable key={s.key} onPress={() => setStatus(s.key)} style={[styles.chip, status === s.key && styles.chipOn]}>
            <Text style={[styles.chipT, status === s.key && styles.chipTOn]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>ЗАМЕТКА</Text>
      <Card style={{ padding: 12 }}>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="Что важно запомнить об этой встрече…"
          placeholderTextColor={C.inkSoft}
          style={styles.textarea}
        />
      </Card>

      <View style={styles.actions}>
        <View style={{ flex: 1 }}><PrimaryButton title="Удалить" tone="soft" onPress={remove} /></View>
        <View style={{ flex: 1 }}><PrimaryButton title="Сохранить" tone="accent" onPress={save} /></View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 20, color: C.ink },
  meta: { fontSize: 12, color: C.inkSoft, marginTop: 4 },
  section: { fontSize: 12, fontWeight: "600", color: C.inkSoft, letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipT: { fontSize: 12, color: C.ink },
  chipTOn: { color: C.white },
  textarea: { minHeight: 100, fontSize: 14, color: C.ink, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: 8, marginTop: 16 },
  moveTitle: { fontSize: 14, fontWeight: "600", color: C.ink, marginBottom: 10 },
  moveLabel: { fontSize: 11, color: C.inkSoft, marginBottom: 6 },
  moveInput: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.ink, marginBottom: 8,
  },
  moveError: { fontSize: 12, color: C.accent, marginBottom: 8 },
});
