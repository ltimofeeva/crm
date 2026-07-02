import React, { useState, useEffect, useCallback } from "react";
import { ScrollView, View, Text, TextInput, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, SERIF } from "../theme";
import { Card, Tag, H1 } from "../components/ui";
import { getClients } from "../storage/store";

export default function ClientsScreen({ navigation, route }) {
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const data = await getClients();
    setClients(data);
    // Если пришли с дашборда с именем — сразу открыть карточку.
    const openName = route.params?.openName;
    if (openName) {
      const c = data.find((x) => x.name === openName);
      navigation.setParams({ openName: undefined });
      if (c) navigation.navigate("ClientDetail", { id: c.id });
    }
  }, [route.params?.openName]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const list = clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <H1>Клиенты</H1>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Поиск по имени"
        placeholderTextColor={C.inkSoft}
        style={styles.search}
      />
      {list.map((c) => (
        <Card key={c.id} style={styles.row} onPress={() => navigation.navigate("ClientDetail", { id: c.id })}>
          <View style={styles.avatar}>
            <Text style={[styles.avatarT, SERIF]}>
              {c.name.split(" ").map((w) => w[0]).join("")}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{c.name}</Text>
            <Text style={styles.req} numberOfLines={1}>{c.request}</Text>
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
  search: {
    backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.ink, marginBottom: 12,
  },
  row: { padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primarySoft, alignItems: "center", justifyContent: "center" },
  avatarT: { fontSize: 14, color: C.primary },
  name: { fontSize: 14, fontWeight: "600", color: C.ink },
  req: { fontSize: 11, color: C.inkSoft, marginTop: 2 },
  count: { fontSize: 10, color: C.inkSoft, marginTop: 4 },
});
