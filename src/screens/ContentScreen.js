import React, { useState } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { C } from "../theme";
import { Card, Tag, H1, PrimaryButton } from "../components/ui";
import { CONTENT } from "../data/seed";

const SEGS = [
  { key: "ideas", title: "Идеи" },
  { key: "drafts", title: "Черновики" },
  { key: "published", title: "Готово" },
];

export default function ContentScreen({ navigation }) {
  const [seg, setSeg] = useState("ideas");
  const items = CONTENT[seg];

  const askIdeas = () =>
    navigation.navigate("AIChat", { preset: "Предложи 3 новые идеи постов на основе тем из последних сессий и того, что уже сработало в опубликованном" });

  const draft = (it) =>
    navigation.navigate("AIChat", { preset: `Помоги с постом «${it.title}»${it.channel ? ` для канала ${it.channel}` : ""}: напиши черновик текста` });

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.headRow}>
        <H1>Контент</H1>
        <PrimaryButton title="Идеи от ИИ" tone="soft" onPress={askIdeas} />
      </View>

      <View style={styles.segbar}>
        {SEGS.map((s) => (
          <Text
            key={s.key}
            onPress={() => setSeg(s.key)}
            style={[styles.seg, seg === s.key && styles.segActive]}
          >
            {s.title} <Text style={styles.segCount}>{CONTENT[s.key].length}</Text>
          </Text>
        ))}
      </View>

      {items.map((it) => (
        <Card key={it.id} style={styles.item} onPress={seg !== "published" ? () => draft(it) : undefined}>
          <Text style={styles.itemTitle}>{it.title}</Text>
          {it.src ? <Text style={styles.itemSub}>💭 {it.src}</Text> : null}
          {it.channel ? <Text style={styles.itemSub}>{it.channel}</Text> : null}
          {it.progress ? <View style={{ marginTop: 8 }}><Tag tone="clay">{it.progress}</Tag></View> : null}
          {it.stats ? <Text style={styles.itemStat}>{it.date} · {it.stats}</Text> : null}
          {seg !== "published" ? <Text style={styles.tap}>Нажмите — ИИ напишет черновик →</Text> : null}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  segbar: { flexDirection: "row", backgroundColor: "#E9EDE9", borderRadius: 12, padding: 4, gap: 4, marginBottom: 16, marginTop: 8 },
  seg: { flex: 1, textAlign: "center", paddingVertical: 8, borderRadius: 8, fontSize: 13, color: C.inkSoft, overflow: "hidden" },
  segActive: { backgroundColor: C.white, color: C.ink, fontWeight: "600" },
  segCount: { fontSize: 11, color: C.inkSoft },
  item: { padding: 14, marginBottom: 8 },
  itemTitle: { fontSize: 14, fontWeight: "600", color: C.ink, lineHeight: 19 },
  itemSub: { fontSize: 12, color: C.inkSoft, marginTop: 6 },
  itemStat: { fontSize: 12, color: C.primary, marginTop: 6 },
  tap: { fontSize: 11, color: C.primary, marginTop: 8 },
});
