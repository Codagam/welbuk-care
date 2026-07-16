import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

const BRAND = "#FD006A";
const WHITE = "#FFFFFF";

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      initialRouteName="queue"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: WHITE,
        tabBarInactiveTintColor: "rgba(255,255,255,0.7)",
        tabBarStyle: {
          backgroundColor: BRAND,
          borderTopWidth: 0,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="queue"
        options={{
          title: t("nav.queue"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="patients"
        options={{
          title: t("nav.patients"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="care"
        options={{
          title: t("nav.care"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pulse-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: t("nav.more"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
