import React from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { C } from "../theme";
import { Card, H1, PrimaryButton } from "../components/ui";

export default function ContentScreen({ navigation }) {
  const askIdeas = () =>
    navigation.navigate("AIChat", {
      preset: "Предложи 3 идеи постов для психолога (Telegram или Instagram). Если у меня уже есть клиенты и заметки — опирайся на их темы, иначе предложи универсальные темы и спроси про мою специализацию.",
    });

  const askPlan = () =>
    navigation.navigate("AIChat", {
      preset: "Помоги составить контент-план на 2 недели для продвижения частной практики психолога: какие форматы, как часто публиковать и с чего начать.",
    });

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.headRow}>
        <H1>Контент</H1>
        <PrimaryButton title="Идеи от ИИ" tone="soft" onPress={askIdeas} />
      </View>

      <Card style={styles.empty}>
        <Text style={styles.emptyTitle}>Контент — двигатель практики</Text>
        <Text style={styles.emptyText}>
          Посты о темах, с которыми вы работаете, приводят новых клиентов.
          Ассистент поможет: предложит идеи из тем ваших сессий, напишет
          черновик и адаптирует под Telegram или Instagram.
        </Text>
      </Card>

      <Card style={styles.action} onPress={askIdeas}>
        <Text style={styles.actionTitle}>Идеи постов</Text>
        <Text style={styles.actionText}>3 темы на основе ваших сессий</Text>
        <Text style={styles.cta}>Спросить →</Text>
      </Card>

      <Card style={styles.action} onPress={askPlan}>
        <Text style={styles.actionTitle}>Контент-план на 2 недели</Text>
        <Text style={styles.actionText}>Форматы, частота, с чего начать</Text>
        <Text style={styles.cta}>Составить →</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  empty: { padding: 18, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: C.ink, marginBottom: 6 },
  emptyText: { fontSize: 13, color: C.inkSoft, lineHeight: 19 },
  action: { padding: 14, marginBottom: 8 },
  actionTitle: { fontSize: 14, fontWeight: "600", color: C.ink },
  actionText: { fontSize: 12, color: C.inkSoft, marginTop: 4 },
  cta: { fontSize: 11, color: C.primary, marginTop: 8 },
});
