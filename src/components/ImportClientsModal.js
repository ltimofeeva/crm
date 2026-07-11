// Импорт базы клиентов из Excel (.xlsx / .xls / .csv).
// Шаги: выбор файла → разбор → сопоставление колонок файла с полями
// приложения (с автоугадыванием по заголовкам) → импорт.
// История посещений/заметки уходят в заметки клиента (каждая строка ячейки —
// отдельная запись), счётчик посещений берётся из колонки или считается
// по числу заметок.

import React, { useState } from "react";
import {
  Modal, View, Text, ScrollView, StyleSheet, Pressable, Platform, ActivityIndicator,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as XLSX from "xlsx";
import { C } from "../theme";
import { PrimaryButton } from "./ui";
import { getClients, saveClients } from "../storage/store";

// Поля приложения, которые можно заполнить из файла.
const FIELDS = [
  { key: "name", label: "Имя клиента *", guess: /фио|имя|клиент|name/i },
  { key: "phone", label: "Телефон", guess: /тел|phone|номер/i },
  { key: "age", label: "Возраст", guess: /возраст|age|лет/i },
  { key: "request", label: "Запрос / проблема", guess: /запрос|проблем|тема|жалоб/i },
  { key: "format", label: "Формат (онлайн/кабинет)", guess: /формат|format/i },
  { key: "contactVia", label: "Связаться в", guess: /связ|канал|мессендж|telegram|телеграм/i },
  { key: "notes", label: "История посещений / заметки", guess: /замет|истор|коммент|посещени(я|й)\s|визит.*(описан|коммент)|notes/i },
  { key: "count", label: "Кол-во посещений (число)", guess: /кол-?во|количество|счетчик|счётчик|сессий|visits|посещений/i },
];

async function readWorkbook(asset) {
  if (Platform.OS === "web") {
    const ab = await (await fetch(asset.uri)).arrayBuffer();
    return XLSX.read(ab, { type: "array" });
  }
  // Нативные платформы: читаем файл как base64.
  const FileSystem = require("expo-file-system/legacy");
  const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: "base64" });
  return XLSX.read(b64, { type: "base64" });
}

export default function ImportClientsModal({ visible, onClose, onDone }) {
  const [stage, setStage] = useState("pick"); // pick | map | importing | done
  const [error, setError] = useState("");
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [report, setReport] = useState(null);

  const reset = () => {
    setStage("pick"); setError(""); setHeaders([]); setRows([]); setMapping({}); setReport(null);
  };

  const close = () => { reset(); onClose(); };

  const pickFile = async () => {
    setError("");
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
          "text/comma-separated-values",
        ],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.length) return;
      const wb = await readWorkbook(res.assets[0]);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      const nonEmpty = data.filter((r) => r.some((c) => String(c).trim() !== ""));
      if (nonEmpty.length === 0) { setError("Файл пустой — в первой таблице нет данных."); return; }

      // Первая строка — заголовки, если в ней есть буквы.
      const first = nonEmpty[0].map((c) => String(c).trim());
      const looksLikeHeader = first.some((c) => /[a-zа-яё]/i.test(c)) && !first.some((c) => /^\+?\d[\d\s()-]{6,}$/.test(c));
      const cols = looksLikeHeader ? first : first.map((_, i) => `Колонка ${i + 1}`);
      const body = looksLikeHeader ? nonEmpty.slice(1) : nonEmpty;
      if (body.length === 0) { setError("В файле только заголовки — нет строк с клиентами."); return; }

      // Автоугадывание сопоставления по названиям колонок.
      const auto = {};
      FIELDS.forEach((f) => {
        const idx = cols.findIndex((c, i) => f.guess.test(c) && !Object.values(auto).includes(i));
        if (idx >= 0) auto[f.key] = idx;
      });

      setHeaders(cols);
      setRows(body);
      setMapping(auto);
      setStage("map");
    } catch (e) {
      setError("Не удалось прочитать файл. Убедитесь, что это .xlsx, .xls или .csv.");
    }
  };

  const setField = (fieldKey, colIndex) => {
    setMapping((m) => {
      const next = { ...m };
      if (next[fieldKey] === colIndex) delete next[fieldKey];
      else next[fieldKey] = colIndex;
      return next;
    });
  };

  const cell = (row, key) => {
    const idx = mapping[key];
    if (idx === undefined || idx === null) return "";
    return String(row[idx] ?? "").trim();
  };

  const runImport = async () => {
    if (mapping.name === undefined) { setError("Укажите, в какой колонке имя клиента."); return; }
    setError("");
    setStage("importing");
    try {
      const existing = await getClients();
      const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));
      const imported = [];
      let skipped = 0;

      rows.forEach((row, ri) => {
        const name = cell(row, "name");
        if (!name) { skipped++; return; }
        if (existingNames.has(name.toLowerCase())) { skipped++; return; }
        existingNames.add(name.toLowerCase());

        // Заметки: каждая непустая строка ячейки — отдельная запись истории.
        const notesRaw = cell(row, "notes");
        const noteLines = notesRaw
          ? notesRaw.split(/\r?\n|;/).map((s) => s.trim()).filter(Boolean)
          : [];
        const sessions = noteLines.map((note, i) => ({
          n: noteLines.length - i, // старые ниже, свежие сверху
          date: "",
          note,
          mood: "—",
        }));

        // Счётчик: из колонки, иначе по числу заметок.
        const countRaw = cell(row, "count").replace(/\D/g, "");
        const sessionsCount = countRaw ? parseInt(countRaw, 10) : sessions.length;

        imported.push({
          id: Date.now() + ri,
          name,
          age: cell(row, "age").replace(/\D/g, "").slice(0, 3),
          request: cell(row, "request"),
          format: cell(row, "format") || "Онлайн",
          phone: cell(row, "phone"),
          contactVia: cell(row, "contactVia"),
          status: "Активный",
          since: "импорт",
          nextSession: "—",
          sessionsCount,
          sessions,
        });
      });

      await saveClients([...imported, ...existing]);
      setReport({ imported: imported.length, skipped });
      setStage("done");
    } catch (e) {
      setError("Импорт не удался. Попробуйте ещё раз.");
      setStage("map");
    }
  };

  const finish = () => { close(); onDone(); };

  const preview = rows[0] || [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>Загрузка базы из Excel</Text>
            <Pressable onPress={close} style={{ padding: 6 }}><Text style={{ fontSize: 16, color: C.inkSoft }}>✕</Text></Pressable>
          </View>

          <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
            {stage === "pick" && (
              <>
                <Text style={styles.text}>
                  Выберите файл .xlsx, .xls или .csv с базой клиентов. На следующем
                  шаге вы укажете, в какой колонке что находится — порядок колонок
                  в файле может быть любым.
                </Text>
                <PrimaryButton title="Выбрать файл" onPress={pickFile} />
              </>
            )}

            {stage === "map" && (
              <>
                <Text style={styles.text}>
                  Найдено строк: {rows.length}. Соотнесите поля приложения с
                  колонками файла (серым — пример из первой строки):
                </Text>
                {FIELDS.map((f) => (
                  <View key={f.key} style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>{f.label}</Text>
                    <View style={styles.chips}>
                      <Pressable
                        onPress={() => setField(f.key, mapping[f.key])}
                        style={[styles.chip, mapping[f.key] === undefined && styles.chipOn]}
                      >
                        <Text style={[styles.chipT, mapping[f.key] === undefined && styles.chipTOn]}>—</Text>
                      </Pressable>
                      {headers.map((h, i) => (
                        <Pressable key={i} onPress={() => setField(f.key, i)} style={[styles.chip, mapping[f.key] === i && styles.chipOn]}>
                          <Text style={[styles.chipT, mapping[f.key] === i && styles.chipTOn]} numberOfLines={1}>{h}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {mapping[f.key] !== undefined && preview.length > 0 ? (
                      <Text style={styles.example} numberOfLines={1}>
                        Пример: {String(preview[mapping[f.key]] ?? "").trim() || "(пусто)"}
                      </Text>
                    ) : null}
                  </View>
                ))}
                <PrimaryButton title={`Импортировать ${rows.length} строк`} tone="accent" onPress={runImport} />
              </>
            )}

            {stage === "importing" && (
              <View style={{ alignItems: "center", padding: 24 }}>
                <ActivityIndicator color={C.primary} />
                <Text style={[styles.text, { marginTop: 12 }]}>Импортирую…</Text>
              </View>
            )}

            {stage === "done" && report && (
              <>
                <Text style={styles.doneTitle}>Готово ✓</Text>
                <Text style={styles.text}>
                  Добавлено клиентов: {report.imported}.
                  {report.skipped ? ` Пропущено строк: ${report.skipped} (пустое имя или клиент уже есть).` : ""}
                </Text>
                <Text style={styles.text}>
                  История посещений перенесена в заметки, счётчик посещений заполнен.
                </Text>
                <PrimaryButton title="Открыть список клиентов" tone="accent" onPress={finish} />
              </>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(36,51,44,0.4)", alignItems: "center", justifyContent: "center", padding: 16 },
  card: { width: "100%", maxWidth: 440, backgroundColor: C.white, borderRadius: 16, padding: 16 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 16, fontWeight: "700", color: C.ink },
  text: { fontSize: 13, color: C.inkSoft, lineHeight: 19, marginBottom: 12 },
  fieldBlock: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: C.ink, marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, maxWidth: 160 },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipT: { fontSize: 11, color: C.ink },
  chipTOn: { color: C.white },
  example: { fontSize: 11, color: C.inkSoft, marginTop: 4, fontStyle: "italic" },
  doneTitle: { fontSize: 16, fontWeight: "700", color: C.primary, marginBottom: 8 },
  error: { fontSize: 12, color: C.accent, marginTop: 8, lineHeight: 17 },
});
