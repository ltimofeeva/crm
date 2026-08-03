// «Сегодня»: дата, записи на сегодня (нажатие — карточка события с заметкой
// и статусом), напоминания от ИИ (кому пора написать) и вход в ассистента.

import React, { useState, useCallback, useRef } from "react";
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
import { birthdayStatus, yearsWord } from "../utils/birthday";

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

  // Напоминания обновляются раз в сутки: при первом открытии вкладки после
  // 3:00 утра. Фоновых задач у приложения нет, поэтому ровно в 3:00 само оно
  // проснуться не может — обновление срабатывает при первом входе после этого
  // времени, а до тех пор показывается вчерашний список.
  const refreshing = useRef(false);

  const lastThreeAM = () => {
    const cutoff = new Date();
    cutoff.setHours(3, 0, 0, 0);
    if (Date.now() < cutoff.getTime()) cutoff.setDate(cutoff.getDate() - 1);
    return cutoff.getTime();
  };

  const load = useCallback(async () => {
    const cls = await getClients();
    setClients(cls);
    setEvents(await getEvents());
    const saved = await getReminders();
    const savedItems = saved.items || [];
    setReminders(savedItems);

    // Автообновление: только с подпиской, без параллельных запросов.
    if (!isPro || refreshing.current || cls.length === 0) return;
    const stale = (saved.updatedAt || 0) < lastThreeAM();
    if (!stale && savedItems.length > 0) return;
    refreshing.current = true;
    // Пока идёт обновление, старые напоминания остаются на экране.
    setRemState(savedItems.length ? "silent" : "loading");
    try {
      const system = await buildFullContext();
      const items = await fetchReminders(system);
      setReminders(items);
      await saveReminders(items);
      setRemState("idle");
    } catch (e) {
      setRemState(savedItems.length ? "idle" : "error");
    } finally {
      refreshing.current = false;
    }
  }, [isPro]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const todayEvents = events.filter((e) => e.date === dateKey(new Date()));

  // Дни рождения клиентов: сегодня и в ближайшую неделю.
  const birthdays = clients
    .map((c) => ({ c, st: birthdayStatus(c.birthDate) }))
    .filter((x) => x.st && x.st.days <= 7)
    .sort((a, b) => a.st.days - b.st.days);

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
                  {[e.productName, e.price ? `${e.price} ₽` : null, e.note ? "есть заметка" : null].filter(Boolean).join(" · ") || "нажмите, чтобы добавить заметку"}
                </Text>
              </View>
              {e.status === "progress" ? <Tag>↑ Прогресс</Tag> : null}
              {e.status === "stable" ? <Tag>→ Стабильно</Tag> : null}
              {e.status === "regress" ? <Tag tone="clay">↓ Регресс</Tag> : null}
            </Card>
          ))}
        </>
      )}

      {birthdays.length > 0 && (
        <>
          <Text style={styles.section}>🎂 ДНИ РОЖДЕНИЯ</Text>
          {birthdays.map(({ c, st }) => (
            <Card key={c.id} style={styles.bday}>
              <Text
                style={styles.bdayName}
                onPress={() => navigation.navigate("ClientCard", { id: c.id })}
              >
                {c.name} →
              </Text>
              <Text style={styles.bdayText}>
                {st.days === 0
                  ? "Сегодня день рождения! 🎉"
                  : `День рождения ${st.dateLabel} (${st.days === 1 ? "завтра" : `через ${st.days} дн.`})`}
                {st.turns ? ` Исполняется ${st.turns} ${yearsWord(st.turns)}.` : ""}
              </Text>
              <View style={{ marginTop: 8, alignSelf: "flex-start" }}>
                <PrimaryButton
                  title="Составить поздравление"
                  tone="soft"
                  onPress={() => composeMessage({
                    client: c.name,
                    reason: st.days === 0
                      ? "у клиента сегодня день рождения"
                      : `у клиента день рождения ${st.dateLabel}`,
                    action: "тёплое личное поздравление с днём рождения, без продаж",
                  })}
                />
              </View>
            </Card>
          ))}
          {/* Отступ ~1,5 см до следующего раздела. */}
          <View style={{ height: 48 }} />
        </>
      )}

      {clients.length > 0 && (
        <>
          <View style={styles.remHead}>
            <Text style={styles.section}>НАПОМИНАНИЯ</Text>
            {remState === "silent" && <Text style={styles.remUpdating}>обновляю…</Text>}
          </View>

          {remState === "loading" && (
            <Card style={{ padding: 16, alignItems: "center" }}>
              <ActivityIndicator color={C.primary} />
              <Text style={styles.remEmpty}>Ассистент разбирает базу клиентов…</Text>
            </Card>
          )}
          {remState === "error" && (
            <Card style={{ padding: 14 }}><Text style={styles.err}>Не удалось получить напоминания. Проверьте интернет — попробую снова, когда вы вернётесь на эту вкладку.</Text></Card>
          )}
          {remState === "idle" && reminders.length === 0 && isPro && (
            <Card style={{ padding: 14 }}>
              <Text style={styles.remEmpty}>
                Ассистент сам разберёт клиентов на горячих, тёплых и холодных и
                подскажет, с кем пора связаться. Добавьте клиентов с заметками —
                и напоминания появятся здесь.
              </Text>
            </Card>
          )}
          {!isPro && reminders.length === 0 && (
            <Card style={{ padding: 14 }}>
              <Text style={styles.remEmpty}>
                Напоминания, с кем связаться и что предложить, составляет
                ИИ-ассистент входит в платные тарифы.
              </Text>
              <View style={{ marginTop: 10, alignSelf: "flex-start" }}>
                <PrimaryButton title="Посмотреть тарифы" tone="soft" onPress={() => navigation.navigate("Paywall")} />
              </View>
            </Card>
          )}
          {remState !== "loading" && reminders.map((r, i) => (
            <ReminderCard
              key={i}
              reminder={r}
              onOpenClient={() => {
                // Открываем карточку поверх текущего экрана: «назад» вернёт сюда.
                const c = clients.find((x) => x.name === r.client);
                if (c) navigation.navigate("ClientCard", { id: c.id });
                else navigation.navigate("Clients", { screen: "ClientsList", params: { openName: r.client } });
              }}
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
  wrap: { padding: 20, paddingBottom: 44 },
  section: { fontSize: 11, fontWeight: "700", color: C.inkFaint, letterSpacing: 1, marginBottom: 10, marginTop: 12 },
  row: { padding: 15, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
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
  remHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, marginBottom: 12 },
  remUpdating: { fontSize: 11, color: C.inkSoft, fontStyle: "italic" },
  remEmpty: { fontSize: 13, color: C.inkSoft, lineHeight: 19 },
  reminder: { padding: 14, marginBottom: 8 },
  remTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  remClient: { fontSize: 14, fontWeight: "600", color: C.ink },
  remClientLink: { color: C.primary, textDecorationLine: "underline" },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  remReason: { fontSize: 13, color: C.ink, lineHeight: 18 },
  remAction: { fontSize: 12, color: C.inkSoft, marginTop: 4, lineHeight: 17 },
  err: { fontSize: 12, color: C.danger, lineHeight: 17 },
  bday: { padding: 14, marginBottom: 8, backgroundColor: C.accentSoft, borderColor: C.accentSoft },
  bdayName: { fontSize: 14, fontWeight: "600", color: C.primary, textDecorationLine: "underline" },
  bdayText: { fontSize: 13, color: C.ink, lineHeight: 18, marginTop: 4 },
  hint: { padding: 14, marginTop: 12 },
  hintText: { fontSize: 13, color: C.ink, lineHeight: 18 },
  hintCta: { fontSize: 11, color: C.primary, marginTop: 4 },
});
