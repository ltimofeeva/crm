import React from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { C, SERIF } from "../theme";
import { Card, H1, PrimaryButton } from "../components/ui";

export default function FinanceScreen({ navigation }) {
  const stats = [
    { l: "Этот месяц", v: "0 ₽" },
    { l: "Ожидает оплаты", v: "0 ₽" },
    { l: "Средний чек", v: "—" },
  ];

  const askBiz = () =>
    navigation.navigate("AIChat", {
      preset: "Помоги с финансами практики: я назову свой доход, число сессий и цену, а ты подскажи, как считать ключевые показатели и составь план роста дохода с реалистичными сценариями. Начни с вопросов, какие цифры тебе нужны.",
    });

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

      <Card style={styles.empty}>
        <Text style={styles.emptyTitle}>Оплаты пока не ведутся</Text>
        <Text style={styles.emptyText}>
          Здесь появится учёт оплат по сессиям: кто оплатил, кто ожидает,
          доход за месяц и средний чек. Эта функция в разработке.
        </Text>
        <Text style={styles.emptyText2}>
          Уже сейчас можно посоветоваться с ассистентом о ценообразовании и
          плане дохода — нажмите «Анализ бизнеса».
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
