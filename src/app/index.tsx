import { Redirect } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

import { useAuthStore } from "@/lib/auth/store";

/** Boot gate at "/". Redirects based on session + facility selection. */
export default function Index() {
  const status = useAuthStore((s) => s.status);
  const activeFacilityId = useAuthStore((s) => s.activeFacilityId);

  if (status === "loading") {
    return (
      <View className="flex-1 items-center justify-center gap-5 bg-white">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brand">
          <Text className="text-2xl font-bold text-brand-foreground">W</Text>
        </View>
        <ActivityIndicator color="#FD006A" />
      </View>
    );
  }

  if (status === "anon") return <Redirect href="/login" />;
  if (!activeFacilityId) return <Redirect href="/select-facility" />;
  return <Redirect href="/home" />;
}
