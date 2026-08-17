import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import {
  useRealtimeToastStore,
} from "@/lib/realtime/toastStore";
import type {
  IpdPageAlarm,
  RealtimeToast,
  RealtimeToastTone,
} from "@/lib/realtime/events";

const TONE: Record<
  RealtimeToastTone,
  { bg: string; border: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  info: {
    bg: "bg-white",
    border: "border-brand/30",
    icon: "notifications-outline",
  },
  success: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: "checkmark-circle-outline",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: "alert-circle-outline",
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: "close-circle-outline",
  },
};

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: RealtimeToast;
  onDismiss: () => void;
}) {
  const tone = TONE[toast.tone] ?? TONE.info;
  return (
    <Pressable
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel={`${toast.title}. ${toast.body ?? ""}`}
      className={`mx-4 flex-row items-start gap-3 rounded-2xl border px-3.5 py-3 shadow-sm ${tone.bg} ${tone.border}`}
    >
      <Ionicons name={tone.icon} size={20} color="#FD006A" />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-sm font-semibold text-neutral-900">
          {toast.title}
        </Text>
        {toast.body ? (
          <Text className="text-xs text-neutral-600" numberOfLines={2}>
            {toast.body}
          </Text>
        ) : null}
      </View>
      <Ionicons name="close" size={16} color="#a3a3a3" />
    </Pressable>
  );
}

function PageAlarmCard({
  alarm,
  onDismiss,
}: {
  alarm: IpdPageAlarm;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const urgent = alarm.urgent;
  return (
    <View
      className={`mx-4 flex-row items-start gap-3 rounded-2xl border-l-4 p-3 shadow-lg ${
        urgent
          ? "border-l-red-600 bg-red-50"
          : "border-l-brand bg-brand/10"
      }`}
    >
      <Ionicons
        name="notifications"
        size={20}
        color={urgent ? "#DC2626" : "#FD006A"}
      />
      <Pressable
        className="min-w-0 flex-1"
        onPress={() => {
          onDismiss();
          if (alarm.admissionId) {
            router.push({
              pathname: "/inpatient/[id]",
              params: { id: alarm.admissionId },
            });
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={`${alarm.title}. ${alarm.room} ${alarm.patientName}`}
      >
        <Text className="text-sm font-semibold text-neutral-900">
          {alarm.title}
        </Text>
        <Text className="mt-0.5 text-sm text-neutral-800">
          {alarm.room ? (
            <Text className="font-bold">{alarm.room}</Text>
          ) : null}
          {alarm.room ? " · " : ""}
          {alarm.patientName}
        </Text>
        {alarm.detail ? (
          <Text className="mt-0.5 text-xs text-neutral-500">{alarm.detail}</Text>
        ) : null}
      </Pressable>
      <Pressable
        onPress={onDismiss}
        hitSlop={8}
        accessibilityLabel="Dismiss"
        className="rounded p-1"
      >
        <Ionicons name="close" size={16} color="#737373" />
      </Pressable>
    </View>
  );
}

/** In-app realtime banner — sticky IPD pages sit above auto-dismiss toasts. */
export function RealtimeToastHost() {
  const insets = useSafeAreaInsets();
  const current = useRealtimeToastStore((s) => s.current);
  const alarms = useRealtimeToastStore((s) => s.alarms);
  const dismiss = useRealtimeToastStore((s) => s.dismiss);
  const dismissAlarm = useRealtimeToastStore((s) => s.dismissAlarm);

  if (!current && alarms.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: Math.max(insets.top, 8) + 4,
        left: 0,
        right: 0,
        zIndex: 100,
        gap: 8,
      }}
    >
      {alarms.map((alarm) => (
        <PageAlarmCard
          key={alarm.id}
          alarm={alarm}
          onDismiss={() => dismissAlarm(alarm.id)}
        />
      ))}
      {current ? <ToastCard toast={current} onDismiss={dismiss} /> : null}
    </View>
  );
}
