// Карточка события: заметка и статус динамики (нет статуса / прогресс /
// стабильность / регресс). Открывается по нажатию на событие в «Сегодня»
// и в «Календаре».

import React, { useState, useEffect } from "react";
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import { confirmAsync } from "../utils/confirm";
import { C, SERIF } from "../theme";
import { Card, Tag, PrimaryButton } from "../components/ui";
import MiniCalendar from "../components/MiniCalendar";
import { maskTime, normalizeTime, validTime, toMin } from "../utils/datetime";
import {
  getEvents, updateEvent, deleteEvent, syncEventToClientHistory, getBlocks,
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
  // Перенос записи на другую дату/время.
  const [moveOpen, setMoveOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [moveError, setMoveError] = useState("");
  const [moved, setMoved] = useState(false);

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
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const remove = async () => {
    if (await confirmAsync("Удалить событие?", event.title, "Удалить", "Отмена")) {
      await deleteEvent(id);
      navigation.goBack();
    }
  };

  const openMove = () => {
    setNewDate(event.date);
    setNewTime(event.time);
    setMoveError("");
    setMoveOpen(true);
  };

  const saveMove = async () => {
    const time = normalizeTime(newTime);
    if (!newDate) { setMoveError("Выберите новую дату."); return; }
    if (!validTime(time)) { setMoveError("Время указывается в формате 14:00."); return; }
    // Не позволяем перенести на закрытое время.
    const blocks = await getBlocks();
    const startM = toMin(time);
    const durM = event.durationMin || 50;
    const clash = blocks.find((b) => b.date === newDate && startM < toMin(b.end) && startM + durM > toMin(b.start));
    if (clash) { setMoveError(`Это время закрыто (${clash.start}–${clash.end}). Выберите другое.`); return; }
    setMoveError("");
    const updated = await updateEvent(id, { date: newDate, time });
    // Обновляем дату в истории клиента, если заметка уже синхронизирована.
    if (updated?.clientId && ((updated.note || "").trim() || updated.status !== "none")) {
      await syncEventToClientHistory(updated);
    }
    setEvent(updated);
    setMoveOpen(false);
    setMoved(true);
    setTimeout(() => setMoved(false), 2000);
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
          <PrimaryButton
            title={moved ? "Перенесено ✓" : moveOpen ? "Свернуть перенос" : "Перенести запись"}
            tone="soft"
            onPress={() => (moveOpen ? setMoveOpen(false) : openMove())}
          />
        </View>
      </Card>

      {moveOpen && (
        <Card style={{ padding: 14, marginTop: 12 }}>
          <Text style={styles.moveTitle}>Перенос записи</Text>
          <Text style={styles.moveLabel}>Новая дата</Text>
          <MiniCalendar value={newDate} onPick={setNewDate} />
          <Text style={styles.moveLabel}>Новое время</Text>
          <TextInput
            value={newTime}
            onChangeText={(v) => setNewTime(maskTime(v))}
            onBlur={() => setNewTime((t) => normalizeTime(t))}
            placeholder="--:--"
            placeholderTextColor={C.inkSoft}
            keyboardType="numeric"
            maxLength={5}
            style={styles.moveInput}
          />
          {moveError ? <Text style={styles.moveError}>{moveError}</Text> : null}
          <View style={styles.actions}>
            <View style={{ flex: 1 }}><PrimaryButton title="Отмена" tone="soft" onPress={() => setMoveOpen(false)} /></View>
            <View style={{ flex: 1 }}><PrimaryButton title="Перенести" tone="accent" onPress={saveMove} /></View>
          </View>
        </Card>
      )}

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
        <View style={{ flex: 1 }}><PrimaryButton title={saved ? "Сохранено ✓" : "Сохранить"} tone="accent" onPress={save} /></View>
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
