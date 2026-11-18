import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuthStore } from "@/lib/auth/store";

/** Boot gate at "/". Redirects based on session + facility selection. */
export default function Index() {
  const status = useAuthStore((s) => s.status);
  const activeFacilityId = useAuthStore((s) => s.activeFacilityId);

  // Normally hidden behind AnimatedSplash; brand fill so no second logo shows.
  if (status === "loading") {
    return (
      <View className="flex-1 items-center justify-center bg-brand">
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  if (status === "anon") return <Redirect href="/login" />;
  if (!activeFacilityId) return <Redirect href="/select-facility" />;
  return <Redirect href="/queue" />;
}
