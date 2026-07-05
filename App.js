import React from "react";
import { Text, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { C } from "./src/theme";
import { SubscriptionProvider, useSubscription } from "./src/context/SubscriptionContext";

import DashboardScreen from "./src/screens/DashboardScreen";
import CalendarScreen from "./src/screens/CalendarScreen";
import ClientsScreen from "./src/screens/ClientsScreen";
import ClientDetailScreen from "./src/screens/ClientDetailScreen";
import ContentScreen from "./src/screens/ContentScreen";
import AnalyticsScreen from "./src/screens/AnalyticsScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import AIChatScreen from "./src/screens/AIChatScreen";
import PaywallScreen from "./src/screens/PaywallScreen";
import EventDetailScreen from "./src/screens/EventDetailScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Стек для вкладки «Клиенты»: список + карточка клиента.
function ClientsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true, headerTintColor: C.ink, headerStyle: { backgroundColor: C.bg }, headerShadowVisible: false }}>
      <Stack.Screen name="ClientsList" component={ClientsScreen} options={{ title: "Клиенты", headerShown: false }} />
      <Stack.Screen name="ClientDetail" component={ClientDetailScreen} options={{ title: "Карта клиента" }} />
    </Stack.Navigator>
  );
}

const TAB_ICONS = {
  Today: "◎", CalendarTab: "▦", Clients: "☺", Content: "✎", Analytics: "▤", Settings: "⚙",
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.inkSoft,
        tabBarStyle: { backgroundColor: C.white, borderTopColor: C.line, height: 60, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 10 },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 17, color: focused ? C.primary : C.inkSoft }}>{TAB_ICONS[route.name]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Today" component={DashboardScreen} options={{ title: "Сегодня" }} />
      <Tab.Screen name="CalendarTab" component={CalendarScreen} options={{ title: "Календарь" }} />
      <Tab.Screen name="Clients" component={ClientsStack} options={{ title: "Клиенты" }} />
      <Tab.Screen name="Content" component={ContentScreen} options={{ title: "Контент" }} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} options={{ title: "Аналитика" }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: "Ещё" }} />
    </Tab.Navigator>
  );
}

// Корень приложения: после окончания пробного периода без подписки
// «Помощник» показываем экран оформления вместо вкладок.
function Root({ navigation, route }) {
  const { isBasic, loading } = useSubscription();
  if (!loading && !isBasic) {
    return <PaywallScreen navigation={navigation} route={route} />;
  }
  return <Tabs />;
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
          <Stack.Screen name="Root" component={Root} options={{ headerShown: false }} />
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
          <Stack.Screen
            name="EventDetail"
            component={EventDetailScreen}
            options={{ title: "Событие", presentation: "modal", headerTintColor: C.ink, headerStyle: { backgroundColor: C.bg }, headerShadowVisible: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SubscriptionProvider>
  );
}

const styles = StyleSheet.create({});
