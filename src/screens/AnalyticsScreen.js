import React, { useState } from "react";
import { ScrollView, View, Text, StyleSheet, Dimensions } from "react-native";
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";
import { C, SERIF } from "../theme";
import { Card, Tag, H1, PrimaryButton } from "../components/ui";
import { WEEKLY, FUNNEL } from "../data/seed";

function TrendChart({ data, metric }) {
  const W = Dimensions.get("window").width - 32 - 32; // экран - паддинги экрана - паддинг карточки
  const H = 150, padX = 14, padTop = 18, padBot = 26;
  const innerW = W - padX * 2, innerH = H - padTop - padBot;
  const vals = data.map((d) => d[metric]);
  const max = Math.max(...vals), min = Math.min(...vals);
  const step = innerW / (data.length - 1);
  const y = (v) => padTop + innerH - ((v - min) / (max - min || 1)) * innerH;
  const pts = data.map((d, i) => [padX + i * step, y(d[metric])]);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${path} L${pts[pts.length - 1][0].toFixed(1)},${padTop + innerH} L${pts[0][0].toFixed(1)},${padTop + innerH} Z`;
  return (
    <Svg width={W} height={H}>
      <Defs>
        <LinearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={C.primary} stopOpacity="0.18" />
          <Stop offset="1" stopColor={C.primary} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#g)" />
      <Path d={path} fill="none" stroke={C.primary} strokeWidth="2" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <React.Fragment key={i}>
          <Circle cx={p[0]} cy={p[1]} r={data[i].partial ? 3.5 : 3} fill={data[i].partial ? C.bg : C.primary} stroke={C.primary} strokeWidth={data[i].partial ? 2 : 0} />
          <SvgText x={p[0]} y={p[1] - 8} fontSize="10" fill={C.ink} textAnchor="middle" fontWeight="600">{data[i][metric]}</SvgText>
          <SvgText x={p[0]} y={H - 8} fontSize="9" fill={C.inkSoft} textAnchor="middle">{data[i].label}</SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );
}

export default function AnalyticsScreen({ navigation }) {
  const [metric, setMetric] = useState("revenue");
  const titles = { revenue: "Доход", sessions: "Загрузка" };
  const units = { revenue: "тыс. ₽", sessions: "сессий" };

  const full = WEEKLY.filter((w) => !w.partial);
  const last = full[full.length - 1][metric], prev = full[full.length - 2][metric];
  const delta = Math.round(((last - prev) / prev) * 100);
  const up = delta >= 0;
  const totalSess = WEEKLY.reduce((s, w) => s + w.sessions, 0);
  const totalFree = WEEKLY.reduce((s, w) => s + w.freeSlots, 0);
  const fill = Math.round((totalSess / (totalSess + totalFree)) * 100);
  const funnelMax = FUNNEL[0].value;

  const askAnalysis = () =>
    navigation.navigate("AIChat", { preset: "Проанализируй мои недельные тренды дохода и загрузки, воронку и итоги прошлого месяца. Составь пошаговый план выхода на доход x2 в следующем месяце: посчитай арифметику цели, дай 2-3 реалистичных сценария и честно отметь риски." });

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.headRow}>
        <H1>Аналитика</H1>
        <PrimaryButton title="Разбор ИИ" onPress={askAnalysis} />
      </View>

      <View style={styles.statsRow}>
        <Card style={styles.stat}>
          <Text style={[styles.delta, { color: up ? C.primary : C.accent }]}>{up ? "+" : ""}{delta}%</Text>
          <Text style={styles.statL}>{titles[metric]} к пред. неделе</Text>
        </Card>
        <Card style={styles.stat}><Text style={[styles.statV, SERIF]}>{fill}%</Text><Text style={styles.statL}>Заполняемость окон</Text></Card>
        <Card style={styles.stat}><Text style={[styles.statV, SERIF]}>{totalFree}</Text><Text style={styles.statL}>Свободных / 6 нед</Text></Card>
      </View>

      <Card style={{ padding: 16 }}>
        <View style={styles.segbar}>
          {["revenue", "sessions"].map((k) => (
            <Text key={k} onPress={() => setMetric(k)} style={[styles.seg, metric === k && styles.segActive]}>{titles[k]}</Text>
          ))}
        </View>
        <TrendChart data={WEEKLY} metric={metric} />
        <Text style={styles.chartCaption}>{titles[metric]}, {units[metric]} · последняя неделя неполная</Text>
      </Card>

      <Text style={styles.section}>ВОРОНКА: КОНТЕНТ → КЛИЕНТЫ</Text>
      <Card style={{ padding: 16 }}>
        {FUNNEL.map((f, i) => {
          const w = Math.max(12, (f.value / funnelMax) * 100);
          const conv = i > 0 ? Math.round((f.value / FUNNEL[i - 1].value) * 100) : null;
          return (
            <View key={f.label} style={{ marginBottom: i === FUNNEL.length - 1 ? 0 : 12 }}>
              <View style={styles.funnelTop}>
                <Text style={styles.funnelLabel}>{f.label}</Text>
                <Text style={styles.funnelVal}>{f.value.toLocaleString("ru-RU")}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${w}%`, backgroundColor: i === FUNNEL.length - 1 ? C.accent : C.primary }]}>
                  {conv !== null ? <Text style={styles.barConv}>{conv}%</Text> : null}
                </View>
              </View>
              <Text style={styles.funnelSub}>{f.sub}</Text>
            </View>
          );
        })}
      </Card>

      <Card style={styles.hint} onPress={() => navigation.navigate("AIChat", { preset: "Где в моей воронке я теряю больше всего людей и что конкретно улучшить?" })}>
        <Text style={styles.hintText}>До первичной доходит примерно каждая третья заявка — узкое место. Спросить ИИ, как поднять конверсию?</Text>
        <Text style={styles.hintCta}>Разобрать →</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statsRow: { flexDirection: "row", gap: 8, marginVertical: 12 },
  stat: { flex: 1, padding: 12 },
  delta: { fontSize: 15, fontWeight: "700" },
  statV: { fontSize: 18, color: C.ink },
  statL: { fontSize: 11, color: C.inkSoft, marginTop: 4 },
  segbar: { flexDirection: "row", backgroundColor: "#E9EDE9", borderRadius: 12, padding: 4, gap: 4, marginBottom: 16 },
  seg: { flex: 1, textAlign: "center", paddingVertical: 8, borderRadius: 8, fontSize: 13, color: C.inkSoft, overflow: "hidden" },
  segActive: { backgroundColor: C.white, color: C.ink, fontWeight: "600" },
  chartCaption: { fontSize: 11, color: C.inkSoft, textAlign: "center", marginTop: 8 },
  section: { fontSize: 12, fontWeight: "600", color: C.inkSoft, letterSpacing: 0.5, marginTop: 20, marginBottom: 8 },
  funnelTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  funnelLabel: { fontSize: 13, color: C.ink },
  funnelVal: { fontSize: 13, fontWeight: "600", color: C.ink },
  barTrack: { height: 24, borderRadius: 8, backgroundColor: C.bg, overflow: "hidden", justifyContent: "center" },
  barFill: { height: "100%", borderRadius: 8, justifyContent: "center", paddingHorizontal: 8, minWidth: 40 },
  barConv: { fontSize: 10, color: C.white },
  funnelSub: { fontSize: 11, color: C.inkSoft, marginTop: 4 },
  hint: { padding: 14, marginTop: 12 },
  hintText: { fontSize: 13, color: C.ink, lineHeight: 18 },
  hintCta: { fontSize: 11, color: C.primary, marginTop: 4 },
});
