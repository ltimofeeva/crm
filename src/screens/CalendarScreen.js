// Календарь-расписание: шкала времени слева, три дня колонками
// (выбранный + два следующих), стрелки листания по одному дню, выбор даты
// через мини-календарь. Запись, закрытие времени и график — всплывающие окна.

import React, { useState, useCallback } from "react";
import {
  ScrollView, View, Text, TextInput, StyleSheet, Pressable, Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, SERIF } from "../theme";
import { Card, H1, PrimaryButton, BrainButton } from "../components/ui";
import {
  getEvents, addEvent, getClients, getProducts, getSchedule, saveSchedule,
  getBlocks, addBlock, deleteBlock,
} from "../storage/store";
import { confirmAsync } from "../utils/confirm";

const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Пн..Вс в терминах getDay()
const HOUR_H = 56;   // высота часа в пикселях
const GUTTER = 44;   // ширина колонки времени

export function dateKey(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const shift = (first.getDay() + 6) % 7;
  const daysIn = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < shift; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function showDate(iso) {
  if (!iso) return "";
  const [y, mo, d] = iso.split("-");
  return `${d}.${mo}.${y}`;
}

// "12:30" → минуты от полуночи; некорректное значение → NaN.
function toMin(t) {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec((t || "").trim());
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : NaN;
}

// Маска времени --:-- — только цифры, двоеточие ставится само.
function maskTime(v) {
  const d = (v || "").replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

function validTime(t) {
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test((t || "").trim());
}

// «14» при уходе с поля → «14:00»; «1430» → «14:30».
function normalizeTime(v) {
  const d = (v || "").replace(/\D/g, "");
  if (!d) return "";
  let hh = parseInt(d.slice(0, 2), 10);
  let mm = d.length > 2 ? parseInt(d.slice(2, 4).padEnd(2, "0"), 10) : 0;
  if (isNaN(hh)) return "";
  hh = Math.min(hh, 23);
  mm = Math.min(isNaN(mm) ? 0 : mm, 59);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// Компактный календарик для выбора даты.
function MiniCalendar({ value, onPick }) {
  const init = value ? new Date(value + "T00:00:00") : new Date();
  const [cur, setCur] = useState(new Date(init.getFullYear(), init.getMonth(), 1));
  const weeks = monthMatrix(cur.getFullYear(), cur.getMonth());
  const title = cur.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  return (
    <View style={mini.box}>
      <View style={mini.head}>
        <Pressable onPress={() => setCur(new Date(cur.getFullYear(), cur.getMonth() - 1, 1))} style={mini.nav}>
          <Text style={mini.navT}>‹</Text>
        </Pressable>
        <Text style={mini.title}>{title.charAt(0).toUpperCase() + title.slice(1)}</Text>
        <Pressable onPress={() => setCur(new Date(cur.getFullYear(), cur.getMonth() + 1, 1))} style={mini.nav}>
          <Text style={mini.navT}>›</Text>
        </Pressable>
      </View>
      <View style={mini.week}>
        {WD.map((w) => <Text key={w} style={mini.wd}>{w}</Text>)}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={mini.week}>
          {week.map((d, di) => {
            if (!d) return <View key={di} style={mini.cell} />;
            const key = dateKey(d);
            const sel = key === value;
            return (
              <Pressable key={di} onPress={() => onPick(key)} style={[mini.cell, sel && mini.cellSel]}>
                <Text style={[mini.cellT, sel && mini.cellTSel]}>{d.getDate()}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// Обёртка всплывающего окна.
function Popup({ visible, onClose, title, children }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.modalClose}><Text style={{ fontSize: 16, color: C.inkSoft }}>✕</Text></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 480 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const EMPTY_FORM = { date: "", clientText: "", clientId: null, productText: "", productId: null, time: "", durationMin: "" };

export default function CalendarScreen({ navigation }) {
  const [startDate, setStartDate] = useState(dateKey(new Date()));
  const [events, setEvents] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [schedule, setSchedule] = useState(null);

  // Всплывающие окна.
  const [eventModal, setEventModal] = useState(false);
  const [blockModal, setBlockModal] = useState(false);
  const [schedModal, setSchedModal] = useState(false);
  const [dateModal, setDateModal] = useState(false);

  // Форма записи.
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [clientSug, setClientSug] = useState(false);
  const [productSug, setProductSug] = useState(false);

  // Форма закрытия времени.
  const [blockForm, setBlockForm] = useState({ date: "", start: "", end: "" });
  const [blockError, setBlockError] = useState("");

  // График.
  const [schedFrom, setSchedFrom] = useState("");
  const [schedTo, setSchedTo] = useState("");
  const [pickerFor, setPickerFor] = useState(null);

  const load = useCallback(async () => {
    setEvents(await getEvents());
    setClients(await getClients());
    setProducts(await getProducts());
    const s = await getSchedule();
    setSchedule(s);
    setSchedFrom(s.from || "");
    setSchedTo(s.to || "");
    setBlocks(await getBlocks());
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const days = [startDate, addDays(startDate, 1), addDays(startDate, 2)];
  const todayKey = dateKey(new Date());

  const isWorkday = (iso) => {
    if (!schedule) return true;
    const inPeriod = (!schedule.from || iso >= schedule.from) && (!schedule.to || iso <= schedule.to);
    return inPeriod && !!schedule.days?.[new Date(iso + "T00:00:00").getDay()];
  };

  // Диапазон сетки: от начала графика до конца, расширяется под события.
  let gridStart = Math.min(toMin(schedule?.start || "09:00") || 540, 9 * 60);
  let gridEnd = Math.max(toMin(schedule?.end || "20:00") || 1200, 20 * 60);
  const visibleEvents = events.filter((e) => days.includes(e.date));
  const visibleBlocks = blocks.filter((b) => days.includes(b.date));
  visibleEvents.forEach((e) => {
    const s = toMin(e.time);
    if (!isNaN(s)) {
      gridStart = Math.min(gridStart, s);
      gridEnd = Math.max(gridEnd, s + (e.durationMin || 50));
    }
  });
  visibleBlocks.forEach((b) => {
    gridStart = Math.min(gridStart, toMin(b.start) || gridStart);
    gridEnd = Math.max(gridEnd, toMin(b.end) || gridEnd);
  });
  gridStart = Math.floor(gridStart / 60) * 60;
  gridEnd = Math.ceil(gridEnd / 60) * 60;
  const hours = [];
  for (let m = gridStart; m < gridEnd; m += 60) hours.push(m);
  const gridHeight = ((gridEnd - gridStart) / 60) * HOUR_H;

  const monthTitle = (() => {
    const d = new Date(startDate + "T00:00:00");
    const s = d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  // ---------- Запись ----------

  const openEventModal = (date) => {
    setForm({ ...EMPTY_FORM, date: date || startDate });
    setFormError("");
    setClientSug(false);
    setProductSug(false);
    setEventModal(true);
  };

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
      ...f, productText: v, productId: exact?.id || null,
      durationMin: exact ? String(exact.durationMin) : f.durationMin,
    }));
    setProductSug(true);
  };
  const pickProduct = (p) => {
    setForm((f) => ({ ...f, productText: p.name, productId: p.id, durationMin: String(p.durationMin) }));
    setProductSug(false);
  };

  const saveEvent = async () => {
    const missing = [];
    if (!form.clientText.trim()) missing.push("«Клиент / название»");
    if (!form.time.trim()) missing.push("«Время»");
    if (missing.length) { setFormError(`Заполните обязательные поля: ${missing.join(" и ")}.`); return; }
    const time = form.time.trim();
    if (!validTime(time)) { setFormError("Время указывается в формате 14:00."); return; }
    const client = clients.find((c) => c.id === form.clientId);
    const product = products.find((p) => p.id === form.productId);
    const startM = toMin(time);
    const durM = parseInt(form.durationMin, 10) || product?.durationMin || 50;
    const clash = blocks.find((b) => b.date === form.date && startM < toMin(b.end) && startM + durM > toMin(b.start));
    if (clash) { setFormError(`Это время закрыто (${clash.start}–${clash.end}). Выберите другое.`); return; }
    setFormError("");
    const productName = product?.name || form.productText.trim() || null;
    await addEvent({
      date: form.date,
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
    setEventModal(false);
    setForm(EMPTY_FORM);
    load();

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

  // ---------- Закрытое время ----------

  const openBlockModal = (date) => {
    setBlockForm({ date: date || startDate, start: "", end: "" });
    setBlockError("");
    setBlockModal(true);
  };

  const saveBlock = async () => {
    const start = normalizeTime(blockForm.start);
    const end = normalizeTime(blockForm.end);
    if (!start || !end) { setBlockError("Укажите время «с» и «до»."); return; }
    if (toMin(end) <= toMin(start)) { setBlockError("Время «до» должно быть позже времени «с»."); return; }
    await addBlock({ date: blockForm.date, start, end });
    setBlockModal(false);
    load();
  };

  const removeBlock = async (b) => {
    if (await confirmAsync("Открыть это время?", `Закрыто ${b.start}–${b.end}`, "Открыть", "Отмена")) {
      await deleteBlock(b.id);
      load();
    }
  };

  // ---------- График ----------

  const toggleDay = (d) => setSchedule((s) => ({ ...s, days: { ...s.days, [d]: !s.days[d] } }));

  const saveSched = async () => {
    const next = {
      ...schedule,
      start: normalizeTime(schedule.start) || "10:00",
      end: normalizeTime(schedule.end) || "20:00",
      from: schedFrom,
      to: schedTo,
    };
    setSchedule(next);
    await saveSchedule(next);
    setSchedModal(false);
    setPickerFor(null);
  };

  // ---------- Отрисовка колонок ----------

  const renderDayColumn = (iso) => {
    const dayEvents = events.filter((e) => e.date === iso);
    const dayBlocks = blocks.filter((b) => b.date === iso);
    const work = isWorkday(iso);
    return (
      <Pressable
        key={iso}
        style={[styles.dayCol, !work && styles.dayColOff, { height: gridHeight }]}
        onPress={() => openEventModal(iso)}
      >
        {dayBlocks.map((b) => {
          const top = ((toMin(b.start) - gridStart) / 60) * HOUR_H;
          const h = Math.max(((toMin(b.end) - toMin(b.start)) / 60) * HOUR_H, 20);
          return (
            <Pressable key={b.id} onPress={() => removeBlock(b)} style={[styles.blockBox, { top, height: h }]}>
              <Text style={styles.blockBoxT} numberOfLines={1}>⛔ {b.start}–{b.end}</Text>
            </Pressable>
          );
        })}
        {dayEvents.map((e) => {
          const s = toMin(e.time);
          if (isNaN(s)) return null;
          const top = ((s - gridStart) / 60) * HOUR_H;
          const h = Math.max(((e.durationMin || 50) / 60) * HOUR_H, 26);
          return (
            <Pressable
              key={e.id}
              onPress={() => navigation.navigate("EventDetail", { id: e.id })}
              style={[styles.eventBox, e.type === "other" && styles.eventBoxOther, { top, height: h }]}
            >
              <Text style={styles.eventBoxTime}>{e.time}</Text>
              <Text style={styles.eventBoxT} numberOfLines={2}>
                {e.clientName || e.title}
              </Text>
              {h > 52 && e.productName ? <Text style={styles.eventBoxP} numberOfLines={1}>{e.productName}</Text> : null}
            </Pressable>
          );
        })}
      </Pressable>
    );
  };

  const dayHead = (iso) => {
    const d = new Date(iso + "T00:00:00");
    const wd = d.toLocaleDateString("ru-RU", { weekday: "short" });
    const isToday = iso === todayKey;
    return (
      <View key={iso} style={styles.dayHeadCell}>
        <Text style={[styles.dayHeadWd, isToday && { color: C.accent }]}>{wd}</Text>
        <Text style={[styles.dayHeadNum, SERIF, isToday && { color: C.accent }]}>{d.getDate()}</Text>
        {!isWorkday(iso) && <Text style={styles.dayHeadOff}>вых.</Text>}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.wrap}>
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}><H1>Календарь</H1></View>
          <PrimaryButton title="График" tone="soft" onPress={() => setSchedModal(true)} />
          <BrainButton onPress={() => navigation.navigate("AIChat")} />
        </View>

        {/* Панель управления: стрелки, дата, действия */}
        <View style={styles.toolbar}>
          <Pressable onPress={() => setStartDate(addDays(startDate, -1))} style={styles.arrow}>
            <Text style={styles.arrowT}>‹</Text>
          </Pressable>
          <Pressable onPress={() => setDateModal(true)} style={styles.dateBtn}>
            <Text style={styles.dateBtnT}>📅 {monthTitle}</Text>
          </Pressable>
          <Pressable onPress={() => setStartDate(addDays(startDate, 1))} style={styles.arrow}>
            <Text style={styles.arrowT}>›</Text>
          </Pressable>
        </View>

        <View style={styles.actionsRow}>
          <PrimaryButton title="＋ Запись" onPress={() => openEventModal(startDate)} />
          <PrimaryButton title="Закрыть время" tone="soft" onPress={() => openBlockModal(startDate)} />
          <Pressable onPress={() => setStartDate(todayKey)} style={styles.todayBtn}>
            <Text style={styles.todayBtnT}>Сегодня</Text>
          </Pressable>
        </View>

        {/* Шапка дней */}
        <View style={styles.dayHeadRow}>
          <View style={{ width: GUTTER }} />
          {days.map(dayHead)}
        </View>
      </View>

      {/* Сетка времени */}
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.grid}>
          <View style={{ width: GUTTER, height: gridHeight }}>
            {hours.map((m) => (
              <View key={m} style={[styles.hourLabelBox, { height: HOUR_H }]}>
                <Text style={styles.hourLabel}>{String(m / 60).padStart(2, "0")}:00</Text>
              </View>
            ))}
          </View>
          <View style={{ flex: 1, flexDirection: "row", position: "relative" }}>
            {/* Горизонтальные линии часов */}
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height: gridHeight }]}>
              {hours.map((m, i) => (
                <View key={m} style={{ height: HOUR_H, borderTopWidth: 1, borderTopColor: C.line }} />
              ))}
            </View>
            {days.map(renderDayColumn)}
          </View>
        </View>
      </ScrollView>

      {/* ---------- Всплывающие окна ---------- */}

      <Popup visible={dateModal} onClose={() => setDateModal(false)} title="Выберите дату">
        <MiniCalendar value={startDate} onPick={(iso) => { setStartDate(iso); setDateModal(false); }} />
      </Popup>

      <Popup visible={eventModal} onClose={() => setEventModal(false)} title="Новая запись">
        <Text style={styles.label}>Дата</Text>
        <View style={styles.chipsRow}>
          {days.map((d) => (
            <Pressable key={d} onPress={() => setForm((f) => ({ ...f, date: d }))} style={[styles.chip, form.date === d && styles.chipOn]}>
              <Text style={[styles.chipT, form.date === d && styles.chipTOn]}>{showDate(d).slice(0, 5)}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Клиент или название события *</Text>
        <TextInput
          value={form.clientText} onChangeText={onClientText} onFocus={() => setClientSug(true)}
          placeholder="Начните вводить имя…" placeholderTextColor={C.inkSoft} style={styles.input}
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
          value={form.productText} onChangeText={onProductText} onFocus={() => setProductSug(true)}
          placeholder="Начните вводить название…" placeholderTextColor={C.inkSoft} style={styles.input}
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
              onBlur={() => setForm((f) => ({ ...f, time: normalizeTime(f.time) }))}
              placeholder="--:--" placeholderTextColor={C.inkSoft} keyboardType="numeric" maxLength={5}
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Длительность, мин</Text>
            <TextInput
              value={form.durationMin}
              onChangeText={(v) => setForm((f) => ({ ...f, durationMin: v }))}
              placeholder="50" placeholderTextColor={C.inkSoft} keyboardType="numeric" style={styles.input}
            />
          </View>
        </View>

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <View style={styles.rowInputs}>
          <View style={{ flex: 1 }}><PrimaryButton title="Отмена" tone="soft" onPress={() => setEventModal(false)} /></View>
          <View style={{ flex: 1 }}><PrimaryButton title="Сохранить" tone="accent" onPress={saveEvent} /></View>
        </View>
      </Popup>

      <Popup visible={blockModal} onClose={() => setBlockModal(false)} title="Закрыть время">
        <Text style={styles.label}>Дата</Text>
        <View style={styles.chipsRow}>
          {days.map((d) => (
            <Pressable key={d} onPress={() => setBlockForm((f) => ({ ...f, date: d }))} style={[styles.chip, blockForm.date === d && styles.chipOn]}>
              <Text style={[styles.chipT, blockForm.date === d && styles.chipTOn]}>{showDate(d).slice(0, 5)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Серые часы — на них не записывать</Text>
        <View style={styles.rowInputs}>
          <TextInput
            value={blockForm.start}
            onChangeText={(v) => setBlockForm((b) => ({ ...b, start: maskTime(v) }))}
            onBlur={() => setBlockForm((b) => ({ ...b, start: normalizeTime(b.start) }))}
            placeholder="--:--" placeholderTextColor={C.inkSoft} keyboardType="numeric" maxLength={5}
            style={[styles.input, { flex: 1 }]}
          />
          <Text style={{ color: C.inkSoft }}>—</Text>
          <TextInput
            value={blockForm.end}
            onChangeText={(v) => setBlockForm((b) => ({ ...b, end: maskTime(v) }))}
            onBlur={() => setBlockForm((b) => ({ ...b, end: normalizeTime(b.end) }))}
            placeholder="--:--" placeholderTextColor={C.inkSoft} keyboardType="numeric" maxLength={5}
            style={[styles.input, { flex: 1 }]}
          />
        </View>
        {blockError ? <Text style={styles.formError}>{blockError}</Text> : null}
        <View style={styles.rowInputs}>
          <View style={{ flex: 1 }}><PrimaryButton title="Отмена" tone="soft" onPress={() => setBlockModal(false)} /></View>
          <View style={{ flex: 1 }}><PrimaryButton title="Закрыть время" tone="accent" onPress={saveBlock} /></View>
        </View>
      </Popup>

      <Popup visible={schedModal} onClose={() => setSchedModal(false)} title="Рабочий график">
        {schedule && (
          <>
            <Text style={styles.label}>Рабочие дни</Text>
            <View style={styles.chipsRow}>
              {DAY_ORDER.map((d, i) => (
                <Pressable key={d} onPress={() => toggleDay(d)} style={[styles.chip, schedule.days[d] && styles.chipOn]}>
                  <Text style={[styles.chipT, schedule.days[d] && styles.chipTOn]}>{WD[i]}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Часы работы</Text>
            <View style={styles.rowInputs}>
              <TextInput
                value={schedule.start}
                onChangeText={(v) => setSchedule((s) => ({ ...s, start: maskTime(v) }))}
                onBlur={() => setSchedule((s) => ({ ...s, start: normalizeTime(s.start) }))}
                placeholder="--:--" placeholderTextColor={C.inkSoft} keyboardType="numeric" maxLength={5}
                style={[styles.input, { flex: 1 }]}
              />
              <Text style={{ color: C.inkSoft }}>—</Text>
              <TextInput
                value={schedule.end}
                onChangeText={(v) => setSchedule((s) => ({ ...s, end: maskTime(v) }))}
                onBlur={() => setSchedule((s) => ({ ...s, end: normalizeTime(s.end) }))}
                placeholder="--:--" placeholderTextColor={C.inkSoft} keyboardType="numeric" maxLength={5}
                style={[styles.input, { flex: 1 }]}
              />
            </View>
            <Text style={styles.label}>Период действия (пусто = бессрочно) — нажмите, чтобы выбрать дату</Text>
            <View style={styles.rowInputs}>
              <Pressable
                onPress={() => setPickerFor(pickerFor === "from" ? null : "from")}
                style={[styles.input, { flex: 1, justifyContent: "center" }, pickerFor === "from" && styles.inputActive]}
              >
                <Text style={{ fontSize: 14, color: schedFrom ? C.ink : C.inkSoft }}>
                  {schedFrom ? `с ${showDate(schedFrom)}` : "с …"}
                </Text>
              </Pressable>
              <Text style={{ color: C.inkSoft }}>—</Text>
              <Pressable
                onPress={() => setPickerFor(pickerFor === "to" ? null : "to")}
                style={[styles.input, { flex: 1, justifyContent: "center" }, pickerFor === "to" && styles.inputActive]}
              >
                <Text style={{ fontSize: 14, color: schedTo ? C.ink : C.inkSoft }}>
                  {schedTo ? `по ${showDate(schedTo)}` : "по …"}
                </Text>
              </Pressable>
            </View>
            {pickerFor && (
              <MiniCalendar
                value={pickerFor === "from" ? schedFrom : schedTo}
                onPick={(iso) => {
                  if (pickerFor === "from") setSchedFrom(iso); else setSchedTo(iso);
                  setPickerFor(null);
                }}
              />
            )}
            {(schedFrom || schedTo) ? (
              <Pressable onPress={() => { setSchedFrom(""); setSchedTo(""); }}>
                <Text style={styles.clearPeriod}>Сбросить период</Text>
              </Pressable>
            ) : null}
            <PrimaryButton title="Сохранить график" tone="accent" onPress={saveSched} />
          </>
        )}
      </Popup>
    </View>
  );
}

const mini = StyleSheet.create({
  box: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 8, marginBottom: 8 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nav: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  navT: { fontSize: 18, color: C.primary },
  title: { fontSize: 13, fontWeight: "600", color: C.ink },
  week: { flexDirection: "row" },
  wd: { flex: 1, textAlign: "center", fontSize: 10, color: C.inkSoft, paddingVertical: 3 },
  cell: { flex: 1, aspectRatio: 1.2, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  cellSel: { backgroundColor: C.primary },
  cellT: { fontSize: 12, color: C.ink },
  cellTSel: { color: C.white, fontWeight: "700" },
});

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 16 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  arrow: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  arrowT: { fontSize: 20, color: C.primary },
  dateBtn: { flex: 1, height: 40, borderRadius: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  dateBtnT: { fontSize: 14, color: C.ink, fontWeight: "600" },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" },
  todayBtn: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.white },
  todayBtnT: { fontSize: 13, color: C.inkSoft },
  dayHeadRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 6 },
  dayHeadCell: { flex: 1, alignItems: "center" },
  dayHeadWd: { fontSize: 11, color: C.inkSoft },
  dayHeadNum: { fontSize: 18, color: C.ink },
  dayHeadOff: { fontSize: 9, color: C.accent },
  grid: { flexDirection: "row", paddingHorizontal: 16 },
  hourLabelBox: { alignItems: "flex-start" },
  hourLabel: { fontSize: 10, color: C.inkSoft, marginTop: -6 },
  dayCol: { flex: 1, borderLeftWidth: 1, borderLeftColor: C.line, position: "relative" },
  dayColOff: { backgroundColor: "#ECEEEB" },
  eventBox: {
    position: "absolute", left: 3, right: 3, borderRadius: 8, padding: 4,
    backgroundColor: C.primarySoft, borderLeftWidth: 3, borderLeftColor: C.primary, overflow: "hidden",
  },
  eventBoxOther: { backgroundColor: C.accentSoft, borderLeftColor: C.accent },
  eventBoxTime: { fontSize: 9, color: C.inkSoft },
  eventBoxT: { fontSize: 11, fontWeight: "600", color: C.ink, lineHeight: 14 },
  eventBoxP: { fontSize: 9, color: C.inkSoft, marginTop: 1 },
  blockBox: {
    position: "absolute", left: 3, right: 3, borderRadius: 8, padding: 4,
    backgroundColor: "#DDE0DC", overflow: "hidden", justifyContent: "center",
  },
  blockBoxT: { fontSize: 10, color: C.inkSoft, fontWeight: "600" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(36,51,44,0.4)", alignItems: "center", justifyContent: "center", padding: 16 },
  modalCard: { width: "100%", maxWidth: 420, backgroundColor: C.white, borderRadius: 16, padding: 16 },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: "700", color: C.ink },
  modalClose: { padding: 6 },
  label: { fontSize: 11, color: C.inkSoft, marginBottom: 6, marginTop: 2 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipT: { fontSize: 12, color: C.ink },
  chipTOn: { color: C.white },
  input: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.ink, marginBottom: 8,
  },
  inputActive: { borderColor: C.primary },
  rowInputs: { flexDirection: "row", gap: 8, alignItems: "center" },
  formError: { fontSize: 12, color: C.accent, marginBottom: 8 },
  clearPeriod: { fontSize: 12, color: C.accent, fontWeight: "600", marginBottom: 8 },
  sugBox: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, marginTop: -4, marginBottom: 8, overflow: "hidden" },
  sugRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  sugT: { fontSize: 13, color: C.ink, fontWeight: "600" },
  sugMeta: { fontSize: 11, color: C.inkSoft },
});
