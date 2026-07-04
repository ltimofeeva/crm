import React, { useState, useCallback } from "react";
import { ScrollView, View, Text, TextInput, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, SERIF } from "../theme";
import { Card, Tag, H1, PrimaryButton } from "../components/ui";
import { getClients, addClient } from "../storage/store";

const EMPTY_FORM = { name: "", age: "", request: "", format: "", phone: "" };

export default function ClientsScreen({ navigation, route }) {
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    const data = await getClients();
    setClients(data);
    // Если пришли с другого экрана с именем — сразу открыть карточку.
    const openName = route.params?.openName;
    if (openName) {
      const c = data.find((x) => x.name === openName);
      navigation.setParams({ openName: undefined });
      if (c) navigation.navigate("ClientDetail", { id: c.id });
    }
  }, [route.params?.openName]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    await addClient(form);
    setForm(EMPTY_FORM);
    setFormOpen(false);
    load();
  };

  const list = clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <View style={styles.headRow}>
        <H1>Клиенты</H1>
        {!formOpen && <PrimaryButton title="＋ Новый" onPress={() => setFormOpen(true)} />}
      </View>

      {formOpen && (
        <Card style={styles.form}>
          <Text style={styles.formTitle}>Новый клиент</Text>
          <TextInput value={form.name} onChangeText={set("name")} placeholder="Имя и фамилия *" placeholderTextColor={C.inkSoft} style={styles.input} />
          <TextInput value={form.age} onChangeText={set("age")} placeholder="Возраст" placeholderTextColor={C.inkSoft} keyboardType="numeric" style={styles.input} />
          <TextInput value={form.request} onChangeText={set("request")} placeholder="Запрос (например: тревожность)" placeholderTextColor={C.inkSoft} style={styles.input} />
          <TextInput value={form.format} onChangeText={set("format")} placeholder="Формат: Онлайн / Кабинет" placeholderTextColor={C.inkSoft} style={styles.input} />
          <TextInput value={form.phone} onChangeText={set("phone")} placeholder="Телефон" placeholderTextColor={C.inkSoft} keyboardType="phone-pad" style={styles.input} />
          <View style={styles.formActions}>
            <View style={{ flex: 1 }}><PrimaryButton title="Отмена" tone="soft" onPress={() => { setFormOpen(false); setForm(EMPTY_FORM); }} /></View>
            <View style={{ flex: 1 }}><PrimaryButton title="Сохранить" tone="accent" onPress={save} /></View>
          </View>
          <Text style={styles.formHint}>
            Данные хранятся только на этом устройстве. Не записывайте лишнего —
            см. рекомендации по конфиденциальности.
          </Text>
        </Card>
      )}

      {clients.length > 0 && (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск по имени"
          placeholderTextColor={C.inkSoft}
          style={styles.search}
        />
      )}

      {clients.length === 0 && !formOpen && (
        <Card style={styles.empty}>
          <Text style={styles.emptyTitle}>Пока нет клиентов</Text>
          <Text style={styles.emptyText}>
            Нажмите «＋ Новый», чтобы добавить первого клиента. После сессий
            добавляйте заметки в его карточке — и ИИ-ассистент сможет готовить
            вас к встречам и анализировать динамику.
          </Text>
        </Card>
      )}

      {list.map((c) => (
        <Card key={c.id} style={styles.row} onPress={() => navigation.navigate("ClientDetail", { id: c.id })}>
          <View style={styles.avatar}>
            <Text style={[styles.avatarT, SERIF]}>
              {c.name.split(" ").map((w) => w[0]).join("").toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{c.name}</Text>
            {c.request ? <Text style={styles.req} numberOfLines={1}>{c.request}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Tag tone={c.status === "Пауза" ? "clay" : "green"}>{c.status}</Tag>
            <Text style={styles.count}>{c.sessionsCount} сессий</Text>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  form: { padding: 14, marginBottom: 12 },
  formTitle: { fontSize: 14, fontWeight: "600", color: C.ink, marginBottom: 10 },
  input: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.ink, marginBottom: 8,
  },
  formActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  formHint: { fontSize: 11, color: C.inkSoft, marginTop: 10, lineHeight: 15 },
  search: {
    backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.ink, marginBottom: 12,
  },
  empty: { padding: 20, alignItems: "center" },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: C.ink, marginBottom: 6 },
  emptyText: { fontSize: 13, color: C.inkSoft, textAlign: "center", lineHeight: 19 },
  row: { padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primarySoft, alignItems: "center", justifyContent: "center" },
  avatarT: { fontSize: 14, color: C.primary },
  name: { fontSize: 14, fontWeight: "600", color: C.ink },
  req: { fontSize: 11, color: C.inkSoft, marginTop: 2 },
  count: { fontSize: 10, color: C.inkSoft, marginTop: 4 },
});
