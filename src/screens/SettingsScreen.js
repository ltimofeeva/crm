// Настройки деятельности (⚙): продукты специалиста, «О себе»,
// агент-распаковка, подписка и очистка данных.

import React, { useState, useCallback, useRef } from "react";
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import { confirmAsync } from "../utils/confirm";
import { useFocusEffect } from "@react-navigation/native";
import { C, R } from "../theme";
import { Card, Tag, H1, PrimaryButton, BrainButton } from "../components/ui";
import {
  getProducts, addProduct, deleteProduct, updateProduct,
  getProfile, saveProfile, clearAllData,
  getBookingSettings, saveBookingSettings,
} from "../storage/store";
import { fetchBookingLink } from "../api/bookings";
import * as Clipboard from "expo-clipboard";
import { UNPACK_PROMPT } from "../api/ai";
import { useSubscription } from "../context/SubscriptionContext";
import { useAuth } from "../context/AuthContext";

// Подпись поля со свёрнутой подсказкой. На телефоне подсказка открывается
// нажатием (наведения там нет), на компьютере — ещё и наведением.
function FieldLabel({ text, open, onToggle, onHoverIn, onHoverOut, hint }) {
  return (
    <>
      <View style={styles.lblRow}>
        <Text style={styles.bkLabelInline}>{text}</Text>
        <Pressable
          onPress={onToggle}
          onHoverIn={onHoverIn}
          onHoverOut={onHoverOut}
          hitSlop={10}
          style={[styles.qm, open && styles.qmOn]}
        >
          <Text style={[styles.qmT, open && styles.qmTOn]}>!</Text>
        </Pressable>
      </View>
      {open ? <Text style={styles.tip}>{hint}</Text> : null}
    </>
  );
}

// Числовое поле с единицей измерения справа.
function NumField({ value, onChangeText, onBlur, unit, placeholder }) {
  return (
    <View style={styles.numWrap}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        keyboardType="numeric"
        placeholder={placeholder}
        placeholderTextColor={C.inkFaint}
        style={styles.numInput}
      />
      <Text style={styles.numUnit}>{unit}</Text>
    </View>
  );
}

const EMPTY_PRODUCT = { name: "", durationMin: "", price: "", about: "" };

export default function SettingsScreen({ navigation, route }) {
  const sub = useSubscription();
  const { isPro } = sub;
  const { user, signOut } = useAuth();
  const [products, setProducts] = useState([]);
  const [profile, setProfile] = useState({ activity: "", approach: "", strengths: "" });
  const [prodOpen, setProdOpen] = useState(false);
  const [prod, setProd] = useState(EMPTY_PRODUCT);
  const [profileSaved, setProfileSaved] = useState(false);
  const [booking, setBooking] = useState(null);
  const [bookingLink, setBookingLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [openHint, setOpenHint] = useState(null);   // какая подсказка раскрыта
  const [draft, setDraft] = useState({});           // что набрано в числовых полях
  // На компьютере подсказку открывает наведение. Без этой пометки клик сразу
  // после наведения закрывал бы её — палец/курсор ещё на значке, а подсказки нет.
  const hoverRef = useRef(null);

  const hintIn = (key) => () => { hoverRef.current = key; setOpenHint(key); };
  const hintOut = (key) => () => {
    if (hoverRef.current === key) hoverRef.current = null;
    setOpenHint((k) => (k === key ? null : k));
  };
  // Нажатие нужно там, где наведения нет (телефон). Если подсказку уже показало
  // наведение — нажатие ничего не меняет.
  const hintTap = (key) => () => {
    if (hoverRef.current === key) return;
    setOpenHint((k) => (k === key ? null : key));
  };

  const load = useCallback(async () => {
    setProducts(await getProducts());
    setProfile(await getProfile());
    setBooking(await getBookingSettings());
    try { setBookingLink(await fetchBookingLink()); } catch (e) { /* нет связи */ }
    // Пришли из календаря с новым продуктом — открываем форму с именем.
    const newProductName = route.params?.newProductName;
    if (newProductName) {
      navigation.setParams({ newProductName: undefined });
      setProd({ ...EMPTY_PRODUCT, name: newProductName });
      setProdOpen(true);
    }
  }, [route.params?.newProductName]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setP = (k) => (v) => setProd((p) => ({ ...p, [k]: v }));
  const setPr = (k) => (v) => { setProfile((p) => ({ ...p, [k]: v })); setProfileSaved(false); };

  const saveProduct = async () => {
    if (!prod.name.trim()) return;
    await addProduct(prod);
    setProd(EMPTY_PRODUCT);
    setProdOpen(false);
    load();
  };

  // Часовой пояс запоминаем при включении: клиенту показываем время
  // специалиста и подписываем пояс, чтобы никто не перепутал.
  const toggleBooking = async () => {
    const next = { ...booking, enabled: !booking.enabled };
    if (next.enabled && !next.tz) {
      try { next.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    }
    setBooking(next);
    await saveBookingSettings(next);
    if (next.enabled && !bookingLink) {
      try { setBookingLink(await fetchBookingLink()); } catch (e) {}
    }
  };

  // Разумные границы: шаг в 1 минуту или календарь на 0 дней сделали бы
  // онлайн-запись бессмысленной. Молча подтягиваем к границе, без ругани.
  const LIMITS = {
    stepMin: { min: 5, max: 480, def: 60 },
    bufferMin: { min: 0, max: 240, def: 0 },
    minLeadHours: { min: 0, max: 168, def: 3 },
    maxDaysAhead: { min: 1, max: 365, def: 30 },
  };

  // Пока поле редактируют, показываем набранное; после выхода — сохранённое.
  const fieldValue = (key) =>
    draft[key] !== undefined ? draft[key] : String(booking?.[key] ?? "");

  const onFieldChange = (key) => (v) =>
    setDraft((d) => ({ ...d, [key]: v.replace(/\D/g, "").slice(0, 4) }));

  // Проверяем и сохраняем, когда человек ушёл с поля.
  const onFieldBlur = (key) => async () => {
    const raw = draft[key];
    setDraft((d) => { const n = { ...d }; delete n[key]; return n; });
    if (raw === undefined) return;
    const lim = LIMITS[key];
    const n = raw === "" ? lim.def : Math.min(lim.max, Math.max(lim.min, parseInt(raw, 10)));
    if (n !== booking[key]) await setBk(key, n);
  };

  const setBk = async (key, value) => {
    const next = { ...booking, [key]: value };
    setBooking(next);
    await saveBookingSettings(next);
  };

  const fullLink = bookingLink
    ? (typeof window !== "undefined" && window.location ? window.location.origin : "") + bookingLink
    : "";

  const copyLink = async () => {
    if (!fullLink) return;
    await Clipboard.setStringAsync(fullLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1800);
  };

  const removeProduct = async (p) => {
    if (await confirmAsync("Удалить продукт?", p.name, "Удалить", "Отмена")) {
      await deleteProduct(p.id);
      load();
    }
  };

  const persistProfile = async () => {
    await saveProfile(profile);
    setProfileSaved(true);
  };

  const unpack = () => navigation.navigate("AIChat", { preset: UNPACK_PROMPT, unpack: true });

  const logout = async () => {
    if (await confirmAsync(
      "Выйти из аккаунта?",
      "Данные останутся на устройстве. Чтобы снова войти, потребуется логин и пароль.",
      "Выйти", "Отмена",
    )) {
      await signOut();
    }
  };

  const wipe = async () => {
    if (await confirmAsync(
      "Стереть все данные?",
      "Клиенты, заметки, события, продукты и профиль будут удалены безвозвратно.",
      "Стереть", "Отмена",
    )) {
      await clearAllData();
      load();
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <H1 sub="Продукты и профиль учитываются во всех ответах ассистента">Настройки</H1>
        </View>
        <BrainButton onPress={() => navigation.navigate("AIChat")} />
      </View>

      <Text style={styles.section}>ПРОДУКТЫ (УСЛУГИ)</Text>
      {products.map((p) => (
        <Card key={p.id} style={styles.product}>
          <View style={{ flex: 1 }}>
            <Text style={styles.prodName}>{p.name}</Text>
            <Text style={styles.prodMeta}>
              {p.durationMin} мин{p.price ? ` · ${p.price.toLocaleString("ru-RU")} ₽` : ""}
            </Text>
            {p.about ? <Text style={styles.prodAbout}>{p.about}</Text> : null}
            <Pressable
              onPress={async () => { await updateProduct(p.id, { online: !p.online }); load(); }}
              style={styles.onlineRow}
            >
              <View style={[styles.box, p.online && styles.boxOn]}>
                {p.online ? <Text style={styles.boxTick}>✓</Text> : null}
              </View>
              <Text style={styles.onlineT}>Доступна для онлайн-записи</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => removeProduct(p)}><Text style={styles.del}>✕</Text></Pressable>
        </Card>
      ))}

      {!prodOpen ? (
        <PrimaryButton title="＋ Добавить продукт" tone="soft" onPress={() => setProdOpen(true)} />
      ) : (
        <Card style={styles.form}>
          <TextInput value={prod.name} onChangeText={setP("name")} placeholder="Название (например: Индивидуальная сессия) *" placeholderTextColor={C.inkSoft} style={styles.input} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput value={prod.durationMin} onChangeText={setP("durationMin")} placeholder="Минут (50)" placeholderTextColor={C.inkSoft} keyboardType="numeric" style={[styles.input, { flex: 1 }]} />
            <TextInput value={prod.price} onChangeText={setP("price")} placeholder="Цена, ₽" placeholderTextColor={C.inkSoft} keyboardType="numeric" style={[styles.input, { flex: 1 }]} />
          </View>
          <TextInput value={prod.about} onChangeText={setP("about")} multiline placeholder="О чём продукт: для кого, какую проблему решает" placeholderTextColor={C.inkSoft} style={[styles.input, styles.textarea]} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><PrimaryButton title="Отмена" tone="soft" onPress={() => setProdOpen(false)} /></View>
            <View style={{ flex: 1 }}><PrimaryButton title="Сохранить" tone="accent" onPress={saveProduct} /></View>
          </View>
          <Text style={styles.hint}>
            Длительность бронирует окно нужного размера при записи в календаре.
            Описание помогает ИИ предлагать продукт подходящим клиентам.
          </Text>
        </Card>
      )}

      <Text style={styles.section}>О СЕБЕ</Text>
      <Card style={styles.form}>
        <TextInput value={profile.activity} onChangeText={setPr("activity")} multiline placeholder="Чем вы занимаетесь (например: психолог, работаю с тревожностью и выгоранием)" placeholderTextColor={C.inkSoft} style={[styles.input, styles.textarea]} />
        <TextInput value={profile.approach} onChangeText={setPr("approach")} multiline placeholder="Особенности и подход (методы, формат, ценности)" placeholderTextColor={C.inkSoft} style={[styles.input, styles.textarea]} />
        <TextInput value={profile.strengths} onChangeText={setPr("strengths")} multiline placeholder="Сильные стороны (что получается лучше всего, за что благодарят клиенты)" placeholderTextColor={C.inkSoft} style={[styles.input, styles.textarea]} />
        <PrimaryButton title={profileSaved ? "Сохранено ✓" : "Сохранить профиль"} tone="accent" onPress={persistProfile} />
      </Card>

      <Card style={styles.unpack} onPress={unpack}>
        <Text style={styles.unpackTitle}>🪄 Распаковка с ИИ</Text>
        <Text style={styles.unpackText}>
          Сложно описать себя и придумать продукты? Ассистент проведёт интервью
          в 6 этапов: опыт → навыки → аудитория → продукт → цена → позиционирование.
          Результат перенесите в поля выше.
        </Text>
        <Text style={styles.unpackCta}>Начать интервью →</Text>
      </Card>

      <Text style={styles.section}>МОЙ СТИЛЬ СООБЩЕНИЙ</Text>
      <Card style={styles.form}>
        <Text style={styles.voiceHint}>
          Вставьте сюда 5–10 своих реальных сообщений клиентам (как вы приветствуете,
          напоминаете, приглашаете). Ассистент выучит ваш тон, любимые фразы и манеру —
          и составленные им сообщения будет не отличить от ваших.
        </Text>
        <TextInput
          value={profile.voice}
          onChangeText={setPr("voice")}
          multiline
          placeholder={"Например:\n«Аня, добрый день! Напоминаю про нашу встречу завтра в 14:00 🌿»\n«Привет! Как ты после прошлой сессии?»"}
          placeholderTextColor={C.inkSoft}
          style={[styles.input, styles.voiceArea]}
        />
        <PrimaryButton title={profileSaved ? "Сохранено ✓" : "Сохранить стиль"} tone="accent" onPress={persistProfile} />
      </Card>

      <Text style={styles.section}>ОСОБЕННОСТИ РАБОТЫ</Text>
      <Card style={styles.form}>
        <Text style={styles.voiceHint}>
          Как вы работаете: правила записи и переноса, форматы встреч, когда и
          как вам удобно связываться с клиентами, что вы никогда не делаете.
          Ассистент будет учитывать это во всех рекомендациях — особенно в
          напоминаниях о связи с клиентами.
        </Text>
        <TextInput
          value={profile.workRules}
          onChangeText={setPr("workRules")}
          multiline
          placeholder={"Например:\n«Не пишу клиентам после 20:00»\n«Перенос сессии — не позднее чем за сутки»\n«Новых клиентов беру только на диагностику»"}
          placeholderTextColor={C.inkSoft}
          style={[styles.input, styles.voiceArea]}
        />
        <PrimaryButton title={profileSaved ? "Сохранено ✓" : "Сохранить особенности"} tone="accent" onPress={persistProfile} />
      </Card>

      <Text style={styles.section}>ОНЛАЙН-ЗАПИСЬ</Text>
      {booking && (
        <Card style={styles.form}>
          <Pressable onPress={toggleBooking} style={styles.onlineRow}>
            <View style={[styles.box, booking.enabled && styles.boxOn]}>
              {booking.enabled ? <Text style={styles.boxTick}>✓</Text> : null}
            </View>
            <Text style={styles.bkTitle}>Клиенты могут записываться сами</Text>
          </Pressable>

          {booking.enabled ? (
            <>
              <Text style={styles.bkLabel}>Ссылка для клиентов</Text>
              {bookingLink ? (
                <>
                  <Pressable onPress={copyLink} style={styles.linkBox}>
                    <Text style={styles.linkT} numberOfLines={1}>{fullLink}</Text>
                  </Pressable>
                  <PrimaryButton
                    title={linkCopied ? "Ссылка скопирована ✓" : "Скопировать ссылку"}
                    tone="soft"
                    onPress={copyLink}
                  />
                </>
              ) : (
                <Text style={styles.hint}>Ссылка появится, когда будет связь с сервером.</Text>
              )}

              <FieldLabel
                text="Шаг окошек"
                hint="Интервалы времени, которые увидят клиенты. Например, 60 — окошки в 10:00, 11:00, 12:00; 30 — ещё и в 10:30, 11:30."
                open={openHint === "step"}
                onToggle={hintTap("step")}
                onHoverIn={hintIn("step")}
                onHoverOut={hintOut("step")}
              />
              <NumField
                value={fieldValue("stepMin")}
                onChangeText={onFieldChange("stepMin")}
                onBlur={onFieldBlur("stepMin")}
                unit="мин"
                placeholder="60"
              />

              <FieldLabel
                text="Перерыв между встречами"
                hint="Свободное время после каждой встречи. Клиент не сможет записаться впритык к соседней записи. 0 — без перерыва."
                open={openHint === "buffer"}
                onToggle={hintTap("buffer")}
                onHoverIn={hintIn("buffer")}
                onHoverOut={hintOut("buffer")}
              />
              <NumField
                value={fieldValue("bufferMin")}
                onChangeText={onFieldChange("bufferMin")}
                onBlur={onFieldBlur("bufferMin")}
                unit="мин"
                placeholder="0"
              />

              <FieldLabel
                text="Запись закрывается за"
                hint="За сколько часов до начала перестают показывать окошко. Например, 3 — на 15:00 можно записаться только до 12:00."
                open={openHint === "lead"}
                onToggle={hintTap("lead")}
                onHoverIn={hintIn("lead")}
                onHoverOut={hintOut("lead")}
              />
              <NumField
                value={fieldValue("minLeadHours")}
                onChangeText={onFieldChange("minLeadHours")}
                onBlur={onFieldBlur("minLeadHours")}
                unit="ч"
                placeholder="3"
              />

              <FieldLabel
                text="Календарь открыт вперёд на"
                hint="На сколько дней вперёд клиент видит свободное время."
                open={openHint === "horizon"}
                onToggle={hintTap("horizon")}
                onHoverIn={hintIn("horizon")}
                onHoverOut={hintOut("horizon")}
              />
              <NumField
                value={fieldValue("maxDaysAhead")}
                onChangeText={onFieldChange("maxDaysAhead")}
                onBlur={onFieldBlur("maxDaysAhead")}
                unit="дн."
                placeholder="30"
              />

              <FieldLabel
                text="Подсказка клиенту (необязательно)"
                hint="Короткий текст, который клиент увидит на странице записи — над выбором услуги."
                open={openHint === "note"}
                onToggle={hintTap("note")}
                onHoverIn={hintIn("note")}
                onHoverOut={hintOut("note")}
              />
              <TextInput
                value={booking.note}
                onChangeText={(v) => setBk("note", v)}
                multiline
                placeholder="Например: перед первой встречей я коротко созваниваюсь"
                placeholderTextColor={C.inkSoft}
                style={[styles.input, styles.textarea]}
              />

              <Text style={styles.hint}>
                Окошки выдаются только на рабочие часы из графика (белое время
                в календаре) и только по услугам, отмеченным галочкой выше.
                Занятое время, свои дела и перерывы учитываются автоматически.
                Время показывается клиенту по вашему часовому поясу
                {booking.tz ? ` (${booking.tz})` : ""}.
              </Text>
            </>
          ) : (
            <Text style={styles.hint}>
              Включите — и появится ссылка, которую можно отправить клиентам.
              Они выберут услугу и свободное время, запись сразу появится
              в вашем календаре.
            </Text>
          )}
        </Card>
      )}

      <Text style={styles.section}>ТАРИФ</Text>
      <Card style={styles.subRow} onPress={() => navigation.navigate("Paywall")}>
        <View style={{ flex: 1 }}>
          <Text style={styles.prodName}>{sub.planTitle}</Text>
          <Text style={styles.prodMeta}>
            {sub.source === "trial"
              ? `Пробный период: осталось ${sub.trialDaysLeft} дн.`
              : sub.ai
                ? `Осталось ${sub.left.requests.toLocaleString("ru-RU")} запросов к ИИ из ${sub.limits.requests.toLocaleString("ru-RU")} в этом месяце`
                : "ИИ-функции выключены. Нажмите, чтобы посмотреть тарифы."}
          </Text>
        </View>
        <Tag tone={isPro ? "green" : "clay"}>{isPro ? "ИИ включён" : "Без ИИ"}</Tag>
      </Card>

      <Text style={styles.section}>АККАУНТ</Text>
      <Card style={{ padding: 14 }}>
        <Text style={styles.prodName}>{user?.display || "—"}</Text>
        <Text style={styles.prodMeta}>Вы вошли в этот аккаунт на данном устройстве.</Text>
        <View style={{ marginTop: 10, alignSelf: "flex-start" }}>
          <PrimaryButton title="Выйти из аккаунта" tone="soft" onPress={logout} />
        </View>
      </Card>

      <Text style={styles.section}>ДАННЫЕ</Text>
      <Card style={{ padding: 14 }}>
        <Text style={styles.dataText}>
          Все данные хранятся на этом устройстве. Перед работой с реальными
          клиентами прочитайте рекомендации по безопасности (SECURITY.md).
        </Text>
        <View style={{ marginTop: 10, alignSelf: "flex-start" }}>
          <PrimaryButton title="Стереть все данные" tone="soft" onPress={wipe} />
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  section: { fontSize: 12, fontWeight: "600", color: C.inkSoft, letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  product: { padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  prodName: { fontSize: 14, fontWeight: "600", color: C.ink },
  prodMeta: { fontSize: 12, color: C.inkSoft, marginTop: 2 },
  prodAbout: { fontSize: 12, color: C.inkSoft, marginTop: 6, lineHeight: 16 },
  del: { fontSize: 16, color: C.inkSoft, padding: 4 },
  form: { padding: 14, marginTop: 4 },
  input: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.ink, marginBottom: 8,
  },
  textarea: { minHeight: 64, textAlignVertical: "top" },
  voiceArea: { minHeight: 120, textAlignVertical: "top" },
  voiceHint: { fontSize: 12, color: C.inkSoft, lineHeight: 17, marginBottom: 10 },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  hint: { fontSize: 11, color: C.inkSoft, marginTop: 10, lineHeight: 15 },
  // Онлайн-запись
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  onlineT: { fontSize: 12, color: C.inkSoft },
  box: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: C.line,
    alignItems: "center", justifyContent: "center", backgroundColor: C.bg,
  },
  boxOn: { backgroundColor: C.primary, borderColor: C.primary },
  boxTick: { color: C.white, fontSize: 12, fontWeight: "700" },
  bkTitle: { fontSize: 14, fontWeight: "600", color: C.ink },
  bkLabel: { fontSize: 12, color: C.inkSoft, marginTop: 16, marginBottom: 6 },
  // Подпись поля + значок подсказки
  lblRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16, marginBottom: 6 },
  bkLabelInline: { fontSize: 12, color: C.inkSoft },
  qm: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 1, borderColor: C.inkFaint,
    alignItems: "center", justifyContent: "center",
  },
  qmOn: { backgroundColor: C.primary, borderColor: C.primary },
  // lineHeight = высоте кружка, иначе «!» встаёт выше центра.
  qmT: {
    fontSize: 11, lineHeight: 14, fontWeight: "700", color: C.inkFaint,
    textAlign: "center", includeFontPadding: false,
  },
  qmTOn: { color: C.white },
  tip: {
    backgroundColor: C.primarySoft, borderRadius: R.md,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 12, lineHeight: 16, color: C.primary, marginBottom: 8,
  },
  // Числовое поле с единицей измерения
  numWrap: { position: "relative", justifyContent: "center" },
  numInput: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: R.md,
    paddingLeft: 14, paddingRight: 54, paddingVertical: 12, fontSize: 15, color: C.ink,
  },
  numUnit: { position: "absolute", right: 14, fontSize: 13, color: C.inkSoft },
  linkBox: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: R.md,
    paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8,
  },
  linkT: { fontSize: 13, color: C.primary, fontWeight: "600" },
  unpack: { padding: 16, marginTop: 12, backgroundColor: C.primarySoft, borderColor: C.primarySoft },
  unpackTitle: { fontSize: 15, fontWeight: "600", color: C.primary },
  unpackText: { fontSize: 13, color: C.ink, lineHeight: 19, marginTop: 6 },
  unpackCta: { fontSize: 13, color: C.primary, fontWeight: "600", marginTop: 10 },
  subRow: { padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  dataText: { fontSize: 12, color: C.inkSoft, lineHeight: 17 },
});
