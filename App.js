import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { C } from "./src/theme";
import { SubscriptionProvider } from "./src/context/SubscriptionContext";

import DashboardScreen from "./src/screens/DashboardScreen";
import ClientsScreen from "./src/screens/ClientsScreen";
import ClientDetailScreen from "./src/screens/ClientDetailScreen";
import ContentScreen from "./src/screens/ContentScreen";
import AnalyticsScreen from "./src/screens/AnalyticsScreen";
import FinanceScreen from "./src/screens/FinanceScreen";
import AIChatScreen from "./src/screens/AIChatScreen";
import PaywallScreen from "./src/screens/PaywallScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Простая текстовая иконка вкладки (без доп. библиотек иконок).
function TabIcon({ label, focused }) {
  return <Text style={{ fontSize: 11, color: focused ? C.primary : C.inkSoft, fontWeight: focused ? "700" : "400" }}>{label}</Text>;
}

// Стек для вкладки «Клиенты»: список + карточка клиента.
function ClientsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true, headerTintColor: C.ink, headerStyle: { backgroundColor: C.bg }, headerShadowVisible: false }}>
      <Stack.Screen name="ClientsList" component={ClientsScreen} options={{ title: "Клиенты", headerShown: false }} />
      <Stack.Screen name="ClientDetail" component={ClientDetailScreen} options={{ title: "Карта клиента" }} />
    </Stack.Navigator>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.inkSoft,
        tabBarStyle: { backgroundColor: C.white, borderTopColor: C.line, height: 60, paddingBottom: 8, paddingTop: 6 },
        tabBarIcon: ({ focused }) => {
          const labels = { Today: "◎", Clients: "☺", Content: "✎", Analytics: "▤", Finance: "₽" };
          return <Text style={{ fontSize: 18, color: focused ? C.primary : C.inkSoft }}>{labels[route.name]}</Text>;
        },
      })}
    >
      <Tab.Screen name="Today" component={DashboardScreen} options={{ title: "Сегодня" }} />
      <Tab.Screen name="Clients" component={ClientsStack} options={{ title: "Клиенты" }} />
      <Tab.Screen name="Content" component={ContentScreen} options={{ title: "Контент" }} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} options={{ title: "Аналитика" }} />
      <Tab.Screen name="Finance" component={FinanceScreen} options={{ title: "Финансы" }} />
    </Tab.Navigator>
  );
}

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: C.bg, card: C.bg, text: C.ink, primary: C.primary, border: C.line },
};

export default function App() {
  return (
    <SubscriptionProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="dark" />
        <Stack.Navigator>
          <Stack.Screen name="Root" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="AIChat"
            component={AIChatScreen}
            options={{ title: "Ассистент практики", presentation: "modal", headerTintColor: C.ink, headerStyle: { backgroundColor: C.bg }, headerShadowVisible: false }}
          />
          <Stack.Screen
            name="Paywall"
            component={PaywallScreen}
            options={{ title: "Подписка", presentation: "modal", headerTintColor: C.ink, headerStyle: { backgroundColor: C.bg }, headerShadowVisible: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SubscriptionProvider>
  );
}

const styles = StyleSheet.create({});
