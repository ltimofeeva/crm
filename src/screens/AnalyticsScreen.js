// «Аналитика и финансы»: отчёты Финансы и Загруженность, каждый с кнопкой
// обсуждения с ИИ. Цифры считаются из событий календаря и продуктов.

import React, { useState, useCallback } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, SERIF } from "../theme";
import { Card, H1, PrimaryButton } from "../components/ui";
import { getClients, getEvents, getProducts, getSchedule } from "../storage/store";

const SEGS = [
  { key: "finance", title: "Финансы" },
  { key: "load", title: "Загруженность" },
];

function dateKey(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function AnalyticsScreen({ navigation }) {
  const [seg, setSeg] = useState("finance");
  const [clients, setClients] = useState([]);
  const [events, setEvents] = useState([]);
  const [products, setProducts] = useState([]);
  const [schedule, setSchedule] = useState(null);

  const load = useCallback(async () => {
    setClients(await getClients());
    setEvents(await getEvents());
    setProducts(await getProducts());
    setSchedule(await getSchedule());
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

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

  const stats = seg === "finance" ? financeStats : loadStats;

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.headRow}>
        <H1>Аналитика и финансы</H1>
      </View>

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

      <Card style={styles.hint} onPress={() => navigation.navigate("AIChat")}>
        <Text style={styles.hintText}>
          Ассистент также сегментирует клиентов (горячие/тёплые/холодные) и
          подсказывает, с кем связаться — смотрите «Напоминания» на вкладке «Сегодня».
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
});
