// Компактный календарик для выбора даты (используется в календаре,
// графике и переносе записи).

import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { C } from "../theme";
import { WD, dateKey, monthMatrix } from "../utils/datetime";

export default function MiniCalendar({ value, onPick }) {
  const init = value ? new Date(value + "T00:00:00") : new Date();
  const [cur, setCur] = useState(new Date(init.getFullYear(), init.getMonth(), 1));
  const weeks = monthMatrix(cur.getFullYear(), cur.getMonth());
  const title = cur.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <Pressable onPress={() => setCur(new Date(cur.getFullYear(), cur.getMonth() - 1, 1))} style={styles.nav}>
          <Text style={styles.navT}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{title.charAt(0).toUpperCase() + title.slice(1)}</Text>
        <Pressable onPress={() => setCur(new Date(cur.getFullYear(), cur.getMonth() + 1, 1))} style={styles.nav}>
          <Text style={styles.navT}>›</Text>
        </Pressable>
      </View>
      <View style={styles.week}>
        {WD.map((w) => <Text key={w} style={styles.wd}>{w}</Text>)}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.week}>
          {week.map((d, di) => {
            if (!d) return <View key={di} style={styles.cell} />;
            const key = dateKey(d);
            const sel = key === value;
            return (
              <Pressable key={di} onPress={() => onPick(key)} style={[styles.cell, sel && styles.cellSel]}>
                <Text style={[styles.cellT, sel && styles.cellTSel]}>{d.getDate()}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 8, marginBottom: 8 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nav: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  navT: { fontSize: 18, color: C.primary },
  title: { fontSize: 13, fontWeight: "600", color: C.ink },
  week: { flexDirection: "row" },
  wd: { flex: 1, textAlign: "center", fontSize: 10, color: C.inkSoft, paddingVertical: 3 },
  cell: { flex: 1, aspectRatio: 1.2, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  cellSel: { backgroundColor: C.primary },
  cellT: { fontSize: 12, color: C.ink },
  cellTSel: { color: C.white, fontWeight: "700" },
});
