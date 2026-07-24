import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "@/ui";
import { timeOfDayGreeting, userDisplayName } from "@/lib/auth/roles";
import {
  useActiveFacility,
  useAuthStore,
  useAuthUser,
} from "@/lib/auth/store";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function MenuRow({
  icon,
  label,
  subtitle,
  onPress,
  destructive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center gap-3 px-4 py-3.5 active:bg-neutral-50"
    >
      <View
        className={`h-10 w-10 items-center justify-center rounded-full ${
          destructive ? "bg-red-50" : "bg-neutral-100"
        }`}
      >
        <Ionicons
          name={icon}
          size={20}
          color={destructive ? "#dc2626" : "#374151"}
        />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className={`text-base font-medium ${
            destructive ? "text-red-600" : "text-neutral-900"
          }`}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-xs text-neutral-500" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
    </Pressable>
  );
}

export default function MoreScreen() {
  const router = useRouter();
  const facility = useActiveFacility();
  const user = useAuthUser();
  const signOut = useAuthStore((s) => s.signOut);
  const greetName = userDisplayName(user);
  const roleLabel =
    user?.roleLabels?.[0] ||
    user?.globalRole ||
    user?.role ||
    null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mx-auto w-full max-w-3xl gap-5 p-5">
          <View className="gap-1">
            <Text className="text-sm text-neutral-500">
              {greetName
                ? `${timeOfDayGreeting()}, ${greetName}`
                : "Signed in"}
            </Text>
            <Text className="text-2xl font-bold text-neutral-900">More</Text>
          </View>

          <View className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <View className="flex-row items-center gap-3 px-4 py-4">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-brand/10">
                <Text className="text-lg font-bold text-brand">
                  {initialsFromName(greetName || "U")}
                </Text>
              </View>
              <View className="min-w-0 flex-1 gap-0.5">
                <Text
                  className="text-base font-semibold text-neutral-900"
                  numberOfLines={1}
                >
                  {greetName || "Account"}
                </Text>
                {user?.email ? (
                  <Text
                    className="text-sm text-neutral-500"
                    numberOfLines={1}
                  >
                    {user.email}
                  </Text>
                ) : null}
                {roleLabel ? (
                  <Text className="text-xs font-medium uppercase tracking-wide text-brand">
                    {String(roleLabel).replace(/_/g, " ")}
                  </Text>
                ) : null}
              </View>
            </View>

            {facility ? (
              <>
                <View className="mx-4 h-px bg-neutral-100" />
                <View className="flex-row items-start gap-3 px-4 py-3.5">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-neutral-100">
                    <Ionicons
                      name="business-outline"
                      size={20}
                      color="#374151"
                    />
                  </View>
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                      Active facility
                    </Text>
                    <Text
                      className="text-sm font-semibold text-neutral-900"
                      numberOfLines={2}
                    >
                      {facility.name}
                    </Text>
                    {facility.consultationType ? (
                      <Text className="text-xs capitalize text-neutral-500">
                        {facility.consultationType} practice
                      </Text>
                    ) : null}
                  </View>
                </View>
              </>
            ) : null}
          </View>

          <View className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <MenuRow
              icon="swap-horizontal-outline"
              label="Switch facility"
              subtitle={facility?.name}
              onPress={() => router.replace("/select-facility")}
            />
            <View className="mx-4 h-px bg-neutral-100" />
            <MenuRow
              icon="log-out-outline"
              label="Sign out"
              destructive
              onPress={() => signOut()}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
