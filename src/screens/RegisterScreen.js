// Регистрация: вход по номеру телефона или почте, пароль, согласие на
// обработку персональных данных. Аккаунт сохраняется на устройстве.

import React, { useState } from "react";
import {
  ScrollView, View, Text, TextInput, StyleSheet, Pressable,
} from "react-native";
import { C, R, SHADOW, SERIF } from "../theme";
import { PrimaryButton } from "../components/ui";
import LegalModal from "../components/LegalModal";
import { useAuth } from "../context/AuthContext";
import { formatPhone } from "../utils/phone";

export default function RegisterScreen({ navigation }) {
  const { signUp } = useAuth();
  const [method, setMethod] = useState("phone"); // phone | email
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [remember, setRemember] = useState(true);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [legal, setLegal] = useState(null); // null | "consent" | "privacy"

  const submit = async () => {
    setError("");
    const login = method === "phone" ? phone : email;
    if (!login.trim()) { setError(method === "phone" ? "Введите номер телефона." : "Введите почту."); return; }
    if (password.length < 6) { setError("Пароль должен быть не короче 6 символов."); return; }
    if (password !== repeat) { setError("Пароли не совпадают."); return; }
    if (!agree) { setError("Отметьте согласие на обработку персональных данных."); return; }
    setBusy(true);
    const res = await signUp({ login, password, remember });
    setBusy(false);
    if (!res.ok) setError(res.error || "Не удалось зарегистрироваться.");
    // При успехе AuthProvider сам покажет приложение.
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Text style={[styles.brand, SERIF]}>ExpertOS</Text>
      <Text style={styles.subtitle}>Создайте аккаунт, чтобы начать работу</Text>

      <View style={styles.card}>
        <View style={styles.tabs}>
          <Pressable onPress={() => setMethod("phone")} style={[styles.tab, method === "phone" && styles.tabOn]}>
            <Text style={[styles.tabT, method === "phone" && styles.tabTOn]}>По телефону</Text>
          </Pressable>
          <Pressable onPress={() => setMethod("email")} style={[styles.tab, method === "email" && styles.tabOn]}>
            <Text style={[styles.tabT, method === "email" && styles.tabTOn]}>По почте</Text>
          </Pressable>
        </View>

        {method === "phone" ? (
          <TextInput
            value={phone}
            onChangeText={(v) => setPhone(formatPhone(v))}
            placeholder="+7 (___) ___-__-__" placeholderTextColor={C.inkSoft}
            keyboardType="phone-pad" maxLength={18} style={styles.input}
          />
        ) : (
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com" placeholderTextColor={C.inkSoft}
            keyboardType="email-address" autoCapitalize="none" style={styles.input}
          />
        )}

        <TextInput
          value={password} onChangeText={setPassword}
          placeholder="Пароль (от 6 символов)" placeholderTextColor={C.inkSoft}
          secureTextEntry style={styles.input}
        />
        <TextInput
          value={repeat} onChangeText={setRepeat}
          placeholder="Повторите пароль" placeholderTextColor={C.inkSoft}
          secureTextEntry style={styles.input}
        />

        <Pressable onPress={() => setRemember((v) => !v)} style={styles.checkRow}>
          <View style={[styles.box, remember && styles.boxOn]}>{remember ? <Text style={styles.boxTick}>✓</Text> : null}</View>
          <Text style={styles.checkText}>Запомнить меня и не спрашивать при входе</Text>
        </Pressable>

        <Pressable onPress={() => setAgree((v) => !v)} style={styles.checkRow}>
          <View style={[styles.box, agree && styles.boxOn]}>{agree ? <Text style={styles.boxTick}>✓</Text> : null}</View>
          <Text style={styles.checkText}>
            Я принимаю{" "}
            <Text style={styles.link} onPress={() => setLegal("consent")}>согласие на обработку персональных данных</Text>
            {" "}и{" "}
            <Text style={styles.link} onPress={() => setLegal("privacy")}>политику конфиденциальности</Text>
          </Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton title={busy ? "Создаю…" : "Зарегистрироваться"} tone="accent" onPress={busy ? undefined : submit} />
      </View>

      <Pressable onPress={() => navigation.navigate("Login")} style={styles.switchRow}>
        <Text style={styles.switchText}>Уже есть аккаунт? <Text style={styles.link}>Войти</Text></Text>
      </Pressable>

      <LegalModal visible={legal !== null} kind={legal} onClose={() => setLegal(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingTop: 64, paddingBottom: 40 },
  brand: { fontSize: 34, color: C.primary, textAlign: "center", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: C.inkSoft, textAlign: "center", marginTop: 8, marginBottom: 28 },
  card: { backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.lineSoft, padding: 18, ...SHADOW.card },
  tabs: { flexDirection: "row", backgroundColor: C.primarySoft, borderRadius: R.md, padding: 4, gap: 4, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: R.sm, alignItems: "center" },
  tabOn: { backgroundColor: C.white, ...SHADOW.soft },
  tabT: { fontSize: 13, color: C.inkSoft },
  tabTOn: { color: C.ink, fontWeight: "700" },
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
  error: { fontSize: 13, color: C.accent, marginBottom: 10, lineHeight: 18 },
  switchRow: { alignItems: "center", marginTop: 18 },
  switchText: { fontSize: 14, color: C.inkSoft },
});
