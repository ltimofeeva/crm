import React, { useState, useCallback } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, SERIF } from "../theme";
import { Card, Tag, H1 } from "../components/ui";
import { getClients } from "../storage/store";

function todayTitle() {
  const s = new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function DashboardScreen({ navigation }) {
  const [clients, setClients] = useState([]);

  useFocusEffect(useCallback(() => {
    (async () => setClients(await getClients()))();
  }, []));

  const active = clients.filter((c) => c.status !== "Пауза");
  const totalSessions = clients.reduce((s, c) => s + (c.sessionsCount || 0), 0);
  const planned = clients.filter((c) => c.nextSession && c.nextSession !== "—");

  const stats = [
    { l: "Клиентов", v: String(clients.length) },
    { l: "Активных", v: String(active.length) },
    { l: "Сессий всего", v: String(totalSessions) },
  ];

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <H1 sub={clients.length ? `${active.length} активных клиентов` : "Начнём вести практику"}>
        {todayTitle()}
      </H1>

      <View style={styles.statsRow}>
        {stats.map((s) => (
          <Card key={s.l} style={styles.stat}>
            <Text style={[styles.statV, SERIF]}>{s.v}</Text>
            <Text style={styles.statL}>{s.l}</Text>
          </Card>
        ))}
      </View>

      {clients.length === 0 && (
        <Card style={styles.welcome} onPress={() => navigation.navigate("Clients")}>
          <Text style={styles.welcomeTitle}>Добро пожаловать 👋</Text>
          <Text style={styles.welcomeText}>
            Добавьте первого клиента во вкладке «Клиенты», после сессий
            записывайте заметки — и здесь появится ваша практика: ближайшие
            встречи, динамика и подсказки ассистента.
          </Text>
          <Text style={styles.welcomeCta}>Добавить клиента →</Text>
        </Card>
      )}

      {planned.length > 0 && (
        <>
          <Text style={styles.section}>БЛИЖАЙШИЕ СЕССИИ</Text>
          {planned.map((c) => (
            <Card key={c.id} style={styles.row} onPress={() => navigation.navigate("Clients", { openName: c.name })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
                <Text style={styles.meta}>{c.format || "Онлайн"} · сессия №{(c.sessionsCount || 0) + 1}</Text>
              </View>
              <Tag>{c.nextSession}</Tag>
            </Card>
          ))}
        </>
      )}

      {clients.length > 0 && (
        <Card style={styles.hint} onPress={() => navigation.navigate("AIChat")}>
          <Text style={styles.hintText}>
            Ассистент видит ваших клиентов и заметки: попросите подготовить к
            сессии, разобрать динамику или придумать пост.
          </Text>
          <Text style={styles.hintCta}>Открыть ассистента →</Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  stat: { flex: 1, padding: 12, alignItems: "center" },
  statV: { fontSize: 18, color: C.ink },
  statL: { fontSize: 11, color: C.inkSoft, marginTop: 2 },
  section: { fontSize: 12, fontWeight: "600", color: C.inkSoft, letterSpacing: 0.5, marginBottom: 8 },
  row: { padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  name: { fontSize: 14, fontWeight: "600", color: C.ink },
  meta: { fontSize: 11, color: C.inkSoft, marginTop: 2 },
  welcome: { padding: 18 },
  welcomeTitle: { fontSize: 16, fontWeight: "600", color: C.ink, marginBottom: 8 },
  welcomeText: { fontSize: 13, color: C.inkSoft, lineHeight: 19 },
  welcomeCta: { fontSize: 13, color: C.primary, marginTop: 10, fontWeight: "600" },
  hint: { padding: 14, marginTop: 12 },
  hintText: { fontSize: 13, color: C.ink, lineHeight: 18 },
  hintCta: { fontSize: 11, color: C.primary, marginTop: 4 },
});
