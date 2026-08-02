// Вход в приложение по телефону или почте + пароль. «Запомнить меня» —
// не спрашивать логин/пароль при следующем открытии.

import React, { useState } from "react";
import {
  ScrollView, View, Text, TextInput, StyleSheet, Pressable,
} from "react-native";
import { C, R, SHADOW, SERIF } from "../theme";
import { PrimaryButton } from "../components/ui";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    if (!login.trim()) { setError("Введите телефон или почту."); return; }
    if (!password) { setError("Введите пароль."); return; }
    setBusy(true);
    const res = await signIn({ login, password, remember });
    setBusy(false);
    if (!res.ok) setError(res.error || "Не удалось войти.");
    // При успехе AuthProvider сам покажет приложение.
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Text style={[styles.brand, SERIF]}>ExpertOS</Text>
      <Text style={styles.subtitle}>Вход в ваш кабинет</Text>

      <View style={styles.card}>
        <TextInput
          value={login} onChangeText={setLogin}
          placeholder="Телефон или почта" placeholderTextColor={C.inkSoft}
          autoCapitalize="none" style={styles.input}
        />
        <TextInput
          value={password} onChangeText={setPassword}
          placeholder="Пароль" placeholderTextColor={C.inkSoft}
          secureTextEntry style={styles.input}
        />

        <Pressable onPress={() => setRemember((v) => !v)} style={styles.checkRow}>
          <View style={[styles.box, remember && styles.boxOn]}>{remember ? <Text style={styles.boxTick}>✓</Text> : null}</View>
          <Text style={styles.checkText}>Запомнить меня и не спрашивать при входе</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton title={busy ? "Вхожу…" : "Войти"} tone="accent" onPress={busy ? undefined : submit} />
      </View>

      <Pressable onPress={() => navigation.navigate("Register")} style={styles.switchRow}>
        <Text style={styles.switchText}>Нет аккаунта? <Text style={styles.link}>Зарегистрироваться</Text></Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingTop: 96, paddingBottom: 40 },
  brand: { fontSize: 34, color: C.primary, textAlign: "center", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: C.inkSoft, textAlign: "center", marginTop: 8, marginBottom: 28 },
  card: { backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.lineSoft, padding: 18, ...SHADOW.card },
  input: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: R.md,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: C.ink, marginBottom: 10,
  },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  boxOn: { backgroundColor: C.primary, borderColor: C.primary },
  boxTick: { color: C.white, fontSize: 13, fontWeight: "700" },
  checkText: { flex: 1, fontSize: 13, color: C.ink, lineHeight: 19 },
  link: { color: C.primary, fontWeight: "600", textDecorationLine: "underline" },
  error: { fontSize: 13, color: C.danger, marginBottom: 10, lineHeight: 18 },
  switchRow: { alignItems: "center", marginTop: 18 },
  switchText: { fontSize: 14, color: C.inkSoft },
});
