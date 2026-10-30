import { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { create } from "zustand";

import { useRealtimeToastStore } from "@/lib/realtime/toastStore";

export type AppAlertButton = {
  text?: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

/**
 * Visual intent of the dialog. Inferred from the title / buttons when omitted:
 * destructive button → `danger`, "failed / could not" → `error`,
 * cancel + action → `confirm`, otherwise `info`.
 */
export type AppAlertTone =
  "info" | "success" | "warning" | "error" | "danger" | "confirm";

export type AppAlertOptions = {
  tone?: AppAlertTone;
  /** Override the header icon (e.g. `log-out-outline` for sign out). */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Back button / backdrop tap closes the dialog. Default: true. */
  cancelable?: boolean;
  /**
   * Set when the caller closes a sheet/modal in the same tick — iOS drops a
   * modal presented while another is still dismissing, so we wait for it.
   */
  afterDismiss?: boolean;
};

type AlertRequest = {
  id: number;
  title: string;
  message?: string;
  buttons: AppAlertButton[];
  tone: AppAlertTone;
  icon: keyof typeof Ionicons.glyphMap;
  cancelable: boolean;
  delayMs: number;
};

type AlertQueueState = {
  queue: AlertRequest[];
  push: (req: AlertRequest) => void;
  shift: () => void;
};

const useAlertQueue = create<AlertQueueState>((set) => ({
  queue: [],
  push: (req) => set((s) => ({ queue: [...s.queue, req] })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
}));

const ERROR_RE = /\b(fail(ed|ure)?|could ?n[o']t|cannot|can't|unable|error)\b/i;
const WARNING_RE =
  /\b(permission|unavailable|required|select a|already|warning)\b/i;
const SUCCESS_RE = /\b(success(fully)?|completed|uploaded|saved|added|done)\b/i;

function inferTone(title: string, buttons: AppAlertButton[]): AppAlertTone {
  if (buttons.some((b) => b.style === "destructive")) return "danger";
  if (ERROR_RE.test(title)) return "error";
  if (buttons.length > 1) return "confirm";
  if (WARNING_RE.test(title)) return "warning";
  if (SUCCESS_RE.test(title)) return "success";
  return "info";
}

const REMOVE_RE = /(delete|remove|discard|clear)/i;

function inferIcon(
  tone: AppAlertTone,
  buttons: AppAlertButton[],
): keyof typeof Ionicons.glyphMap {
  if (tone === "danger") {
    const destructive = buttons.find((b) => b.style === "destructive");
    return REMOVE_RE.test(destructive?.text ?? "") ? "trash" : "alert-circle";
  }
  return TONE[tone].icon;
}

let nextId = 1;

function showToast(
  tone: "success" | "info" | "warning" | "error",
  title: string,
  message?: string,
) {
  useRealtimeToastStore.getState().show({
    id: `app-${tone}-${Date.now()}`,
    title,
    body: message,
    tone,
  });
}

/**
 * Drop-in replacement for React Native's `Alert` with the Welbuk look.
 *
 * - `alert()` — blocking dialog (confirmations, errors, anything that needs a
 *   decision). Same signature as `Alert.alert`.
 * - `success()` / `notice()` — non-blocking toast for "it worked" feedback.
 *   Prefer this over a dialog when there is nothing to decide.
 */
export const AppAlert = {
  alert(
    title: string,
    message?: string,
    buttons?: AppAlertButton[],
    options?: AppAlertOptions,
  ) {
    const list = buttons?.length ? buttons : [{ text: "OK" }];
    const tone = options?.tone ?? inferTone(title, list);
    useAlertQueue.getState().push({
      id: nextId++,
      title,
      message,
      buttons: list,
      tone,
      icon: options?.icon ?? inferIcon(tone, list),
      cancelable: options?.cancelable ?? true,
      delayMs: options?.afterDismiss && Platform.OS === "ios" ? 350 : 0,
    });
  },
  success(title: string, message?: string) {
    showToast("success", title, message);
  },
  notice(title: string, message?: string) {
    showToast("info", title, message);
  },
  warn(title: string, message?: string) {
    showToast("warning", title, message);
  },
};

const TONE: Record<
  AppAlertTone,
  {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    halo: string;
    ring: string;
    primaryBg: string;
  }
> = {
  info: {
    icon: "information-circle",
    color: "#FD006A",
    halo: "bg-brand-50",
    ring: "border-brand-100",
    primaryBg: "bg-brand active:bg-brand-600",
  },
  confirm: {
    icon: "help-circle",
    color: "#FD006A",
    halo: "bg-brand-50",
    ring: "border-brand-100",
    primaryBg: "bg-brand active:bg-brand-600",
  },
  success: {
    icon: "checkmark-circle",
    color: "#059669",
    halo: "bg-emerald-50",
    ring: "border-emerald-100",
    primaryBg: "bg-emerald-600 active:bg-emerald-700",
  },
  warning: {
    icon: "warning",
    color: "#D97706",
    halo: "bg-amber-50",
    ring: "border-amber-100",
    primaryBg: "bg-brand active:bg-brand-600",
  },
  error: {
    icon: "close-circle",
    color: "#DC2626",
    halo: "bg-red-50",
    ring: "border-red-100",
    primaryBg: "bg-neutral-900 active:bg-neutral-800",
  },
  danger: {
    icon: "alert-circle",
    color: "#DC2626",
    halo: "bg-red-50",
    ring: "border-red-100",
    primaryBg: "bg-red-600 active:bg-red-700",
  },
};

/** Wait for the fade-out before running the button callback (iOS drops a
 *  modal presented while another one is still dismissing). */
const CLOSE_DELAY_MS = 220;

function DialogButton({
  button,
  tone,
  onPress,
  grow,
}: {
  button: AppAlertButton;
  tone: AppAlertTone;
  onPress: () => void;
  grow: boolean;
}) {
  const isCancel = button.style === "cancel";
  const isDestructive = button.style === "destructive";
  const container = isCancel
    ? "border border-neutral-200 bg-white active:bg-neutral-50"
    : isDestructive
      ? "bg-red-600 active:bg-red-700"
      : TONE[tone].primaryBg;
  const label = isCancel ? "text-neutral-800" : "text-white";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`h-12 items-center justify-center rounded-xl px-4 ${container} ${
        grow ? "flex-1" : ""
      }`}
    >
      <Text numberOfLines={1} className={`text-base font-semibold ${label}`}>
        {button.text ?? "OK"}
      </Text>
    </Pressable>
  );
}

/** Mount once near the root. Renders queued `AppAlert.alert` dialogs. */
export function AppAlertHost() {
  const current = useAlertQueue((s) => s.queue[0]);
  const shift = useAlertQueue((s) => s.shift);
  // Visibility is derived per alert id so queued dialogs never reuse state.
  const [closingId, setClosingId] = useState<number | null>(null);
  const [readyId, setReadyId] = useState<number | null>(null);

  useEffect(() => {
    if (!current?.delayMs) return;
    const t = setTimeout(() => setReadyId(current.id), current.delayMs);
    return () => clearTimeout(t);
  }, [current]);

  if (!current) return null;

  const visible =
    closingId !== current.id && (!current.delayMs || readyId === current.id);

  const tone = TONE[current.tone];
  // Primary action last so it sits on the right / bottom.
  const buttons = [
    ...current.buttons.filter((b) => b.style === "cancel"),
    ...current.buttons.filter((b) => b.style !== "cancel"),
  ];
  const stacked =
    buttons.length > 2 || buttons.some((b) => (b.text ?? "").length > 16);
  const cancelButton = current.buttons.find((b) => b.style === "cancel");
  const dismissible =
    current.cancelable && (cancelButton != null || buttons.length === 1);

  const close = (button?: AppAlertButton) => {
    if (closingId === current.id) return;
    setClosingId(current.id);
    setTimeout(() => {
      shift();
      button?.onPress?.();
    }, CLOSE_DELAY_MS);
  };

  const onBackdrop = () => {
    if (!dismissible) return;
    // A lone "OK" is acknowledged by dismissing, so it runs its callback too.
    close(cancelButton ?? buttons[0]);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onBackdrop}
    >
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          className="absolute inset-0"
          onPress={onBackdrop}
        />
        <Animated.View
          key={current.id}
          entering={ZoomIn.duration(180)}
          className="w-full max-w-sm overflow-hidden rounded-3xl bg-white"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.18,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 12 },
            elevation: 12,
          }}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <View className="items-center px-6 pb-5 pt-7">
            <Animated.View
              entering={FadeIn.delay(80).duration(200)}
              className={`mb-4 h-16 w-16 items-center justify-center rounded-full border-8 ${tone.halo} ${tone.ring}`}
            >
              <Ionicons name={current.icon} size={28} color={tone.color} />
            </Animated.View>
            <Text className="text-center text-lg font-bold text-neutral-900">
              {current.title}
            </Text>
            {current.message ? (
              <ScrollView
                style={{ maxHeight: 260 }}
                className="mt-2 w-full"
                contentContainerStyle={{ alignItems: "center" }}
              >
                <Text className="text-center text-sm leading-5 text-neutral-600">
                  {current.message}
                </Text>
              </ScrollView>
            ) : null}
          </View>
          <View
            className={`border-t border-neutral-100 bg-neutral-50/60 px-5 py-4 ${
              stacked ? "flex-col-reverse gap-2" : "flex-row gap-3"
            }`}
          >
            {buttons.map((b, i) => (
              <DialogButton
                key={`${b.text ?? "ok"}-${i}`}
                button={b}
                tone={current.tone}
                grow={!stacked}
                onPress={() => close(b)}
              />
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
