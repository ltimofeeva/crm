// «Контент»: Идеи / Черновики / Запланировано + генерация идей ИИ на основе
// практики (темы сессий, запросы клиентов, продукты и профиль специалиста).

import React, { useState, useCallback } from "react";
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C } from "../theme";
import { Card, H1, PrimaryButton, BrainButton } from "../components/ui";
import {
  getContent, addContentItem, moveContentItem, deleteContentItem,
} from "../storage/store";
import { buildFullContext, fetchContentIdeas } from "../api/ai";
import { useSubscription } from "../context/SubscriptionContext";

const SEGS = [
  { key: "ideas", title: "Идеи" },
  { key: "drafts", title: "Черновики" },
  { key: "planned", title: "Запланировано" },
];

const NEXT = { ideas: { to: "drafts", label: "→ В черновики" }, drafts: { to: "planned", label: "→ Запланировать" } };

export default function ContentScreen({ navigation }) {
  const { isPro } = useSubscription();
  const [content, setContent] = useState({ ideas: [], drafts: [], planned: [] });
  const [seg, setSeg] = useState("ideas");
  const [genState, setGenState] = useState("idle");
  const [newTitle, setNewTitle] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => setContent(await getContent()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const genIdeas = async () => {
    if (!isPro) { navigation.navigate("Paywall"); return; }
    setGenState("loading");
    try {
      const system = await buildFullContext();
      // Передаём уже существующие темы, чтобы ИИ не повторялся.
      const existing = [...content.ideas, ...content.drafts, ...content.planned].map((i) => i.title);
      const ideas = await fetchContentIdeas(system, existing);
      for (const idea of ideas.reverse()) {
        await addContentItem("ideas", {
          title: idea.title,
          extra: [idea.format, idea.why].filter(Boolean).join(" · "),
        });
      }
      await load();
      setSeg("ideas");
      setGenState("idle");
    } catch (e) {
      setGenState("error");
    }
  };

  const addOwn = async () => {
    if (!newTitle.trim()) return;
    await addContentItem(seg, { title: newTitle.trim(), extra: "" });
    setNewTitle("");
    setAddOpen(false);
    load();
  };

  const draftWithAI = (it) =>
    navigation.navigate("AIChat", {
      preset: `Напиши черновик поста «${it.title}» для соцсетей. Учитывай мой профиль, продукты и темы практики. Дай цепляющее начало, основную часть и мягкий призыв к действию.`,
    });

  const move = async (id) => { await moveContentItem(seg, NEXT[seg].to, id); load(); };
  const remove = async (id) => { await deleteContentItem(seg, id); load(); };

  const items = content[seg] || [];

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}><H1>Контент</H1></View>
        <PrimaryButton
          title={genState === "loading" ? "Думаю…" : "Идеи ИИ"}
          onPress={genState === "loading" ? undefined : genIdeas}
        />
        <BrainButton onPress={() => navigation.navigate("AIChat")} />
      </View>

      <View style={styles.segbar}>
        {SEGS.map((s) => (
          <Text key={s.key} onPress={() => setSeg(s.key)} style={[styles.seg, seg === s.key && styles.segActive]}>
            {s.title} <Text style={styles.segCount}>{(content[s.key] || []).length}</Text>
          </Text>
        ))}
      </View>

      {genState === "loading" && (
        <Card style={{ padding: 16, alignItems: "center", marginBottom: 8 }}>
          <ActivityIndicator color={C.primary} />
          <Text style={styles.genHint}>Ассистент изучает вашу практику…</Text>
        </Card>
      )}
      {genState === "error" && (
        <Card style={{ padding: 14, marginBottom: 8 }}>
          <Text style={{ fontSize: 12, color: C.accent }}>Не получилось сгенерировать идеи. Попробуйте ещё раз.</Text>
        </Card>
      )}

      {!addOpen ? (
        <Pressable onPress={() => setAddOpen(true)}>
          <Text style={styles.addLink}>＋ Добавить свою запись</Text>
        </Pressable>
      ) : (
        <Card style={{ padding: 12, marginBottom: 8 }}>
          <TextInput
            value={newTitle} onChangeText={setNewTitle}
            placeholder="Заголовок…" placeholderTextColor={C.inkSoft} style={styles.input}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><PrimaryButton title="Отмена" tone="soft" onPress={() => setAddOpen(false)} /></View>
            <View style={{ flex: 1 }}><PrimaryButton title="Добавить" tone="accent" onPress={addOwn} /></View>
          </View>
        </Card>
      )}

      {items.length === 0 && genState !== "loading" && (
        <Card style={{ padding: 16 }}>
          <Text style={styles.empty}>
            {seg === "ideas"
              ? "Пока пусто. Нажмите «Идеи ИИ» — ассистент предложит темы на основе ваших сессий, запросов клиентов и продуктов."
              : seg === "drafts"
                ? "Черновиков нет. Возьмите идею из первой вкладки и нажмите «Черновик с ИИ»."
                : "Запланированного контента нет. Переносите сюда готовые черновики."}
          </Text>
        </Card>
      )}

      {items.map((it) => (
        <Card key={it.id} style={styles.item}>
          <Text style={styles.itemTitle}>{it.title}</Text>
          {it.extra ? <Text style={styles.itemSub}>{it.extra}</Text> : null}
          <View style={styles.itemActions}>
            {seg !== "planned" && (
              <Pressable onPress={() => draftWithAI(it)}><Text style={styles.action}>Черновик с ИИ</Text></Pressable>
            )}
            {NEXT[seg] && (
              <Pressable onPress={() => move(it.id)}><Text style={styles.action}>{NEXT[seg].label}</Text></Pressable>
            )}
            <Pressable onPress={() => remove(it.id)}><Text style={[styles.action, { color: C.accent }]}>Удалить</Text></Pressable>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  segbar: { flexDirection: "row", backgroundColor: "#E9EDE9", borderRadius: 12, padding: 4, gap: 4, marginBottom: 12, marginTop: 8 },
  seg: { flex: 1, textAlign: "center", paddingVertical: 8, borderRadius: 8, fontSize: 12, color: C.inkSoft, overflow: "hidden" },
  segActive: { backgroundColor: C.white, color: C.ink, fontWeight: "600" },
  segCount: { fontSize: 11, color: C.inkSoft },
  genHint: { fontSize: 12, color: C.inkSoft, marginTop: 8 },
  addLink: { fontSize: 13, color: C.primary, marginBottom: 8, fontWeight: "600" },
  input: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.ink, marginBottom: 8,
  },
  empty: { fontSize: 13, color: C.inkSoft, lineHeight: 19 },
  item: { padding: 14, marginBottom: 8 },
  itemTitle: { fontSize: 14, fontWeight: "600", color: C.ink, lineHeight: 19 },
  itemSub: { fontSize: 12, color: C.inkSoft, marginTop: 4, lineHeight: 16 },
  itemActions: { flexDirection: "row", gap: 16, marginTop: 10 },
  action: { fontSize: 12, color: C.primary, fontWeight: "600" },
});
