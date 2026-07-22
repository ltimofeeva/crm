import React from "react";
import { Text, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { C } from "./src/theme";
import { SubscriptionProvider, useSubscription } from "./src/context/SubscriptionContext";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import TabIcon from "./src/components/TabIcon";

import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
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

// Общие настройки шапки для стеков внутри вкладок.
const stackOptions = {
  headerShown: true, headerTintColor: C.ink,
  headerStyle: { backgroundColor: C.bg }, headerShadowVisible: false,
};

// Стек для вкладки «Клиенты»: список + карточка клиента.
function ClientsStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="ClientsList" component={ClientsScreen} options={{ title: "Клиенты", headerShown: false }} />
      <Stack.Screen name="ClientDetail" component={ClientDetailScreen} options={{ title: "Карта клиента" }} />
    </Stack.Navigator>
  );
}

// «Сегодня»: лента дня + событие и карточка клиента открываются ПОВЕРХ,
// не пряча нижнее меню.
function TodayStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="TodayHome" component={DashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: "Событие" }} />
      <Stack.Screen name="ClientCard" component={ClientDetailScreen} options={{ title: "Карта клиента" }} />
    </Stack.Navigator>
  );
}

// «Календарь»: сетка + карточка события.
function CalendarStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="CalendarHome" component={CalendarScreen} options={{ headerShown: false }} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: "Событие" }} />
    </Stack.Navigator>
  );
}

// «Аналитика»: отчёты + карточка клиента из напоминаний о продажах.
function AnalyticsStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="AnalyticsHome" component={AnalyticsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ClientCard" component={ClientDetailScreen} options={{ title: "Карта клиента" }} />
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
        tabBarStyle: { backgroundColor: C.white, borderTopColor: C.line, height: 64, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 9.5, marginTop: 1 },
        tabBarIcon: ({ color }) => (
          <TabIcon route={route.name} color={color} size={23} />
        ),
      })}
    >
      <Tab.Screen name="Today" component={TodayStack} options={{ title: "Сегодня" }} />
      <Tab.Screen name="CalendarTab" component={CalendarStack} options={{ title: "Календарь" }} />
      <Tab.Screen name="Clients" component={ClientsStack} options={{ title: "Клиенты" }} />
      <Tab.Screen name="Content" component={ContentScreen} options={{ title: "Контент" }} />
      <Tab.Screen name="Analytics" component={AnalyticsStack} options={{ title: "Аналитика" }} />
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

// Навигация верхнего уровня: пока не вошли — экраны входа/регистрации,
// после входа — само приложение (с проверкой подписки внутри Root).
function AppNavigator() {
  const { user, loading } = useAuth();
  if (loading) return null; // короткий момент восстановления сессии

  return (
    <Stack.Navigator>
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        </>
      ) : (
        <>
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
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="dark" />
          <AppNavigator />
        </NavigationContainer>
      </SubscriptionProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({});
