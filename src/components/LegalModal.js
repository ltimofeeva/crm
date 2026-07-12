// Модальное окно с юридическими текстами: согласие на обработку персональных
// данных и политика конфиденциальности.
//
// ВНИМАНИЕ ВЛАДЕЛИЦЕ: тексты ниже — рыба (заглушка). Перед публикацией в
// сторах замените их на настоящие документы, согласованные с юристом, и/или
// вставьте ссылки на них. Наличие этих документов обязательно для App Store
// и Google Play и требуется по 152-ФЗ «О персональных данных».

import React from "react";
import { Modal, View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { C } from "../theme";
import { PrimaryButton } from "./ui";

const CONSENT_TEXT =
  "Регистрируясь в приложении «Практика», вы даёте согласие на обработку ваших " +
  "персональных данных (имя, телефон, адрес электронной почты), а также данных, " +
  "которые вы вносите о своих клиентах, исключительно в целях работы приложения. " +
  "Данные хранятся на вашем устройстве. Вы можете отозвать согласие и удалить " +
  "данные в любой момент в настройках приложения.\n\n" +
  "Это текст-заглушка. Перед публикацией замените его на согласие, подготовленное " +
  "с учётом требований 152-ФЗ «О персональных данных».";

const PRIVACY_TEXT =
  "Политика конфиденциальности описывает, какие данные приложение «Практика» " +
  "собирает и как их использует. Приложение хранит данные о вас и ваших клиентах " +
  "локально на устройстве. Запросы к ИИ-ассистенту передаются через защищённый " +
  "сервер-посредник и не используются для обучения моделей. Оплата подписки " +
  "обрабатывается App Store / Google Play.\n\n" +
  "Это текст-заглушка. Перед публикацией замените его на вашу политику " +
  "конфиденциальности.";

export default function LegalModal({ visible, kind, onClose }) {
  const isPrivacy = kind === "privacy";
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>
              {isPrivacy ? "Политика конфиденциальности" : "Согласие на обработку персональных данных"}
            </Text>
            <Pressable onPress={onClose} style={{ padding: 6 }}>
              <Text style={{ fontSize: 16, color: C.inkSoft }}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 380 }}>
            <Text style={styles.text}>{isPrivacy ? PRIVACY_TEXT : CONSENT_TEXT}</Text>
          </ScrollView>
          <View style={{ marginTop: 12 }}>
            <PrimaryButton title="Понятно" tone="accent" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(36,51,44,0.4)", alignItems: "center", justifyContent: "center", padding: 16 },
  card: { width: "100%", maxWidth: 440, backgroundColor: C.white, borderRadius: 16, padding: 16 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: "700", color: C.ink },
  text: { fontSize: 13, color: C.ink, lineHeight: 20 },
});
