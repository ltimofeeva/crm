import React, { useState, useCallback } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, SERIF } from "../theme";
import { Card, H1, PrimaryButton } from "../components/ui";
import { getClients } from "../storage/store";

export default function AnalyticsScreen({ navigation }) {
  const [clients, setClients] = useState([]);

  useFocusEffect(useCallback(() => {
    (async () => setClients(await getClients()))();
  }, []));

  const active = clients.filter((c) => c.status !== "Пауза").length;
  const totalSessions = clients.reduce((s, c) => s + (c.sessionsCount || 0), 0);

  const askAnalysis = () =>
    navigation.navigate("AIChat", {
      preset: "Помоги разобрать мою практику: я назову цифры (доход за месяц, число сессий, средний чек, откуда приходят клиенты), а ты составь пошаговый план роста с реалистичными сценариями и честными рисками. Начни с вопросов, какие цифры тебе нужны.",
    });

  const stats = [
    { l: "Клиентов", v: String(clients.length) },
    { l: "Активных", v: String(active) },
    { l: "Сессий записано", v: String(totalSessions) },
  ];

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.headRow}>
        <H1>Аналитика</H1>
        <PrimaryButton title="Разбор ИИ" onPress={askAnalysis} />
      </View>

      <View style={styles.statsRow}>
        {stats.map((s) => (
          <Card key={s.l} style={styles.stat}>
            <Text style={[styles.statV, SERIF]}>{s.v}</Text>
            <Text style={styles.statL}>{s.l}</Text>
          </Card>
        ))}
      </View>

      <Card style={styles.empty}>
        <Text style={styles.emptyTitle}>Графики появятся с данными</Text>
        <Text style={styles.emptyText}>
          Добавляйте клиентов и записывайте заметки после сессий — здесь
          соберётся картина практики: динамика загрузки, доход и путь клиента
          от первого обращения до постоянной работы.
        </Text>
        <Text style={styles.emptyText2}>
          А бизнес-разбор можно сделать уже сейчас: нажмите «Разбор ИИ» и
          назовите ассистенту свои цифры — он посчитает план роста.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statsRow: { flexDirection: "row", gap: 8, marginVertical: 12 },
  stat: { flex: 1, padding: 12, alignItems: "center" },
  statV: { fontSize: 18, color: C.ink },
  statL: { fontSize: 11, color: C.inkSoft, marginTop: 2, textAlign: "center" },
  empty: { padding: 18 },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: C.ink, marginBottom: 6 },
  emptyText: { fontSize: 13, color: C.inkSoft, lineHeight: 19 },
  emptyText2: { fontSize: 13, color: C.ink, lineHeight: 19, marginTop: 10 },
});
