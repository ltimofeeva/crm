import React from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { C, SERIF } from "../theme";
import { Card, Tag, H1, PrimaryButton } from "../components/ui";
import { FINANCE_ROWS } from "../data/seed";

export default function FinanceScreen({ navigation }) {
  const stats = [
    { l: "Июнь", v: "120к ₽" },
    { l: "Ожидает", v: "4 000 ₽" },
    { l: "Ср. чек", v: "4 300 ₽" },
  ];
  const askBiz = () =>
    navigation.navigate("AIChat", { preset: "Проанализируй мою деятельность за прошлый месяц (доход, загрузку, средний чек, воронку) и составь пошаговый план выйти на доход x2 в следующем месяце. Опирайся на реальные цифры, дай реалистичные варианты и честно отметь риски." });

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.headRow}>
        <H1>Финансы</H1>
        <PrimaryButton title="Анализ бизнеса" tone="soft" onPress={askBiz} />
      </View>
      <View style={styles.statsRow}>
        {stats.map((s) => (
          <Card key={s.l} style={styles.stat}>
            <Text style={[styles.statV, SERIF]}>{s.v}</Text>
            <Text style={styles.statL}>{s.l}</Text>
          </Card>
        ))}
      </View>
      {FINANCE_ROWS.map((r, i) => (
        <Card key={i} style={styles.row}>
          <Text style={styles.date}>{r.date}</Text>
          <Text style={styles.client} numberOfLines={1}>{r.client}</Text>
          <Text style={styles.sum}>{r.sum}</Text>
          <Tag tone={r.paid ? "green" : "clay"}>{r.paid ? "Оплачено" : "Ожидает"}</Tag>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statsRow: { flexDirection: "row", gap: 8, marginVertical: 12 },
  stat: { flex: 1, padding: 12, alignItems: "center" },
  statV: { fontSize: 18, color: C.ink },
  statL: { fontSize: 11, color: C.inkSoft, marginTop: 2 },
  row: { padding: 14, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  date: { fontSize: 12, color: C.inkSoft, width: 48 },
  client: { fontSize: 14, color: C.ink, flex: 1 },
  sum: { fontSize: 14, fontWeight: "600", color: C.ink },
});
