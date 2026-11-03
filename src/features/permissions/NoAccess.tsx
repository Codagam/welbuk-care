import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

/**
 * Quiet "this section isn't for your role" state — Practice `NoAccess`.
 * Never render while permissions are still loading.
 */
export function NoAccess({
  sectionLabel,
  description = "Ask a facility administrator if you need access.",
}: {
  sectionLabel: string;
  description?: string;
}) {
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center px-6 py-10">
      <View className="max-w-sm items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-neutral-100">
          <Ionicons name="lock-closed-outline" size={20} color="#6b7280" />
        </View>
        <Text className="text-center text-base font-semibold text-neutral-900">
          You don't have permission
        </Text>
        <Text className="text-center text-sm text-neutral-500">
          {sectionLabel} isn't available for your role. {description}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to queue"
          onPress={() => router.replace("/(app)/(tabs)/queue")}
          className="mt-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 active:bg-neutral-50"
        >
          <Text className="text-sm font-semibold text-neutral-800">
            Back to queue
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function SectionAccessLoading({ label }: { label: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-6">
      <ActivityIndicator color="#FD006A" />
      <Text className="text-sm text-neutral-500">Loading {label}…</Text>
    </View>
  );
}
