// Настройки деятельности (⚙): продукты специалиста, «О себе»,
// агент-распаковка, подписка и очистка данных.

import React, { useState, useCallback } from "react";
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

              <Text style={styles.bkLabel}>Шаг окошек</Text>
              <View style={styles.chipsRow}>
                {[30, 60].map((v) => (
                  <Pressable key={v} onPress={() => setBk("stepMin", v)} style={[styles.chip, booking.stepMin === v && styles.chipOn]}>
                    <Text style={[styles.chipT, booking.stepMin === v && styles.chipTOn]}>{v} мин</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.bkLabel}>Перерыв между встречами</Text>
              <View style={styles.chipsRow}>
                {[0, 10, 15, 30].map((v) => (
                  <Pressable key={v} onPress={() => setBk("bufferMin", v)} style={[styles.chip, booking.bufferMin === v && styles.chipOn]}>
                    <Text style={[styles.chipT, booking.bufferMin === v && styles.chipTOn]}>
                      {v ? `${v} мин` : "без"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.bkLabel}>Записаться можно не позже чем за</Text>
              <View style={styles.chipsRow}>
                {[1, 3, 12, 24].map((v) => (
                  <Pressable key={v} onPress={() => setBk("minLeadHours", v)} style={[styles.chip, booking.minLeadHours === v && styles.chipOn]}>
                    <Text style={[styles.chipT, booking.minLeadHours === v && styles.chipTOn]}>{v} ч</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.bkLabel}>Открыть календарь вперёд на</Text>
              <View style={styles.chipsRow}>
                {[7, 14, 30, 60].map((v) => (
                  <Pressable key={v} onPress={() => setBk("maxDaysAhead", v)} style={[styles.chip, booking.maxDaysAhead === v && styles.chipOn]}>
                    <Text style={[styles.chipT, booking.maxDaysAhead === v && styles.chipTOn]}>{v} дн.</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.bkLabel}>Подсказка клиенту (необязательно)</Text>
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
  linkBox: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: R.md,
    paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8,
  },
  linkT: { fontSize: 13, color: C.primary, fontWeight: "600" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.pill,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.line,
  },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipT: { fontSize: 12, color: C.ink },
  chipTOn: { color: C.white },
  unpack: { padding: 16, marginTop: 12, backgroundColor: C.primarySoft, borderColor: C.primarySoft },
  unpackTitle: { fontSize: 15, fontWeight: "600", color: C.primary },
  unpackText: { fontSize: 13, color: C.ink, lineHeight: 19, marginTop: 6 },
  unpackCta: { fontSize: 13, color: C.primary, fontWeight: "600", marginTop: 10 },
  subRow: { padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  dataText: { fontSize: 12, color: C.inkSoft, lineHeight: 17 },
});
