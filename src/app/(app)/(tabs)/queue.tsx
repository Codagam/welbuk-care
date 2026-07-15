import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Screen } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { userDisplayName } from "@/lib/auth/roles";
import { useActiveFacility, useAuthUser } from "@/lib/auth/store";
import { useOpenConsult, useTodayQueue } from "@/features/queue/hooks";
import { formatTime, statusStyle } from "@/features/queue/status";
import type { Appointment } from "@/features/queue/types";
import { fullName } from "@/features/patients/utils";

function doctorWelcomeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return /^dr\.?\s/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
}

export default function QueueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const facility = useActiveFacility();
  const user = useAuthUser();
  const q = useTodayQueue();
  const open = useOpenConsult();
  const [openingId, setOpeningId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle("dark");
    }, [])
  );

  const appointments = q.data?.data ?? [];
  const greetName = userDisplayName(user);
  const welcomeTitle = greetName
    ? `Welcome, ${doctorWelcomeName(greetName)}`
    : "Welcome";

  const onOpen = async (appt: Appointment) => {
    setOpeningId(appt.id);
    try {
      const consult = await open.mutateAsync(appt.id);
      router.push({
        pathname: "/consult/[id]",
        params: {
          id: consult.id,
          appointmentId: appt.id,
          patientId: appt.patient?.id ?? consult.patientId ?? "",
        },
      });
    } catch {
      // error surfaced by the row's disabled state resetting; keep it quiet
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <Screen edges={["left", "right", "bottom"]}>
      <View
        className="bg-brand px-6 pb-5"
        style={{ paddingTop: Math.max(insets.top, 12) + 12 }}
      >
        <View className="flex-row items-start justify-between gap-4">
          <View className="min-w-0 flex-1 gap-1">
            <Text
              className="text-2xl font-bold text-brand-foreground"
              numberOfLines={1}
            >
              {welcomeTitle}
            </Text>
            <Text className="text-sm text-white/90">
              Here is your appointment list for today.
            </Text>
          </View>

          {facility?.name ? (
            <View className="max-w-[42%] shrink-0 flex-row items-center justify-end gap-2 pt-1">
              <Ionicons name="business-outline" size={18} color="#FFFFFF" />
              <Text
                className="shrink text-right text-sm font-medium text-brand-foreground"
                numberOfLines={2}
              >
                {facility.name}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {q.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FD006A" />
        </View>
      ) : q.isError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-red-500">
            {describeError(q.error)}
          </Text>
        </View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => (
            <QueueRow
              appt={item}
              opening={openingId === item.id}
              onPress={() => onOpen(item)}
            />
          )}
          ListEmptyComponent={
            <Text className="mt-10 text-center text-sm text-neutral-500">
              No appointments today.
            </Text>
          }
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
        />
      )}
    </Screen>
  );
}

function QueueRow({
  appt,
  opening,
  onPress,
}: {
  appt: Appointment;
  opening: boolean;
  onPress: () => void;
}) {
  const s = statusStyle(appt.status);
  const time = formatTime(appt.startTime);
  const patientName = appt.patient ? fullName(appt.patient) : "Unknown patient";
  return (
    <Pressable
      onPress={onPress}
      disabled={opening}
      className="flex-row items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 active:bg-neutral-50"
    >
      <View className="w-16">
        <Text className="text-sm font-semibold text-neutral-700">
          {time || "—"}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-neutral-900">
          {patientName}
        </Text>
        <Text className="text-xs text-neutral-500">
          {[appt.doctor?.name, appt.reason].filter(Boolean).join(" · ") || "—"}
        </Text>
      </View>
      <View className={`rounded-full px-2.5 py-1 ${s.chip}`}>
        <Text className={`text-[11px] font-medium ${s.text}`}>{s.label}</Text>
      </View>
      {opening ? <ActivityIndicator size="small" color="#FD006A" /> : null}
    </Pressable>
  );
}
