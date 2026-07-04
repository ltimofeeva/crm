// Календарь: сетка месяца, события дня, запись клиента на продукт,
// свои мероприятия и настройка рабочего графика.

import React, { useState, useCallback } from "react";
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, SERIF } from "../theme";
import { Card, Tag, H1, PrimaryButton } from "../components/ui";
import {
  getEvents, addEvent, getClients, getProducts, getSchedule, saveSchedule,
  getBlocks, addBlock, deleteBlock,
} from "../storage/store";
import { confirmAsync } from "../utils/confirm";

const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Пн..Вс в терминах getDay()

export function dateKey(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const shift = (first.getDay() + 6) % 7; // 0 = понедельник
  const daysIn = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < shift; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function fmtDay(key) {
  const [y, m, d] = key.split("-").map(Number);
  const s = new Date(y, m - 1, d).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const EMPTY_FORM = { clientText: "", clientId: null, productText: "", productId: null, time: "", durationMin: "" };

// Маска времени --:-- — оставляем только цифры и ставим двоеточие.
function maskTime(v) {
  const d = (v || "").replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

function validTime(t) {
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test((t || "").trim());
}

// "12:30" → минуты от полуночи; некорректное значение → NaN.
function toMin(t) {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec((t || "").trim());
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : NaN;
}

// Дата из "01.07.2026" или "2026-07-01" → "2026-07-01"; иначе "".
function parseDateInput(s) {
  const v = (s || "").trim();
  if (!v) return "";
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? v : "";
}

function showDate(iso) {
  if (!iso) return "";
  const [y, mo, d] = iso.split("-");
  return `${d}.${mo}.${y}`;
}

export default function CalendarScreen({ navigation }) {
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [selected, setSelected] = useState(dateKey(new Date()));
  const [events, setEvents] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [schedOpen, setSchedOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [blockForm, setBlockForm] = useState({ start: "", end: "" });
  const [schedFrom, setSchedFrom] = useState("");
  const [schedTo, setSchedTo] = useState("");

  const load = useCallback(async () => {
    setEvents(await getEvents());
    setClients(await getClients());
    setProducts(await getProducts());
    const s = await getSchedule();
    setSchedule(s);
    setSchedFrom(showDate(s.from));
    setSchedTo(showDate(s.to));
    setBlocks(await getBlocks());
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const weeks = monthMatrix(cursor.getFullYear(), cursor.getMonth());
  const monthTitle = cursor.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  const todayKey = dateKey(new Date());
  const dayEvents = events.filter((e) => e.date === selected);
  const eventDates = new Set(events.map((e) => e.date));

  const [clientSug, setClientSug] = useState(false);
  const [productSug, setProductSug] = useState(false);

  // Подсказки: фильтруем по введённому тексту (пустой ввод — первые 5).
  const clientMatches = clients
    .filter((c) => c.name.toLowerCase().includes(form.clientText.trim().toLowerCase()))
    .slice(0, 5);
  const productMatches = products
    .filter((p) => p.name.toLowerCase().includes(form.productText.trim().toLowerCase()))
    .slice(0, 5);

  const onClientText = (v) => {
    const exact = clients.find((c) => c.name.toLowerCase() === v.trim().toLowerCase());
    setForm((f) => ({ ...f, clientText: v, clientId: exact?.id || null }));
    setClientSug(true);
  };

  const pickClient = (c) => {
    setForm((f) => ({ ...f, clientText: c.name, clientId: c.id }));
    setClientSug(false);
  };

  const onProductText = (v) => {
    const exact = products.find((p) => p.name.toLowerCase() === v.trim().toLowerCase());
    setForm((f) => ({
      ...f,
      productText: v,
      productId: exact?.id || null,
      durationMin: exact ? String(exact.durationMin) : f.durationMin,
    }));
    setProductSug(true);
  };

  const pickProduct = (p) => {
    setForm((f) => ({ ...f, productText: p.name, productId: p.id, durationMin: String(p.durationMin) }));
    setProductSug(false);
  };

  const dayBlocks = blocks.filter((b) => b.date === selected);

  const save = async () => {
    // 1. Обязательные поля.
    const missing = [];
    if (!form.clientText.trim()) missing.push("«Клиент / название»");
    if (!form.time.trim()) missing.push("«Время»");
    if (missing.length) {
      setFormError(`Заполните обязательные поля: ${missing.join(" и ")}.`);
      return;
    }
    // 2. Корректность времени.
    const time = form.time.trim();
    if (!validTime(time)) { setFormError("Время указывается в формате 14:00."); return; }
    const client = clients.find((c) => c.id === form.clientId);
    const product = products.find((p) => p.id === form.productId);
    // 3. Пересечение с закрытым временем.
    const startM = toMin(time);
    const durM = parseInt(form.durationMin, 10) || product?.durationMin || 50;
    const clash = dayBlocks.find((b) => startM < toMin(b.end) && startM + durM > toMin(b.start));
    if (clash) { setFormError(`Это время закрыто (${clash.start}–${clash.end}). Выберите другое.`); return; }
    setFormError("");
    const productName = product?.name || form.productText.trim() || null;
    await addEvent({
      date: selected,
      time: time.padStart(5, "0"),
      durationMin: durM,
      title: client ? `Сессия: ${client.name}` : form.clientText.trim(),
      clientId: client?.id || null,
      clientName: client?.name || null,
      productId: product?.id || null,
      productName,
      type: client ? "session" : "other",
    });
    const newClientName = !client ? form.clientText.trim() : "";
    const newProductName = !product && form.productText.trim() ? form.productText.trim() : "";
    setForm(EMPTY_FORM);
    setFormOpen(false);
    setClientSug(false);
    setProductSug(false);
    load();

    // Имя не из базы — предлагаем сразу завести карточку клиента/продукта.
    if (newClientName && await confirmAsync(
      "Вы хотите добавить нового клиента в базу?",
      `«${newClientName}» появится во вкладке «Клиенты», и ассистент сможет вести его историю.`,
    )) {
      navigation.navigate("Clients", { screen: "ClientsList", params: { newName: newClientName } });
      return;
    }
    if (newProductName && await confirmAsync(
      "Добавить новый продукт в настройки?",
      `«${newProductName}» появится в списке продуктов с длительностью и ценой.`,
    )) {
      navigation.navigate("Settings", { newProductName });
    }
  };

  const toggleDay = (d) => setSchedule((s) => ({ ...s, days: { ...s.days, [d]: !s.days[d] } }));

  const saveSched = async () => {
    const next = { ...schedule, from: parseDateInput(schedFrom), to: parseDateInput(schedTo) };
    setSchedule(next);
    await saveSchedule(next);
    setSchedOpen(false);
  };

  const saveBlock = async () => {
    const s = toMin(blockForm.start);
    const e = toMin(blockForm.end);
    if (isNaN(s) || isNaN(e) || e <= s) return;
    const norm = (t) => t.trim().replace(".", ":").padStart(5, "0");
    await addBlock({ date: selected, start: norm(blockForm.start), end: norm(blockForm.end) });
    setBlockForm({ start: "", end: "" });
    setBlockOpen(false);
    load();
  };

  const removeBlock = async (id) => { await deleteBlock(id); load(); };

  // Рабочий ли выбранный день: по дню недели и периоду действия графика.
  const inPeriod = schedule &&
    (!schedule.from || selected >= schedule.from) &&
    (!schedule.to || selected <= schedule.to);
  const isWorkday = inPeriod && schedule?.days?.[new Date(selected + "T00:00:00").getDay()];

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <View style={styles.headRow}>
        <H1>Календарь</H1>
        <PrimaryButton title="График" tone="soft" onPress={() => setSchedOpen((v) => !v)} />
      </View>

      {schedOpen && schedule && (
        <Card style={styles.form}>
          <Text style={styles.formTitle}>Рабочий график</Text>
          <View style={styles.chipsRow}>
            {DAY_ORDER.map((d, i) => (
              <Pressable key={d} onPress={() => toggleDay(d)} style={[styles.chip, schedule.days[d] && styles.chipOn]}>
                <Text style={[styles.chipT, schedule.days[d] && styles.chipTOn]}>{WD[i]}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Часы работы</Text>
          <View style={styles.rowInputs}>
            <TextInput value={schedule.start} onChangeText={(v) => setSchedule((s) => ({ ...s, start: v }))} placeholder="10:00" placeholderTextColor={C.inkSoft} style={[styles.input, { flex: 1 }]} />
            <Text style={{ color: C.inkSoft }}>—</Text>
            <TextInput value={schedule.end} onChangeText={(v) => setSchedule((s) => ({ ...s, end: v }))} placeholder="20:00" placeholderTextColor={C.inkSoft} style={[styles.input, { flex: 1 }]} />
          </View>
          <Text style={styles.label}>Период действия (пусто = бессрочно)</Text>
          <View style={styles.rowInputs}>
            <TextInput value={schedFrom} onChangeText={setSchedFrom} placeholder="с 01.07.2026" placeholderTextColor={C.inkSoft} style={[styles.input, { flex: 1 }]} />
            <Text style={{ color: C.inkSoft }}>—</Text>
            <TextInput value={schedTo} onChangeText={setSchedTo} placeholder="по 31.07.2026" placeholderTextColor={C.inkSoft} style={[styles.input, { flex: 1 }]} />
          </View>
          <PrimaryButton title="Сохранить график" tone="accent" onPress={saveSched} />
          <Text style={styles.formHint}>
            Закрыть отдельные часы внутри дня (например, обед) можно кнопкой
            «Закрыть время» под календарём, выбрав нужное число.
          </Text>
        </Card>
      )}

      <Card style={{ padding: 12 }}>
        <View style={styles.monthRow}>
          <Pressable onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} style={styles.nav}><Text style={styles.navT}>‹</Text></Pressable>
          <Text style={[styles.monthT, SERIF]}>{monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1)}</Text>
          <Pressable onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} style={styles.nav}><Text style={styles.navT}>›</Text></Pressable>
        </View>
        <View style={styles.week}>
          {WD.map((w) => <Text key={w} style={styles.wd}>{w}</Text>)}
        </View>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.week}>
            {week.map((d, di) => {
              if (!d) return <View key={di} style={styles.cell} />;
              const key = dateKey(d);
              const sel = key === selected;
              const isToday = key === todayKey;
              return (
                <Pressable key={di} onPress={() => setSelected(key)} style={[styles.cell, sel && styles.cellSel]}>
                  <Text style={[styles.cellT, isToday && !sel && { color: C.accent, fontWeight: "700" }, sel && styles.cellTSel]}>
                    {d.getDate()}
                  </Text>
                  {eventDates.has(key) && <View style={[styles.dot, sel && { backgroundColor: C.white }]} />}
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>

      <View style={styles.dayHead}>
        <Text style={styles.dayTitle}>{fmtDay(selected)}</Text>
        {!formOpen && <PrimaryButton title="＋ Событие" onPress={() => setFormOpen(true)} />}
      </View>
      {schedule && (
        <View style={styles.workRow}>
          <Text style={styles.workHint}>
            {isWorkday ? `Рабочий день · ${schedule.start}–${schedule.end}` : "Выходной по графику"}
          </Text>
          {!blockOpen && (
            <Pressable onPress={() => setBlockOpen(true)}>
              <Text style={styles.blockLink}>Закрыть время</Text>
            </Pressable>
          )}
        </View>
      )}

      {blockOpen && (
        <Card style={styles.form}>
          <Text style={styles.formTitle}>Закрыть время (серые часы — на них не записывать)</Text>
          <View style={styles.rowInputs}>
            <TextInput value={blockForm.start} onChangeText={(v) => setBlockForm((b) => ({ ...b, start: v }))} placeholder="с 12:00" placeholderTextColor={C.inkSoft} style={[styles.input, { flex: 1 }]} />
            <Text style={{ color: C.inkSoft }}>—</Text>
            <TextInput value={blockForm.end} onChangeText={(v) => setBlockForm((b) => ({ ...b, end: v }))} placeholder="до 14:00" placeholderTextColor={C.inkSoft} style={[styles.input, { flex: 1 }]} />
          </View>
          <View style={styles.rowInputs}>
            <View style={{ flex: 1 }}><PrimaryButton title="Отмена" tone="soft" onPress={() => setBlockOpen(false)} /></View>
            <View style={{ flex: 1 }}><PrimaryButton title="Закрыть время" tone="accent" onPress={saveBlock} /></View>
          </View>
        </Card>
      )}

      {dayBlocks.map((b) => (
        <View key={b.id} style={styles.blockCard}>
          <Text style={styles.blockText}>⛔ Закрыто · {b.start}–{b.end}</Text>
          <Pressable onPress={() => removeBlock(b.id)} style={{ padding: 4 }}>
            <Text style={{ color: C.inkSoft, fontSize: 14 }}>✕</Text>
          </Pressable>
        </View>
      ))}

      {formOpen && (
        <Card style={styles.form}>
          <Text style={styles.formTitle}>Новое событие</Text>

          <Text style={styles.label}>Клиент или название события *</Text>
          <TextInput
            value={form.clientText}
            onChangeText={onClientText}
            onFocus={() => setClientSug(true)}
            placeholder="Начните вводить имя…"
            placeholderTextColor={C.inkSoft}
            style={styles.input}
          />
          {clientSug && clientMatches.length > 0 && (
            <View style={styles.sugBox}>
              {clientMatches.map((c) => (
                <Pressable key={c.id} onPress={() => pickClient(c)} style={styles.sugRow}>
                  <Text style={styles.sugT}>{c.name}</Text>
                  <Text style={styles.sugMeta}>{c.request || "клиент"}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={styles.label}>Продукт (можно свой)</Text>
          <TextInput
            value={form.productText}
            onChangeText={onProductText}
            onFocus={() => setProductSug(true)}
            placeholder="Начните вводить название…"
            placeholderTextColor={C.inkSoft}
            style={styles.input}
          />
          {productSug && productMatches.length > 0 && (
            <View style={styles.sugBox}>
              {productMatches.map((p) => (
                <Pressable key={p.id} onPress={() => pickProduct(p)} style={styles.sugRow}>
                  <Text style={styles.sugT}>{p.name}</Text>
                  <Text style={styles.sugMeta}>{p.durationMin} мин{p.price ? ` · ${p.price} ₽` : ""}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.rowInputs}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Время *</Text>
              <TextInput
                value={form.time}
                onChangeText={(v) => setForm((f) => ({ ...f, time: maskTime(v) }))}
                placeholder="--:--"
                placeholderTextColor={C.inkSoft}
                keyboardType="numeric"
                maxLength={5}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Длительность, мин</Text>
              <TextInput
                value={form.durationMin}
                onChangeText={(v) => setForm((f) => ({ ...f, durationMin: v }))}
                placeholder="50"
                placeholderTextColor={C.inkSoft}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
          </View>

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}
          <View style={styles.rowInputs}>
            <View style={{ flex: 1 }}><PrimaryButton title="Отмена" tone="soft" onPress={() => { setFormOpen(false); setForm(EMPTY_FORM); setFormError(""); }} /></View>
            <View style={{ flex: 1 }}><PrimaryButton title="Сохранить" tone="accent" onPress={save} /></View>
          </View>
          {products.length === 0 && (
            <Text style={styles.formHint}>Подсказка: заполните продукты в настройках (⚙) — длительность окна будет подставляться сама.</Text>
          )}
        </Card>
      )}

      {dayEvents.length === 0 && !formOpen && (
        <Card style={{ padding: 16 }}>
          <Text style={{ fontSize: 13, color: C.inkSoft, lineHeight: 19 }}>
            На этот день событий нет. Нажмите «＋ Событие», чтобы записать клиента
            или добавить своё мероприятие.
          </Text>
        </Card>
      )}

      {dayEvents.map((e) => (
        <Card key={e.id} style={styles.event} onPress={() => navigation.navigate("EventDetail", { id: e.id })}>
          <View style={styles.time}>
            <Text style={styles.timeT}>{e.time}</Text>
            <Text style={styles.dur}>{e.durationMin} мин</Text>
          </View>
          <View style={styles.sep} />
          <View style={{ flex: 1 }}>
            <Text style={styles.evTitle} numberOfLines={1}>{e.title}</Text>
            {e.productName ? <Text style={styles.evMeta}>{e.productName}</Text> : null}
          </View>
          {e.type === "other" ? <Tag>Своё</Tag> : null}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  nav: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  navT: { fontSize: 22, color: C.primary },
  monthT: { fontSize: 16, color: C.ink },
  week: { flexDirection: "row" },
  wd: { flex: 1, textAlign: "center", fontSize: 11, color: C.inkSoft, paddingVertical: 4 },
  cell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  cellSel: { backgroundColor: C.primary },
  cellT: { fontSize: 13, color: C.ink },
  cellTSel: { color: C.white, fontWeight: "700" },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent, marginTop: 2 },
  dayHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16, marginBottom: 4 },
  dayTitle: { fontSize: 15, fontWeight: "600", color: C.ink },
  workRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  workHint: { fontSize: 11, color: C.inkSoft },
  blockLink: { fontSize: 12, color: C.accent, fontWeight: "600" },
  blockCard: {
    backgroundColor: "#E7E9E7", borderRadius: 12, padding: 12, marginBottom: 8,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  blockText: { fontSize: 13, color: C.inkSoft, fontWeight: "600" },
  formError: { fontSize: 12, color: C.accent, marginBottom: 8 },
  sugBox: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, marginTop: -4, marginBottom: 8, overflow: "hidden" },
  sugRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  sugT: { fontSize: 13, color: C.ink, fontWeight: "600" },
  sugMeta: { fontSize: 11, color: C.inkSoft },
  form: { padding: 14, marginBottom: 12 },
  formTitle: { fontSize: 14, fontWeight: "600", color: C.ink, marginBottom: 10 },
  label: { fontSize: 11, color: C.inkSoft, marginBottom: 6 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipT: { fontSize: 12, color: C.ink },
  chipTOn: { color: C.white },
  input: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.ink, marginBottom: 8,
  },
  rowInputs: { flexDirection: "row", gap: 8, alignItems: "center" },
  formHint: { fontSize: 11, color: C.inkSoft, marginTop: 8, lineHeight: 15 },
  event: { padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  time: { width: 52, alignItems: "center" },
  timeT: { fontSize: 15, fontWeight: "600", color: C.ink },
  dur: { fontSize: 10, color: C.inkSoft },
  sep: { width: 1, alignSelf: "stretch", backgroundColor: C.line },
  evTitle: { fontSize: 14, fontWeight: "600", color: C.ink },
  evMeta: { fontSize: 11, color: C.inkSoft, marginTop: 2 },
});
