// «Сегодня»: дата, записи на сегодня (нажатие — карточка события с заметкой
// и статусом), напоминания от ИИ (кому пора написать) и вход в ассистента.

import React, { useState, useCallback } from "react";
import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, SERIF } from "../theme";
import { Card, Tag, H1, PrimaryButton, BrainButton } from "../components/ui";
import ReminderCard from "../components/ReminderCard";
import {
  getClients, getEvents, getReminders, saveReminders,
  addClientTouch, markReminderDone,
} from "../storage/store";
import { buildFullContext, fetchReminders, messagePreset } from "../api/ai";
import { useSubscription } from "../context/SubscriptionContext";

function todayTitle() {
  const s = new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function dateKey(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function DashboardScreen({ navigation }) {
  const { isPro } = useSubscription();
  const [clients, setClients] = useState([]);
  const [events, setEvents] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [remState, setRemState] = useState("idle"); // idle | loading | error

  const load = useCallback(async () => {
    setClients(await getClients());
    setEvents(await getEvents());
    const saved = await getReminders();
    setReminders(saved.items || []);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const todayEvents = events.filter((e) => e.date === dateKey(new Date()));

  const refreshReminders = async () => {
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

  const composeMessage = (r) => {
    navigation.navigate("AIChat", { preset: messagePreset(r) });
  };

  // Галочка «связалась»: итог уходит в журнал клиента, карточка гаснет.
  const logTouch = async (r, index, type, note) => {
    await addClientTouch(r.client, { type, note, reason: r.reason });
    const items = await markReminderDone(index, { type, note });
    setReminders(items);
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <H1 sub={todayEvents.length ? `Записей на сегодня: ${todayEvents.length}` : "Записей на сегодня нет"}>
            {todayTitle()}
          </H1>
        </View>
        <BrainButton onPress={() => navigation.navigate("AIChat")} />
      </View>

      {clients.length === 0 && (
        <Card style={styles.welcome} onPress={() => navigation.navigate("Clients")}>
          <Text style={styles.welcomeTitle}>Добро пожаловать 👋</Text>
          <Text style={styles.welcomeText}>
            Начните с трёх шагов: добавьте клиента во вкладке «Клиенты»,
            заполните продукты и «О себе» в настройках (⚙) и запишите клиента
            в «Календаре». Тогда здесь появятся записи дня и напоминания.
          </Text>
          <Text style={styles.welcomeCta}>Добавить клиента →</Text>
        </Card>
      )}

      {todayEvents.length > 0 && (
        <>
          <Text style={styles.section}>СЕГОДНЯ</Text>
          {todayEvents.map((e) => (
            <Card key={e.id} style={styles.row} onPress={() => navigation.navigate("EventDetail", { id: e.id })}>
              <View style={styles.time}>
                <Text style={styles.timeT}>{e.time}</Text>
                <Text style={styles.dur}>{e.durationMin} мин</Text>
              </View>
              <View style={styles.sep} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{e.title}</Text>
                <Text style={styles.meta}>
                  {[e.productName, e.note ? "есть заметка" : null].filter(Boolean).join(" · ") || "нажмите, чтобы добавить заметку"}
                </Text>
              </View>
              {e.status === "progress" ? <Tag>↑ Прогресс</Tag> : null}
              {e.status === "stable" ? <Tag>→ Стабильно</Tag> : null}
              {e.status === "regress" ? <Tag tone="clay">↓ Регресс</Tag> : null}
            </Card>
          ))}
        </>
      )}

      {clients.length > 0 && (
        <>
          <View style={styles.remHead}>
            <Text style={styles.section}>НАПОМИНАНИЯ</Text>
            <PrimaryButton
              title={remState === "loading" ? "Анализирую…" : "Обновить"}
              tone="soft"
              onPress={remState === "loading" ? undefined : refreshReminders}
            />
          </View>

          {remState === "loading" && (
            <Card style={{ padding: 16, alignItems: "center" }}><ActivityIndicator color={C.primary} /></Card>
          )}
          {remState === "error" && (
            <Card style={{ padding: 14 }}><Text style={styles.err}>Не удалось получить напоминания. Проверьте интернет и попробуйте ещё раз.</Text></Card>
          )}
          {remState !== "loading" && reminders.length === 0 && (
            <Card style={{ padding: 14 }}>
              <Text style={styles.remEmpty}>
                Нажмите «Обновить» — ассистент разберёт клиентов на горячих,
                тёплых и холодных и подскажет, с кем пора связаться и что предложить.
              </Text>
            </Card>
          )}
          {remState !== "loading" && reminders.map((r, i) => (
            <ReminderCard
              key={i}
              reminder={r}
              onOpenClient={() => navigation.navigate("Clients", { screen: "ClientsList", params: { openName: r.client } })}
              onCompose={() => composeMessage(r)}
              onLogged={(type, note) => logTouch(r, i, type, note)}
            />
          ))}
        </>
      )}

      {clients.length > 0 && (
        <Card style={styles.hint} onPress={() => navigation.navigate("AIChat")}>
          <Text style={styles.hintText}>
            Ассистент видит ваших клиентов, заметки, продукты и календарь:
            попросите подготовить к сессии, разобрать динамику или придумать пост.
          </Text>
          <Text style={styles.hintCta}>Открыть ассистента →</Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  section: { fontSize: 12, fontWeight: "600", color: C.inkSoft, letterSpacing: 0.5, marginBottom: 8, marginTop: 8 },
  row: { padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  time: { width: 52, alignItems: "center" },
  timeT: { fontSize: 15, fontWeight: "600", color: C.ink },
  dur: { fontSize: 10, color: C.inkSoft },
  sep: { width: 1, alignSelf: "stretch", backgroundColor: C.line },
  name: { fontSize: 14, fontWeight: "600", color: C.ink },
  meta: { fontSize: 11, color: C.inkSoft, marginTop: 2 },
  welcome: { padding: 18, marginBottom: 8 },
  welcomeTitle: { fontSize: 16, fontWeight: "600", color: C.ink, marginBottom: 8 },
  welcomeText: { fontSize: 13, color: C.inkSoft, lineHeight: 19 },
  welcomeCta: { fontSize: 13, color: C.primary, marginTop: 10, fontWeight: "600" },
  remHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  remEmpty: { fontSize: 13, color: C.inkSoft, lineHeight: 19 },
  reminder: { padding: 14, marginBottom: 8 },
  remTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  remClient: { fontSize: 14, fontWeight: "600", color: C.ink },
  remClientLink: { color: C.primary, textDecorationLine: "underline" },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  remReason: { fontSize: 13, color: C.ink, lineHeight: 18 },
  remAction: { fontSize: 12, color: C.inkSoft, marginTop: 4, lineHeight: 17 },
  err: { fontSize: 12, color: C.accent, lineHeight: 17 },
  hint: { padding: 14, marginTop: 12 },
  hintText: { fontSize: 13, color: C.ink, lineHeight: 18 },
  hintCta: { fontSize: 11, color: C.primary, marginTop: 4 },
});
