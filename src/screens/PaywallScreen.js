// Экран подписки (paywall). Показывает пакеты из RevenueCat,
// проводит покупку через App Store / Google Play и восстановление покупок.

import React, { useEffect, useState } from "react";
import {
  ScrollView, View, Text, StyleSheet, ActivityIndicator, Alert, Pressable,
} from "react-native";
import { C, SERIF } from "../theme";
import { Card, PrimaryButton } from "../components/ui";
import {
  getSubscriptionPackages, purchasePackage, restorePurchases,
} from "../api/purchases";
import { useSubscription } from "../context/SubscriptionContext";

const FEATURES = [
  "ИИ-ассистент с контекстом всей практики",
  "Подготовка к сессиям и анализ клиентов по заметкам",
  "Бизнес-разбор: доход, загрузка, воронка, план роста",
  "Идеи и черновики постов для соцсетей",
];

export default function PaywallScreen({ navigation }) {
  const { billingEnabled, isPro, refresh } = useSubscription();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setPackages(await getSubscriptionPackages());
      } catch (e) {
        // список останется пустым — покажем подсказку ниже
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const buy = async (pkg) => {
    if (buying) return;
    setBuying(true);
    try {
      const active = await purchasePackage(pkg);
      await refresh();
      if (active) {
        Alert.alert("Готово", "Подписка активна. Приятной работы!");
        navigation.goBack();
      }
    } catch (e) {
      // Отмену покупки пользователем не считаем ошибкой.
      if (!e?.userCancelled) {
        Alert.alert("Не получилось", "Покупка не прошла. Попробуйте ещё раз.");
      }
    } finally {
      setBuying(false);
    }
  };

  const restore = async () => {
    try {
      const active = await restorePurchases();
      await refresh();
      Alert.alert(
        active ? "Подписка восстановлена" : "Покупок не найдено",
        active ? "Все функции снова доступны." : "На этом аккаунте нет активной подписки.",
      );
      if (active) navigation.goBack();
    } catch (e) {
      Alert.alert("Ошибка", "Не удалось восстановить покупки.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={[styles.title, SERIF]}>Практика Про</Text>
      <Text style={styles.sub}>
        ИИ-ассистент, который знает вашу практику: клиенты, расписание, финансы.
      </Text>

      <Card style={styles.features}>
        {FEATURES.map((f) => (
          <Text key={f} style={styles.feature}>✓  {f}</Text>
        ))}
      </Card>

      {isPro && billingEnabled && (
        <Card style={styles.notice}>
          <Text style={styles.noticeText}>Подписка уже активна — всё доступно.</Text>
        </Card>
      )}

      {loading && <ActivityIndicator color={C.primary} style={{ marginTop: 20 }} />}

      {!loading && packages.map((pkg) => (
        <Pressable key={pkg.identifier} onPress={() => buy(pkg)} disabled={buying}>
          <Card style={styles.pkg}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pkgTitle}>{pkg.product?.title || pkg.identifier}</Text>
              <Text style={styles.pkgSub}>{pkg.product?.description || ""}</Text>
            </View>
            <Text style={styles.pkgPrice}>{pkg.product?.priceString || ""}</Text>
          </Card>
        </Pressable>
      ))}

      {!loading && packages.length === 0 && (
        <Card style={styles.notice}>
          <Text style={styles.noticeText}>
            {billingEnabled
              ? "Пакеты подписки пока не настроены в RevenueCat (раздел Offerings)."
              : "Платежи не подключены: приложение в режиме разработки, все функции открыты. Как подключить подписку — см. README, раздел «Подписка»."}
          </Text>
        </Card>
      )}

      {billingEnabled && (
        <View style={{ marginTop: 16, alignItems: "center" }}>
          <PrimaryButton title="Восстановить покупки" tone="soft" onPress={restore} />
        </View>
      )}

      <Text style={styles.legal}>
        Подписка продлевается автоматически, отменить можно в любой момент в
        настройках App Store / Google Play. Оплата списывается через ваш
        аккаунт магазина приложений.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, color: C.ink, textAlign: "center", marginTop: 8 },
  sub: { fontSize: 14, color: C.inkSoft, textAlign: "center", marginTop: 8, lineHeight: 20 },
  features: { padding: 16, marginTop: 20 },
  feature: { fontSize: 14, color: C.ink, lineHeight: 26 },
  pkg: { padding: 16, marginTop: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  pkgTitle: { fontSize: 15, fontWeight: "600", color: C.ink },
  pkgSub: { fontSize: 12, color: C.inkSoft, marginTop: 2 },
  pkgPrice: { fontSize: 16, fontWeight: "700", color: C.primary },
  notice: { padding: 14, marginTop: 14, backgroundColor: C.primarySoft, borderColor: C.primarySoft },
  noticeText: { fontSize: 13, color: C.primary, lineHeight: 19 },
  legal: { fontSize: 11, color: C.inkSoft, textAlign: "center", marginTop: 20, lineHeight: 16 },
});
