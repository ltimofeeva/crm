// «Аналитика и финансы»: отчёты Финансы и Загруженность, каждый с кнопкой
// обсуждения с ИИ. Цифры считаются из событий календаря и продуктов.

import React, { useState, useCallback } from "react";
import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, SERIF } from "../theme";
import { Card, Tag, H1, PrimaryButton, ChatReturnLink } from "../components/ui";
import {
  getClients, getEvents, getProducts, getSchedule, getReminders, saveReminders,
} from "../storage/store";
import { buildFullContext, fetchReminders, messagePreset } from "../api/ai";
import { useSubscription } from "../context/SubscriptionContext";

const SEGS = [
  { key: "finance", title: "Финансы" },
  { key: "load", title: "Загруженность" },
  { key: "sales", title: "Продажи" },
];

const SEGMENT_TONE = { холодный: "clay", тёплый: "clay", горячий: "green" };

function dateKey(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function AnalyticsScreen({ navigation }) {
  const { isPro } = useSubscription();
  const [seg, setSeg] = useState("finance");
  const [clients, setClients] = useState([]);
  const [events, setEvents] = useState([]);
  const [products, setProducts] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [remState, setRemState] = useState("idle");

  const load = useCallback(async () => {
    setClients(await getClients());
    setEvents(await getEvents());
    setProducts(await getProducts());
    setSchedule(await getSchedule());
    setReminders((await getReminders()).items || []);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Анализ продаж: тот же движок, что и напоминания на «Сегодня».
  const refreshSales = async () => {
    if (!isPro) { navigation.navigate("Paywall"); return; }
    setRemState("loading");
    try {
      const system = await buildFullContext();
      const items = await fetchReminders(system);
      setReminders(items);
      await saveReminders(items);
      setRemState("idle");
    } catch (e) {
      setRemState("error");
    }
  };

  const now = new Date();
  const monthPrefix = dateKey(now).slice(0, 7); // ГГГГ-ММ
  const todayK = dateKey(now);
  const priceOf = (e) => products.find((p) => p.id === e.productId)?.price || 0;

  // Финансы: прошедшие события этого месяца с продуктами.
  const doneThisMonth = events.filter((e) => e.date.startsWith(monthPrefix) && e.date <= todayK && e.type === "session");
  const revenue = doneThisMonth.reduce((s, e) => s + priceOf(e), 0);
  const paidCount = doneThisMonth.filter((e) => priceOf(e) > 0).length;
  const avg = paidCount ? Math.round(revenue / paidCount) : 0;

  // Загруженность: события за последние 7 и ближайшие 7 дней.
  const weekAgo = dateKey(new Date(Date.now() - 7 * 864e5));
  const weekAhead = dateKey(new Date(Date.now() + 7 * 864e5));
  const lastWeek = events.filter((e) => e.date >= weekAgo && e.date <= todayK);
  const nextWeek = events.filter((e) => e.date > todayK && e.date <= weekAhead);
  const busyMin = lastWeek.reduce((s, e) => s + (e.durationMin || 0), 0);
  const workDays = schedule ? Object.values(schedule.days).filter(Boolean).length : 5;

  const askFinance = () =>
    navigation.navigate("AIChat", {
      preset: "Разбери финансы моей практики по данным календаря и продуктов: доход этого месяца, средний чек, какие продукты приносят больше. Затем предложи план роста дохода с реалистичными сценариями и рисками. Если данных мало — задай уточняющие вопросы.",
    });

  const askLoad = () =>
    navigation.navigate("AIChat", {
      preset: "Проанализируй мою загруженность по календарю и рабочему графику: сколько сессий в неделю, где пустые окна, есть ли риск перегруза. Предложи, как выстроить расписание эффективнее.",
    });

  const rub = (n) => `${n.toLocaleString("ru-RU")} ₽`;

  const financeStats = [
    { l: "Доход за месяц", v: revenue ? rub(revenue) : "0 ₽" },
    { l: "Сессий в этом месяце", v: String(doneThisMonth.length) },
    { l: "Средний чек", v: avg ? rub(avg) : "—" },
  ];
  const loadStats = [
    { l: "Сессий за 7 дней", v: String(lastWeek.length) },
    { l: "Часов за 7 дней", v: (busyMin / 60).toFixed(1) },
    { l: "Записей вперёд", v: String(nextWeek.length) },
  ];

  const countSeg = (name) => reminders.filter((r) => r.segment === name).length;
  const salesStats = [
    { l: "Горячие", v: String(countSeg("горячий")) },
    { l: "Тёплые", v: String(countSeg("тёплый")) },
    { l: "Холодные", v: String(countSeg("холодный")) },
  ];

  const stats = seg === "finance" ? financeStats : seg === "load" ? loadStats : salesStats;

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.headRow}>
        <H1>Аналитика и финансы</H1>
      </View>

      <ChatReturnLink onPress={() => navigation.navigate("AIChat")} />

      <View style={styles.segbar}>
        {SEGS.map((s) => (
          <Text key={s.key} onPress={() => setSeg(s.key)} style={[styles.seg, seg === s.key && styles.segActive]}>
            {s.title}
          </Text>
        ))}
      </View>

      <View style={styles.statsRow}>
        {stats.map((s) => (
          <Card key={s.l} style={styles.stat}>
            <Text style={[styles.statV, SERIF]}>{s.v}</Text>
            <Text style={styles.statL}>{s.l}</Text>
          </Card>
        ))}
      </View>

      {seg === "finance" && (
        <>
          <Card style={styles.info}>
            <Text style={styles.infoTitle}>Как считается</Text>
            <Text style={styles.infoText}>
              Доход складывается из прошедших сессий этого месяца по ценам ваших
              продуктов. Чтобы цифры были точными: заполните продукты в настройках
              (⚙) и выбирайте продукт при записи клиента в календаре.
            </Text>
            {products.length === 0 && (
              <Text style={styles.infoWarn}>Сейчас продукты не заполнены — доход считать не из чего.</Text>
            )}
          </Card>
          <PrimaryButton title="Обсудить финансы с ИИ" onPress={askFinance} />
        </>
      )}

      {seg === "load" && (
        <>
          <Card style={styles.info}>
            <Text style={styles.infoTitle}>Как считается</Text>
            <Text style={styles.infoText}>
              Загруженность строится по событиям календаря и вашему графику
              ({workDays} раб. дней в неделю{schedule ? `, ${schedule.start}–${schedule.end}` : ""}).
              Записывайте все встречи в календарь — и картина будет честной.
            </Text>
          </Card>
          <PrimaryButton title="Обсудить загруженность с ИИ" onPress={askLoad} />
        </>
      )}

      {seg === "sales" && (
        <>
          <Card style={styles.info}>
            <Text style={styles.infoTitle}>Аналитика продаж</Text>
            <Text style={styles.infoText}>
              Ассистент анализирует ваши продукты, записи клиентов и давность
              визитов, делит клиентов на горячих, тёплых и холодных и предлагает
              тактику: с кем связаться и какой продукт предложить.
            </Text>
          </Card>

          <PrimaryButton
            title={remState === "loading" ? "Анализирую…" : "Проанализировать продажи"}
            onPress={remState === "loading" ? undefined : refreshSales}
          />

          {remState === "loading" && (
            <Card style={{ padding: 16, alignItems: "center", marginTop: 12 }}>
              <ActivityIndicator color={C.primary} />
            </Card>
          )}
          {remState === "error" && (
            <Card style={{ padding: 14, marginTop: 12 }}>
              <Text style={{ fontSize: 12, color: C.accent }}>Не удалось выполнить анализ. Попробуйте ещё раз.</Text>
            </Card>
          )}
          {remState !== "loading" && reminders.length === 0 && (
            <Card style={{ padding: 14, marginTop: 12 }}>
              <Text style={styles.infoText}>
                Пока нет результатов. Добавьте клиентов с заметками и продукты (⚙),
                затем нажмите «Проанализировать продажи».
              </Text>
            </Card>
          )}
          {remState !== "loading" && reminders.map((r, i) => (
            <Card key={i} style={styles.saleCard}>
              <View style={styles.saleTop}>
                <Text style={styles.saleClient}>{r.client}</Text>
                <Tag tone={SEGMENT_TONE[r.segment] || "green"}>{r.segment}</Tag>
              </View>
              <Text style={styles.saleReason}>{r.reason}</Text>
              <Text style={styles.saleAction}>{r.action}</Text>
              <View style={{ marginTop: 10, alignSelf: "flex-start" }}>
                <PrimaryButton
                  title="Составить сообщение"
                  onPress={() => navigation.navigate("AIChat", { preset: messagePreset(r) })}
                />
              </View>
            </Card>
          ))}
        </>
      )}

      <Card style={styles.hint}>
        <Text style={styles.hintText}>
          Результаты анализа продаж также появляются как напоминания на вкладке «Сегодня».
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  segbar: { flexDirection: "row", backgroundColor: "#E9EDE9", borderRadius: 12, padding: 4, gap: 4, marginVertical: 12 },
  seg: { flex: 1, textAlign: "center", paddingVertical: 8, borderRadius: 8, fontSize: 13, color: C.inkSoft, overflow: "hidden" },
  segActive: { backgroundColor: C.white, color: C.ink, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  stat: { flex: 1, padding: 12, alignItems: "center" },
  statV: { fontSize: 17, color: C.ink },
  statL: { fontSize: 10, color: C.inkSoft, marginTop: 2, textAlign: "center" },
  info: { padding: 14, marginBottom: 12 },
  infoTitle: { fontSize: 13, fontWeight: "600", color: C.ink, marginBottom: 4 },
  infoText: { fontSize: 12, color: C.inkSoft, lineHeight: 17 },
  infoWarn: { fontSize: 12, color: C.accent, marginTop: 6 },
  hint: { padding: 14, marginTop: 12 },
  hintText: { fontSize: 12, color: C.inkSoft, lineHeight: 17 },
  saleCard: { padding: 14, marginTop: 8 },
  saleTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  saleClient: { fontSize: 14, fontWeight: "600", color: C.ink },
  saleReason: { fontSize: 13, color: C.ink, lineHeight: 18 },
  saleAction: { fontSize: 12, color: C.inkSoft, marginTop: 4, lineHeight: 17 },
});
