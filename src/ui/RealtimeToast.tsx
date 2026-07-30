import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import {
  useRealtimeToastStore,
} from "@/lib/realtime/toastStore";
import type {
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

/** In-app realtime banner — no push required; shows while Care is open. */
export function RealtimeToastHost() {
  const insets = useSafeAreaInsets();
  const current = useRealtimeToastStore((s) => s.current);
  const dismiss = useRealtimeToastStore((s) => s.dismiss);

  if (!current) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: Math.max(insets.top, 8) + 4,
        left: 0,
        right: 0,
        zIndex: 100,
      }}
    >
      <ToastCard toast={current} onDismiss={dismiss} />
    </View>
  );
}
