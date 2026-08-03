// Экран подписки. Тарифы и лимиты приходят с сервера (backend/plans.js),
// поэтому цены и лимиты меняются в одном месте и сразу видны в приложении.
//
// Оплата: на сайте пока нет автоматического приёма платежей (нужен платёжный
// сервис — ЮKassa, CloudPayments и т.п.). Поэтому здесь показаны условия и
// способ связи, а тариф подключается вручную после поступления оплаты.

import React, { useEffect, useState } from "react";
import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { C, R, SERIF } from "../theme";
import { Card, PrimaryButton, Tag } from "../components/ui";
import { apiGetPlans } from "../api/backend";
import { useSubscription } from "../context/SubscriptionContext";

const money = (n) => `${n.toLocaleString("ru-RU")} ₽`;
const num = (n) => n.toLocaleString("ru-RU");

export default function PaywallScreen({ navigation }) {
  const sub = useSubscription();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setPlans(await apiGetPlans()); }
      catch (e) { /* без списка покажем подсказку ниже */ }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={[styles.title, SERIF]}>Тарифы</Text>
      <Text style={styles.sub}>
        Сама CRM — клиенты, календарь, финансы — бесплатна навсегда.
        Платные тарифы добавляют ИИ-ассистента.
      </Text>

      {/* Что сейчас: пробный период, активный тариф или бесплатный */}
      {sub.source === "trial" && (
        <Card style={styles.notice}>
          <Text style={styles.noticeText}>
            🎁 Бесплатный период: {sub.trialDaysLeft === 1 ? "остался 1 день" : `осталось ${sub.trialDaysLeft} дн.`} —
            ИИ работает на условиях «Помощника».
          </Text>
        </Card>
      )}
      {sub.source === "paid" && (
        <Card style={styles.notice}>
          <Text style={styles.noticeText}>
            Активен тариф «{sub.planTitle}». Осталось в этом месяце:{" "}
            {num(sub.left.requests)} запросов к ИИ.
          </Text>
        </Card>
      )}
      {sub.source === "free" && (
        <Card style={[styles.notice, { backgroundColor: C.dangerSoft, borderColor: C.dangerSoft }]}>
          <Text style={[styles.noticeText, { color: C.danger }]}>
            Сейчас бесплатный тариф: приложение работает полностью, ИИ-функции выключены.
          </Text>
        </Card>
      )}

      {loading && <ActivityIndicator color={C.primary} style={{ marginTop: 20 }} />}

      {plans.map((p) => {
        const active = sub.planId === p.id;
        return (
          <Card key={p.id} style={[styles.plan, active && styles.planActive]}>
            <View style={styles.planHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planName}>{p.title}</Text>
                <Text style={styles.planPrice}>
                  {p.price ? `${money(p.price)} / мес` : "бесплатно"}
                </Text>
              </View>
              {active ? <Tag>Ваш тариф</Tag> : null}
            </View>

            {p.ai ? (
              <View style={styles.limits}>
                <Text style={styles.limitsT}>
                  До {num(p.requests)} обращений к ИИ в месяц
                </Text>
                <Text style={styles.limitsSub}>
                  Счётчик обнуляется 1-го числа
                </Text>
              </View>
            ) : null}

            {(p.features || []).map((f) => (
              <View key={f} style={styles.featureRow}>
                <Text style={styles.featureTick}>✓</Text>
                <Text style={styles.feature}>{f}</Text>
              </View>
            ))}
          </Card>
        );
      })}

      <Card style={styles.how}>
        <Text style={styles.howTitle}>Как подключить</Text>
        <Text style={styles.howText}>
          Напишите нам — пришлём реквизиты для оплаты и подключим тариф к вашему
          аккаунту в течение дня. Автоматическая оплата картой на сайте появится
          позже, когда будет подключён платёжный сервис.
        </Text>
        <View style={{ marginTop: 12, alignSelf: "flex-start" }}>
          <PrimaryButton title="Вернуться" tone="soft" onPress={() => navigation.goBack()} />
        </View>
      </Card>

      <Text style={styles.legal}>
        Лимит считается по фактическому расходу ИИ и обновляется первого числа
        каждого месяца. Неизрасходованные запросы на следующий месяц не переносятся.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 44 },
  title: { fontSize: 26, color: C.ink, textAlign: "center", marginTop: 8 },
  sub: { fontSize: 14, color: C.inkSoft, textAlign: "center", marginTop: 8, lineHeight: 20 },
  plan: { padding: 18, marginTop: 14 },
  planActive: { borderColor: C.primary, borderWidth: 2 },
  planHead: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 },
  planName: { fontSize: 17, fontWeight: "700", color: C.ink },
  planPrice: { fontSize: 15, color: C.primary, fontWeight: "700", marginTop: 2 },
  limits: {
    backgroundColor: C.primarySoft, borderRadius: R.md,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10,
  },
  limitsT: { fontSize: 13, color: C.primary, fontWeight: "700" },
  limitsSub: { fontSize: 11, color: C.inkSoft, marginTop: 2 },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 4 },
  featureTick: { fontSize: 14, color: C.primary, lineHeight: 21 },
  feature: { flex: 1, fontSize: 14, color: C.ink, lineHeight: 21 },
  notice: { padding: 14, marginTop: 14, backgroundColor: C.primarySoft, borderColor: C.primarySoft },
  noticeText: { fontSize: 13, color: C.primary, lineHeight: 19 },
  how: { padding: 18, marginTop: 18 },
  howTitle: { fontSize: 15, fontWeight: "700", color: C.ink, marginBottom: 8 },
  howText: { fontSize: 13, color: C.inkSoft, lineHeight: 19 },
  legal: { fontSize: 11, color: C.inkSoft, textAlign: "center", marginTop: 20, lineHeight: 16 },
});
