import { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import DateTimePicker from "@expo/ui/community/datetime-picker";

import { AppModal } from "./AppModal";

export type TimeFieldProps = {
  label?: string;
  /** HH:mm */
  value: string;
  onChange: (hhmm: string) => void;
  disabled?: boolean;
  error?: string;
  containerClassName?: string;
  placeholder?: string;
};

function parseHHmm(v: string): Date {
  const t = (v ?? "").trim();
  const d = new Date();
  d.setSeconds(0, 0);
  if (/^\d{1,2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(":").map(Number);
    d.setHours(h, m, 0, 0);
    return d;
  }
  d.setHours(10, 0, 0, 0);
  return d;
}

function formatHHmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function TimeField({
  label,
  value,
  onChange,
  disabled = false,
  error,
  containerClassName = "",
  placeholder = "HH:mm",
}: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseHHmm(value), [value]);
  const display = value?.trim() || "";

  const handleValueChange = (_event: unknown, selected: Date) => {
    setOpen(false);
    if (selected) onChange(formatHHmm(selected));
  };

  return (
    <View className={`gap-1.5 ${containerClassName}`}>
      {label ? (
        <Text className="text-sm font-medium text-neutral-700">{label}</Text>
      ) : null}
      <Pressable
        disabled={disabled}
        onPress={() => {
          if (!disabled) setOpen(true);
        }}
        className={`rounded-xl border bg-white px-4 py-3 ${
          error ? "border-red-400" : "border-neutral-300"
        } ${disabled ? "opacity-50" : "active:bg-neutral-50"}`}
      >
        <Text
          className={`text-base ${
            display ? "text-neutral-900" : "text-neutral-400"
          }`}
        >
          {display || placeholder}
        </Text>
      </Pressable>
      {error ? <Text className="text-xs text-red-500">{error}</Text> : null}

      {open && Platform.OS === "android" ? (
        <DateTimePicker
          value={parsed}
          mode="time"
          presentation="dialog"
          is24Hour
          onValueChange={handleValueChange}
          onDismiss={() => setOpen(false)}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <AppModal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={() => setOpen(false)}
        >
          <Pressable
            className="flex-1 justify-end bg-black/40"
            onPress={() => setOpen(false)}
          >
            <Pressable
              className="rounded-t-2xl bg-white px-4 pb-8 pt-3"
              onPress={(e) => e.stopPropagation()}
            >
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-base font-semibold text-neutral-900">
                  {label ?? "Select time"}
                </Text>
                <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                  <Text className="text-sm font-semibold text-brand">Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={parsed}
                mode="time"
                display="spinner"
                is24Hour
                onValueChange={(_event, selected) => {
                  if (selected) onChange(formatHHmm(selected));
                }}
                style={{ alignSelf: "center" }}
              />
            </Pressable>
          </Pressable>
        </AppModal>
      ) : null}
    </View>
  );
}
