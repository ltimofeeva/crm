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
  getEvents, addEvent, deleteEvent, getClients, getProducts, getSchedule, saveSchedule,
  getBlocks, addBlock, updateBlock, deleteBlock,
  relinkClientHistoryEvent,
} from "../storage/store";
import { confirmAsync } from "../utils/confirm";
import {
  WD, dateKey, addDays, showDate, toMin, maskTime, validTime, normalizeTime,
} from "../utils/datetime";
import MiniCalendar from "../components/MiniCalendar";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Пн..Вс в терминах getDay()
const HOUR_H = 56;   // высота часа в пикселях
const GUTTER = 48;   // ширина колонки времени

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

const EMPTY_FORM = { date: "", clientText: "", clientId: null, productText: "", productId: null, time: "", durationMin: "", price: "" };

export default function CalendarScreen({ navigation, route }) {
  const [startDate, setStartDate] = useState(dateKey(new Date()));
  // Режим переноса записи: пришли из карточки события.
  const [resEvent, setResEvent] = useState(null);
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

  // Форма закрытия времени. blockEditId: null — новый блок, иначе правка.
  const [blockForm, setBlockForm] = useState({ date: "", start: "", end: "", title: "" });
  const [blockError, setBlockError] = useState("");
  const [blockEditId, setBlockEditId] = useState(null);

  // График.
  const [schedFrom, setSchedFrom] = useState("");
  const [schedTo, setSchedTo] = useState("");
  const [pickerFor, setPickerFor] = useState(null);

  const load = useCallback(async () => {
    const evs = await getEvents();
    setEvents(evs);
    setClients(await getClients());
    setProducts(await getProducts());
    const s = await getSchedule();
    setSchedule(s);
    setSchedFrom(s.from || "");
    setSchedTo(s.to || "");
    setBlocks(await getBlocks());
    // Пришли с параметром переноса — включаем режим и показываем дату записи.
    const rid = route.params?.rescheduleId;
    if (rid) {
      const ev = evs.find((e) => e.id === rid);
      if (ev) {
        setResEvent(ev);
        setStartDate(ev.date);
      }
      navigation.setParams({ rescheduleId: undefined });
    }
  }, [route.params?.rescheduleId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cancelReschedule = () => setResEvent(null);

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

  // Кнопка выбора даты показывает актуальную выбранную дату.
  const selectedTitle = (() => {
    const d = new Date(startDate + "T00:00:00");
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  })();

  // ---------- Запись ----------

  const openEventModal = (date) => {
    if (resEvent) {
      // Режим переноса: данные клиента и продукта подставляются автоматически.
      setForm({
        date: date || startDate,
        clientText: resEvent.clientName || resEvent.title,
        clientId: resEvent.clientId || null,
        productText: resEvent.productName || "",
        productId: resEvent.productId || null,
        time: "",
        durationMin: String(resEvent.durationMin || ""),
        price: resEvent.price != null ? String(resEvent.price) : "",
      });
    } else {
      setForm({ ...EMPTY_FORM, date: date || startDate });
    }
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
      // Цена подставляется из продукта, но её можно поправить руками.
      price: exact ? String(exact.price || "") : f.price,
    }));
    setProductSug(true);
  };
  const pickProduct = (p) => {
    setForm((f) => ({
      ...f, productText: p.name, productId: p.id,
      durationMin: String(p.durationMin), price: String(p.price || ""),
    }));
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
    const data = {
      date: form.date,
      time: time.padStart(5, "0"),
      durationMin: durM,
      title: client ? `Сессия: ${client.name}` : form.clientText.trim(),
      clientId: client?.id || null,
      clientName: client?.name || null,
      productId: product?.id || null,
      productName,
      price: (() => {
        const p = parseInt(String(form.price).replace(/\D/g, ""), 10);
        return Number.isFinite(p) ? p : (product?.price || null);
      })(),
      type: client ? "session" : "other",
    };

    // Режим переноса: подтверждаем удаление старой записи и создание новой.
    if (resEvent) {
      const who = resEvent.clientName || resEvent.title;
      const ok = await confirmAsync(
        "Перенос записи",
        `Вы хотите удалить запись ${who} с ${showDate(resEvent.date)} ${resEvent.time} и создать новую запись на ${showDate(form.date)} ${data.time}?`,
        "Да", "Отмена",
      );
      if (!ok) return;
      await deleteEvent(resEvent.id);
      const newEv = await addEvent({
        ...data,
        note: resEvent.note || "",
        status: resEvent.status || "none",
      });
      // Перевешиваем запись в истории клиента на новое событие.
      if (newEv.clientId) {
        await relinkClientHistoryEvent(newEv.clientId, resEvent.id, newEv);
      }
      setEventModal(false);
      setForm(EMPTY_FORM);
      setResEvent(null);
      load();
      return;
    }

    await addEvent(data);
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
    setBlockEditId(null);
    setBlockForm({ date: date || startDate, start: "", end: "", title: "" });
    setBlockError("");
    setBlockModal(true);
  };

  // Клик по серой плашке — редактирование: время, название, удаление.
  const openBlockEdit = (b) => {
    setBlockEditId(b.id);
    setBlockForm({ date: b.date, start: b.start, end: b.end, title: b.title || "" });
    setBlockError("");
    setBlockModal(true);
  };

  const saveBlock = async () => {
    const start = normalizeTime(blockForm.start);
    const end = normalizeTime(blockForm.end);
    if (!start || !end) { setBlockError("Укажите время «с» и «до»."); return; }
    if (toMin(end) <= toMin(start)) { setBlockError("Время «до» должно быть позже времени «с»."); return; }
    const data = { date: blockForm.date, start, end, title: blockForm.title.trim() };
    if (blockEditId) {
      await updateBlock(blockEditId, data);
    } else {
      await addBlock(data);
    }
    setBlockModal(false);
    load();
  };

  const removeBlock = async () => {
    if (!blockEditId) return;
    if (await confirmAsync("Удаление", "Вы действительно хотите удалить событие?", "Удалить", "Отмена")) {
      await deleteBlock(blockEditId);
      setBlockModal(false);
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
            <Pressable key={b.id} onPress={() => openBlockEdit(b)} style={[styles.blockBox, { top, height: h }]}>
              <Text style={styles.blockBoxT} numberOfLines={1}>⛔ {b.title || "Закрыто"}</Text>
              {h > 36 ? <Text style={styles.blockBoxTime}>{b.start}–{b.end}</Text> : null}
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
              {h > 52 && (e.productName || e.price) ? (
                <Text style={styles.eventBoxP} numberOfLines={1}>
                  {[e.productName, e.price ? `${e.price} ₽` : null].filter(Boolean).join(" · ")}
                </Text>
              ) : null}
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
      // Нажатие на дату делает её первой в окне (13 → показываются 13/14/15).
      <Pressable key={iso} style={styles.dayHeadCell} onPress={() => setStartDate(iso)}>
        <Text style={[styles.dayHeadWd, isToday && { color: C.accent }]}>{wd}</Text>
        <Text style={[styles.dayHeadNum, SERIF, isToday && { color: C.accent }]}>{d.getDate()}</Text>
        {!isWorkday(iso) && <Text style={styles.dayHeadOff}>вых.</Text>}
      </Pressable>
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

        {/* Выбор даты вручную */}
        <Text style={styles.pickLabel}>Выберите дату</Text>
        <View style={styles.toolbar}>
          <Pressable onPress={() => setDateModal(true)} style={styles.dateBtn}>
            <Text style={styles.dateBtnT}>📅 {selectedTitle}</Text>
          </Pressable>
        </View>

        {resEvent && (
          <View style={styles.resBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.resTitle}>
                Перенос: {resEvent.clientName || resEvent.title}
              </Text>
              <Text style={styles.resText}>
                Было: {showDate(resEvent.date)} в {resEvent.time}. Выберите новый
                день и нажмите «＋ Запись» — данные подставятся автоматически.
              </Text>
            </View>
            <Pressable onPress={cancelReschedule} style={{ padding: 6 }}>
              <Text style={{ fontSize: 15, color: C.accent }}>✕</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.actionsRow}>
          <PrimaryButton title="＋ Запись" onPress={() => openEventModal(startDate)} />
          {!resEvent && <PrimaryButton title="Закрыть время" tone="soft" onPress={() => openBlockModal(startDate)} />}
          <Pressable onPress={() => setStartDate(todayKey)} style={styles.todayBtn}>
            <Text style={styles.todayBtnT}>Сегодня</Text>
          </Pressable>
        </View>

        {/* Шапка дней: стрелки у крайних дат, клик по дате листает к ней */}
        <View style={styles.dayHeadRow}>
          <Pressable onPress={() => setStartDate(addDays(startDate, -1))} style={[styles.edgeArrow, { width: GUTTER }]}>
            <Text style={styles.arrowT}>‹</Text>
          </Pressable>
          {days.map(dayHead)}
          <Pressable onPress={() => setStartDate(addDays(startDate, 1))} style={[styles.edgeArrow, { width: 28 }]}>
            <Text style={styles.arrowT}>›</Text>
          </Pressable>
        </View>
      </View>

      {/* Сетка времени */}
      <ScrollView contentContainerStyle={{ paddingBottom: 24, paddingTop: 10 }}>
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
            <View style={{ width: 28 }} />
          </View>
        </View>
      </ScrollView>

      {/* ---------- Всплывающие окна ---------- */}

      <Popup visible={dateModal} onClose={() => setDateModal(false)} title="Выберите дату">
        <MiniCalendar value={startDate} onPick={(iso) => { setStartDate(iso); setDateModal(false); }} />
      </Popup>

      <Popup visible={eventModal} onClose={() => setEventModal(false)} title={resEvent ? "Перенос записи" : "Новая запись"}>
        <Text style={styles.label}>Дата</Text>
        <View style={styles.chipsRow}>
          {days.map((d) => (
            <Pressable key={d} onPress={() => setForm((f) => ({ ...f, date: d }))} style={[styles.chip, form.date === d && styles.chipOn]}>
              <Text style={[styles.chipT, form.date === d && styles.chipTOn]}>{showDate(d).slice(0, 5)}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Клиент или название события *</Text>
        <View style={styles.fieldWrapHigh}>
          <TextInput
            value={form.clientText} onChangeText={onClientText}
            onFocus={() => { setClientSug(true); setProductSug(false); }}
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
        </View>

        <Text style={styles.label}>Продукт (можно свой)</Text>
        <View style={styles.fieldWrap}>
          <TextInput
            value={form.productText} onChangeText={onProductText}
            onFocus={() => { setProductSug(true); setClientSug(false); }}
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
        </View>

        <View style={styles.rowInputs}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Время *</Text>
            <TextInput
              value={form.time}
              onChangeText={(v) => setForm((f) => ({ ...f, time: maskTime(v) }))}
              onFocus={() => { setClientSug(false); setProductSug(false); }}
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
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Цена, ₽</Text>
            <TextInput
              value={form.price}
              onChangeText={(v) => setForm((f) => ({ ...f, price: v.replace(/\D/g, "") }))}
              placeholder="0" placeholderTextColor={C.inkSoft} keyboardType="numeric" style={styles.input}
            />
          </View>
        </View>

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <View style={styles.rowInputs}>
          <View style={{ flex: 1 }}><PrimaryButton title="Отмена" tone="soft" onPress={() => setEventModal(false)} /></View>
          <View style={{ flex: 1 }}><PrimaryButton title="Сохранить" tone="accent" onPress={saveEvent} /></View>
        </View>
      </Popup>

      <Popup
        visible={blockModal}
        onClose={() => setBlockModal(false)}
        title={blockEditId ? "Закрытое время" : "Закрыть время"}
      >
        <Text style={styles.label}>Дата</Text>
        <View style={styles.chipsRow}>
          {(blockEditId && !days.includes(blockForm.date) ? [blockForm.date, ...days] : days).map((d) => (
            <Pressable key={d} onPress={() => setBlockForm((f) => ({ ...f, date: d }))} style={[styles.chip, blockForm.date === d && styles.chipOn]}>
              <Text style={[styles.chipT, blockForm.date === d && styles.chipTOn]}>{showDate(d).slice(0, 5)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Название (например: Обед, Супервизия)</Text>
        <TextInput
          value={blockForm.title}
          onChangeText={(v) => setBlockForm((b) => ({ ...b, title: v }))}
          placeholder="Закрыто"
          placeholderTextColor={C.inkSoft}
          style={styles.input}
        />
        <Text style={styles.label}>Серые часы — на них не записывать</Text>
        <View style={styles.rowInputs}>
          <TextInput
            value={blockForm.start}
            onChangeText={(v) => setBlockForm((b) => ({ ...b, start: maskTime(v) }))}
            onBlur={() => setBlockForm((b) => ({ ...b, start: normalizeTime(b.start) }))}
            placeholder="--:--" placeholderTextColor={C.inkSoft} keyboardType="numeric" maxLength={5}
            style={styles.timeInput}
          />
          <Text style={{ color: C.inkSoft }}>—</Text>
          <TextInput
            value={blockForm.end}
            onChangeText={(v) => setBlockForm((b) => ({ ...b, end: maskTime(v) }))}
            onBlur={() => setBlockForm((b) => ({ ...b, end: normalizeTime(b.end) }))}
            placeholder="--:--" placeholderTextColor={C.inkSoft} keyboardType="numeric" maxLength={5}
            style={styles.timeInput}
          />
        </View>
        {blockError ? <Text style={styles.formError}>{blockError}</Text> : null}
        <View style={styles.rowInputs}>
          {blockEditId ? (
            <View style={{ flex: 1 }}><PrimaryButton title="Удалить" tone="soft" onPress={removeBlock} /></View>
          ) : (
            <View style={{ flex: 1 }}><PrimaryButton title="Отмена" tone="soft" onPress={() => setBlockModal(false)} /></View>
          )}
          <View style={{ flex: 1 }}>
            <PrimaryButton title={blockEditId ? "Сохранить" : "Закрыть время"} tone="accent" onPress={saveBlock} />
          </View>
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
                style={styles.timeInput}
              />
              <Text style={{ color: C.inkSoft }}>—</Text>
              <TextInput
                value={schedule.end}
                onChangeText={(v) => setSchedule((s) => ({ ...s, end: maskTime(v) }))}
                onBlur={() => setSchedule((s) => ({ ...s, end: normalizeTime(s.end) }))}
                placeholder="--:--" placeholderTextColor={C.inkSoft} keyboardType="numeric" maxLength={5}
                style={styles.timeInput}
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

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 16 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  pickLabel: { fontSize: 11, color: C.inkSoft, marginBottom: 4 },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  edgeArrow: { alignItems: "center", justifyContent: "center" },
  arrowT: { fontSize: 22, color: C.primary, fontWeight: "600" },
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
  blockBoxTime: { fontSize: 9, color: C.inkSoft, marginTop: 1 },
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
  // Поля времени в строке «с — до»: сжимаются корректно, текст по центру.
  timeInput: {
    flex: 1, minWidth: 0, textAlign: "center",
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12,
    paddingHorizontal: 6, paddingVertical: 10, fontSize: 14, color: C.ink, marginBottom: 8,
  },
  resBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: C.accentSoft, borderRadius: 12, padding: 12, marginBottom: 10,
  },
  resTitle: { fontSize: 13, fontWeight: "700", color: C.accent },
  resText: { fontSize: 12, color: C.ink, lineHeight: 17, marginTop: 2 },
  rowInputs: { flexDirection: "row", gap: 8, alignItems: "center" },
  formError: { fontSize: 12, color: C.accent, marginBottom: 8 },
  clearPeriod: { fontSize: 12, color: C.accent, fontWeight: "600", marginBottom: 8 },
  // Обёртки полей с подсказками: список раскрывается ПОВЕРХ содержимого окна.
  fieldWrapHigh: { position: "relative", zIndex: 30 },
  fieldWrap: { position: "relative", zIndex: 20 },
  sugBox: {
    position: "absolute", top: 44, left: 0, right: 0, zIndex: 50, elevation: 8,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#24332C", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  sugRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  sugT: { fontSize: 13, color: C.ink, fontWeight: "600" },
  sugMeta: { fontSize: 11, color: C.inkSoft },
});
