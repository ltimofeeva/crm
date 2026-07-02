import React from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { C, SERIF } from "../theme";
import { Card, Tag, H1 } from "../components/ui";
import { TODAY } from "../data/seed";

export default function DashboardScreen({ navigation }) {
  const stats = [
    { l: "Сессий / нед", v: "12" },
    { l: "Клиентов", v: "11" },
    { l: "Июнь", v: "120к ₽" },
  ];
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <H1 sub="4 встречи · 1 первичная · окно 12:00–14:00">Среда, 10 июня</H1>

      <View style={styles.statsRow}>
        {stats.map((s) => (
          <Card key={s.l} style={styles.stat}>
            <Text style={[styles.statV, SERIF]}>{s.v}</Text>
            <Text style={styles.statL}>{s.l}</Text>
          </Card>
        ))}
      </View>

      <Text style={styles.section}>СЕГОДНЯ</Text>
      {TODAY.map((a) => (
        <Card
          key={a.time}
          style={styles.row}
          onPress={!a.own && !a.isNew ? () => navigation.navigate("Clients", { openName: a.client }) : undefined}
        >
          <View style={styles.time}>
            <Text style={styles.timeT}>{a.time}</Text>
            <Text style={styles.dur}>{a.dur}</Text>
          </View>
          <View style={styles.sep} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{a.client}</Text>
            <Text style={styles.meta}>
              {a.type === "video" ? "Видео" : "Кабинет"}{a.session ? ` · №${a.session}` : ""}
            </Text>
          </View>
          {a.isNew ? <Tag tone="clay">Первичная</Tag> : null}
          {a.own ? <Tag>Своё</Tag> : null}
        </Card>
      ))}

      <Card
        style={styles.hint}
        onPress={() => navigation.navigate("AIChat", { preset: "Подготовь меня к сессии с Анной в 14:00" })}
      >
        <Text style={styles.hintText}>
          Через 2 часа сессия с Анной Морозовой — попросить ассистента подготовить сводку?
        </Text>
        <Text style={styles.hintCta}>Подготовить →</Text>
      </Card>
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
  time: { width: 48, alignItems: "center" },
  timeT: { fontSize: 15, fontWeight: "600", color: C.ink },
  dur: { fontSize: 10, color: C.inkSoft },
  sep: { width: 1, alignSelf: "stretch", backgroundColor: C.line },
  name: { fontSize: 14, fontWeight: "600", color: C.ink },
  meta: { fontSize: 11, color: C.inkSoft, marginTop: 2 },
  hint: { padding: 14, marginTop: 12 },
  hintText: { fontSize: 13, color: C.ink, lineHeight: 18 },
  hintCta: { fontSize: 11, color: C.primary, marginTop: 4 },
});
