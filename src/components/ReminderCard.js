// Карточка напоминания «связаться с клиентом» с галочкой выполнения:
// специалист отмечает тип связи (звонок/встреча/сообщение) и кратко пишет
// итог. Итог сохраняется в журнал контактов клиента, и ИИ учитывает его
// при следующем анализе базы (когда и с каким поводом коснуться снова).

import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import { C } from "../theme";
import { Card, Tag, PrimaryButton } from "./ui";

const SEGMENT_TONE = { холодный: "clay", тёплый: "clay", горячий: "green" };
const TOUCH_TYPES = ["Звонок", "Встреча", "Сообщение"];

export default function ReminderCard({ reminder, onOpenClient, onCompose, onLogged }) {
  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState("Сообщение");
  const [note, setNote] = useState("");

  // Уже выполненное напоминание — компактная «галочка».
  if (reminder.done) {
    return (
      <Card style={[styles.card, styles.doneCard]}>
        <Text style={styles.doneTitle}>✓ Связались с {reminder.client} · {reminder.doneType}</Text>
        {reminder.doneNote ? <Text style={styles.doneNote}>{reminder.doneNote}</Text> : null}
      </Card>
    );
  }

  const save = () => {
    if (!note.trim()) return;
    onLogged(type, note.trim());
  };

  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.client} onPress={onOpenClient}>{reminder.client} →</Text>
        <Tag tone={SEGMENT_TONE[reminder.segment] || "green"}>{reminder.segment}</Tag>
      </View>
      <Text style={styles.reason}>{reminder.reason}</Text>
      <Text style={styles.action}>{reminder.action}</Text>

      <View style={styles.btnRow}>
        <PrimaryButton title="Составить сообщение" onPress={onCompose} />
        <Pressable onPress={() => setFormOpen((v) => !v)} style={styles.checkBtn}>
          <Text style={styles.checkT}>{formOpen ? "✕ Свернуть" : "☑ Связалась"}</Text>
        </Pressable>
      </View>

      {formOpen && (
        <View style={styles.form}>
          <View style={styles.chips}>
            {TOUCH_TYPES.map((t) => (
              <Pressable key={t} onPress={() => setType(t)} style={[styles.chip, type === t && styles.chipOn]}>
                <Text style={[styles.chipT, type === t && styles.chipTOn]}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="Коротко: что обсудили, о чём договорились (например: «придёт в следующем месяце», «пока не актуально»)"
            placeholderTextColor={C.inkSoft}
            style={styles.input}
          />
          <PrimaryButton title="Сохранить контакт" tone="accent" onPress={save} />
          <Text style={styles.hint}>
            Итог попадёт в журнал клиента — ассистент учтёт его и напомнит
            в подходящее время.
          </Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, marginBottom: 8 },
  doneCard: { backgroundColor: C.primarySoft, borderColor: C.primarySoft },
  doneTitle: { fontSize: 13, fontWeight: "600", color: C.inkSoft },
  doneNote: { fontSize: 12, color: C.inkSoft, marginTop: 4, lineHeight: 16 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  client: { fontSize: 14, fontWeight: "600", color: C.primary, textDecorationLine: "underline" },
  reason: { fontSize: 13, color: C.ink, lineHeight: 18 },
  action: { fontSize: 12, color: C.inkSoft, marginTop: 4, lineHeight: 17 },
  btnRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" },
  checkBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: C.primary },
  checkT: { fontSize: 12, color: C.primary, fontWeight: "600" },
  form: { marginTop: 12, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12 },
  chips: { flexDirection: "row", gap: 6, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipT: { fontSize: 12, color: C.ink },
  chipTOn: { color: C.white },
  input: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: C.ink,
    minHeight: 64, textAlignVertical: "top", marginBottom: 8,
  },
  hint: { fontSize: 11, color: C.inkSoft, marginTop: 8, lineHeight: 15 },
});
