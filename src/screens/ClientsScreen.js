import React, { useState, useCallback } from "react";
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, SERIF } from "../theme";
import { Card, Tag, H1, PrimaryButton, BrainButton } from "../components/ui";
import ImportClientsModal from "../components/ImportClientsModal";
import { getClients, addClient } from "../storage/store";
import { formatBirthDate } from "../utils/birthday";

const EMPTY_FORM = { name: "", birthDate: "", request: "", format: "", phone: "", contactVia: "" };

// Каналы связи для поля «Связаться в».
export const CONTACT_CHANNELS = ["Телеграм", "МАКС", "ВК", "СМС", "По телефону"];

// Маска телефона: +7 (XXX) XXX-XX-XX. Оставляем только цифры и форматируем.
function formatPhone(value) {
  let digits = value.replace(/\D/g, "");
  // Отбрасываем ведущую 7/8 (страна) — она уже в «+7».
  if (digits.startsWith("7") || digits.startsWith("8")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length === 0) return "";
  let out = "+7 (" + digits.slice(0, 3);
  if (digits.length >= 4) out += ") " + digits.slice(3, 6);
  if (digits.length >= 7) out += "-" + digits.slice(6, 8);
  if (digits.length >= 9) out += "-" + digits.slice(8, 10);
  return out;
}

export default function ClientsScreen({ navigation, route }) {
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [importOpen, setImportOpen] = useState(false);

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
    // Пришли из календаря с новым именем — сразу открываем форму клиента.
    const newName = route.params?.newName;
    if (newName) {
      navigation.setParams({ newName: undefined });
      setForm({ ...EMPTY_FORM, name: newName });
      setFormOpen(true);
    }
  }, [route.params?.openName, route.params?.newName]);

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
        <View style={{ flex: 1 }}><H1>Клиенты</H1></View>
        {!formOpen && <PrimaryButton title="＋ Новый" onPress={() => setFormOpen(true)} />}
        <BrainButton onPress={() => navigation.navigate("AIChat")} />
      </View>

      {formOpen && (
        <Card style={styles.form}>
          <Text style={styles.formTitle}>Новый клиент</Text>
          <TextInput value={form.name} onChangeText={set("name")} placeholder="Имя и фамилия *" placeholderTextColor={C.inkSoft} style={styles.input} />
          <TextInput
            value={form.birthDate}
            onChangeText={(v) => setForm((f) => ({ ...f, birthDate: formatBirthDate(v) }))}
            placeholder="Дата рождения: ДД.ММ.ГГГГ"
            placeholderTextColor={C.inkSoft}
            keyboardType="numeric"
            maxLength={10}
            style={styles.input}
          />
          <TextInput value={form.request} onChangeText={set("request")} placeholder="Запрос (например: тревожность)" placeholderTextColor={C.inkSoft} style={styles.input} />
          <TextInput value={form.format} onChangeText={set("format")} placeholder="Формат: Онлайн / Кабинет" placeholderTextColor={C.inkSoft} style={styles.input} />
          <TextInput
            value={form.phone}
            onChangeText={(v) => setForm((f) => ({ ...f, phone: formatPhone(v) }))}
            placeholder="+7 (___) ___-__-__"
            placeholderTextColor={C.inkSoft}
            keyboardType="phone-pad"
            maxLength={18}
            style={styles.input}
          />
          <Text style={styles.channelLabel}>Связаться в</Text>
          <View style={styles.channelRow}>
            {CONTACT_CHANNELS.map((ch) => (
              <Pressable
                key={ch}
                onPress={() => setForm((f) => ({ ...f, contactVia: f.contactVia === ch ? "" : ch }))}
                style={[styles.channelChip, form.contactVia === ch && styles.channelChipOn]}
              >
                <Text style={[styles.channelT, form.contactVia === ch && styles.channelTOn]}>{ch}</Text>
              </Pressable>
            ))}
          </View>
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

      {!formOpen && (
        <Pressable onPress={() => setImportOpen(true)}>
          <Text style={styles.importLink}>📥 Загрузить базу из Excel</Text>
        </Pressable>
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

      <ImportClientsModal
        visible={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => { setImportOpen(false); load(); }}
      />

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
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  channelLabel: { fontSize: 11, color: C.inkSoft, marginBottom: 6 },
  channelRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  channelChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line },
  channelChipOn: { backgroundColor: C.primary, borderColor: C.primary },
  channelT: { fontSize: 12, color: C.ink },
  channelTOn: { color: C.white },
  form: { padding: 14, marginBottom: 12 },
  formTitle: { fontSize: 14, fontWeight: "600", color: C.ink, marginBottom: 10 },
  input: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.ink, marginBottom: 8,
  },
  formActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  formHint: { fontSize: 11, color: C.inkSoft, marginTop: 10, lineHeight: 15 },
  importLink: { fontSize: 13, color: C.primary, fontWeight: "600", marginBottom: 10 },
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
