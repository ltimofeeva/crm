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
import { normalizeBirthDate } from "../utils/birthday";

// Поля приложения, которые можно заполнить из файла.
const FIELDS = [
  { key: "name", label: "Имя клиента *", guess: /фио|имя|клиент|name/i },
  { key: "phone", label: "Телефон", guess: /тел|phone|номер/i },
  { key: "birthDate", label: "Дата рождения", guess: /рожд|birth|\bдр\b/i },
  { key: "request", label: "Запрос / проблема", guess: /запрос|проблем|тема|жалоб/i },
  { key: "format", label: "Формат (онлайн/кабинет)", guess: /формат|format/i },
  { key: "contactVia", label: "Связаться в", guess: /связ|канал|мессендж|telegram|телеграм/i },
  { key: "notes", label: "История посещений / заметки", guess: /замет|истор|коммент|посещени(я|й)\s|визит.*(описан|коммент)|notes/i },
  { key: "products", label: "Какие продукты посещал", guess: /продукт|услуг|абонемент/i },
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
  const [stage, setStage] = useState("pick"); // pick | reading | map | importing | done
  const [error, setError] = useState("");
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [report, setReport] = useState(null);
  // Какой из выпадающих списков колонок сейчас раскрыт.
  const [openField, setOpenField] = useState(null);

  const reset = () => {
    setStage("pick"); setError(""); setHeaders([]); setRows([]); setMapping({}); setReport(null); setOpenField(null);
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
      // Сразу показываем индикатор «Читаю файл…» и даём интерфейсу его
      // отрисовать, прежде чем начать тяжёлый разбор (иначе на вебе экран
      // «замирает» до касания).
      setStage("reading");
      await new Promise((r) => setTimeout(r, 50));

      const wb = await readWorkbook(res.assets[0]);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      const nonEmpty = data.filter((r) => r.some((c) => String(c).trim() !== ""));
      if (nonEmpty.length === 0) { setError("Файл пустой — в первой таблице нет данных."); setStage("pick"); return; }

      // Первая строка — заголовки, если в ней есть буквы.
      const first = nonEmpty[0].map((c) => String(c).trim());
      const looksLikeHeader = first.some((c) => /[a-zа-яё]/i.test(c)) && !first.some((c) => /^\+?\d[\d\s()-]{6,}$/.test(c));
      const cols = looksLikeHeader ? first : first.map((_, i) => `Колонка ${i + 1}`);
      const body = looksLikeHeader ? nonEmpty.slice(1) : nonEmpty;
      if (body.length === 0) { setError("В файле только заголовки — нет строк с клиентами."); setStage("pick"); return; }

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
      setStage("pick");
    }
  };

  // Выбор колонки в выпадающем списке (null — «не заполнять»).
  const chooseColumn = (fieldKey, colIndex) => {
    setMapping((m) => {
      const next = { ...m };
      if (colIndex === null) delete next[fieldKey];
      else next[fieldKey] = colIndex;
      return next;
    });
    setOpenField(null);
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
        // Посещённые продукты: если дат нет — хотя бы список того, что клиент
        // проходил, отдельной записью в истории.
        const productsRaw = cell(row, "products");
        if (productsRaw) noteLines.push(`Посещал(а) продукты: ${productsRaw}`);

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
          birthDate: normalizeBirthDate(cell(row, "birthDate")),
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

            {stage === "reading" && (
              <View style={{ alignItems: "center", padding: 24 }}>
                <ActivityIndicator color={C.primary} />
                <Text style={[styles.text, { marginTop: 12, marginBottom: 0 }]}>Читаю файл…</Text>
                <Text style={[styles.text, { marginTop: 4, marginBottom: 0, fontSize: 12 }]}>
                  Это может занять несколько секунд для большой базы.
                </Text>
              </View>
            )}

            {stage === "map" && (
              <>
                <Text style={styles.text}>
                  Найдено строк: {rows.length}. Проверьте, из какой колонки файла
                  заполняется каждое поле (серым под полем — пример из первой строки):
                </Text>
                {FIELDS.map((f) => (
                  <View key={f.key} style={[styles.mapRow, openField === f.key && { zIndex: 50 }]}>
                    <Text style={styles.mapLabel}>{f.label}</Text>
                    <View style={styles.mapRight}>
                      <Pressable
                        onPress={() => setOpenField(openField === f.key ? null : f.key)}
                        style={[styles.select, openField === f.key && styles.selectOpen]}
                      >
                        <Text
                          style={[styles.selectT, mapping[f.key] === undefined && styles.selectPlaceholder]}
                          numberOfLines={1}
                        >
                          {mapping[f.key] !== undefined ? headers[mapping[f.key]] : "Выберите колонку"}
                        </Text>
                        <Text style={styles.selectArrow}>{openField === f.key ? "▴" : "▾"}</Text>
                      </Pressable>
                      {openField === f.key && (
                        <View style={styles.options}>
                          <ScrollView style={{ maxHeight: 190 }} keyboardShouldPersistTaps="handled">
                            <Pressable onPress={() => chooseColumn(f.key, null)} style={styles.option}>
                              <Text style={[styles.optionT, { color: C.inkSoft }]}>— не заполнять</Text>
                            </Pressable>
                            {headers.map((h, i) => (
                              <Pressable
                                key={i}
                                onPress={() => chooseColumn(f.key, i)}
                                style={[styles.option, mapping[f.key] === i && styles.optionOn]}
                              >
                                <Text style={[styles.optionT, mapping[f.key] === i && styles.optionTOn]} numberOfLines={1}>{h}</Text>
                              </Pressable>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                      {mapping[f.key] !== undefined && preview.length > 0 ? (
                        <Text style={styles.example} numberOfLines={1}>
                          Пример: {(() => {
                            const raw = String(preview[mapping[f.key]] ?? "").trim();
                            // Excel хранит даты числом — показываем уже как дату.
                            if (f.key === "birthDate") return normalizeBirthDate(raw) || raw || "(пусто)";
                            return raw || "(пусто)";
                          })()}
                        </Text>
                      ) : null}
                    </View>
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
  mapRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  mapLabel: { width: 130, fontSize: 12, fontWeight: "600", color: C.ink, paddingTop: 10, lineHeight: 16 },
  mapRight: { flex: 1 },
  select: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 9, gap: 6,
  },
  selectOpen: { borderColor: C.primary },
  selectT: { flex: 1, fontSize: 13, color: C.ink },
  selectPlaceholder: { color: C.inkSoft },
  selectArrow: { fontSize: 11, color: C.inkSoft },
  options: {
    position: "absolute", top: 42, left: 0, right: 0, zIndex: 60,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 6, overflow: "hidden",
  },
  option: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  optionOn: { backgroundColor: C.primarySoft },
  optionT: { fontSize: 13, color: C.ink },
  optionTOn: { color: C.primary, fontWeight: "600" },
  example: { fontSize: 11, color: C.inkSoft, marginTop: 4, fontStyle: "italic" },
  doneTitle: { fontSize: 16, fontWeight: "700", color: C.primary, marginBottom: 8 },
  error: { fontSize: 12, color: C.danger, marginTop: 8, lineHeight: 17 },
});
