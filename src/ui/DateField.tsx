import { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { AppModal } from "./AppModal";

export type DateFieldProps = {
  label?: string;
  value: string;
  onChange: (ymd: string) => void;
  /** Minimum selectable date as YYYY-MM-DD */
  minimumDate?: string;
  /** Maximum selectable date as YYYY-MM-DD */
  maximumDate?: string;
  disabled?: boolean;
  error?: string;
  containerClassName?: string;
  placeholder?: string;
};

function parseYmd(ymd: string): Date {
  const s = (ymd ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12,
    0,
    0,
    0
  );
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Display as DD-MM-YYYY when value is YYYY-MM-DD. */
function formatDisplay(ymd: string): string {
  const s = (ymd ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}-${m}-${y}`;
  }
  return s;
}

export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  disabled = false,
  error,
  containerClassName = "",
  placeholder = "Select date",
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseYmd(value), [value]);
  const min = minimumDate ? parseYmd(minimumDate) : undefined;
  const max = maximumDate ? parseYmd(maximumDate) : undefined;
  const display = value?.trim() ? formatDisplay(value) : "";

  const handleValueChange = (_event: unknown, selected?: Date) => {
    setOpen(false);
    if (selected) onChange(formatYmd(selected));
  };

  const handleDismiss = () => setOpen(false);

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
          mode="date"
          display="default"
          minimumDate={min}
          maximumDate={max}
          onValueChange={handleValueChange}
          onDismiss={handleDismiss}
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
                  {label ?? "Select date"}
                </Text>
                <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                  <Text className="text-sm font-semibold text-brand">Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={parsed}
                mode="date"
                display="spinner"
                minimumDate={min}
                maximumDate={max}
                onValueChange={(_event, selected) => {
                  if (selected) onChange(formatYmd(selected));
                }}
                style={{
                  alignSelf: "center",
                  width: "100%",
                  maxWidth: 340,
                  height: 216,
                }}
              />
            </Pressable>
          </Pressable>
        </AppModal>
      ) : null}
    </View>
  );
}
