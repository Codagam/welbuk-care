import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { OfflineBanner } from "@/ui/OfflineBanner";
import { RealtimeToastHost } from "@/ui/RealtimeToast";
import { useAuthStore } from "@/lib/auth/store";
import { useRealtime } from "@/lib/realtime/useRealtime";

/**
 * Guard for the authenticated area. Requires a session + a selected facility,
 * runs the realtime query-invalidation stream, and shows the offline banner.
 */
export default function AppLayout() {
  const status = useAuthStore((s) => s.status);
  const activeFacilityId = useAuthStore((s) => s.activeFacilityId);

  // Safe to call before the guards below — it no-ops until a facility is set.
  useRealtime();

  if (status === "loading") {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#FD006A" />
      </View>
    );
  }
  if (status === "anon") return <Redirect href="/login" />;
  if (!activeFacilityId) return <Redirect href="/select-facility" />;

  return (
    <View className="flex-1">
      <OfflineBanner />
      <View className="flex-1">
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      <RealtimeToastHost />
    </View>
  );
}
