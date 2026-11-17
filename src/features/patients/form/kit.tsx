import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppModal } from "@/ui/AppModal";
import { FieldLabel } from "@/ui/FieldLabel";

/**
 * Dropdown: a field-shaped button that opens a list of options.
 * Same pattern as the consult orders `SelectButton` + `OptionSheet`.
 */
export function SelectField<T extends string>({
  label,
  required,
  placeholder = "Select",
  options,
  value,
  onChange,
  disabled = false,
  allowClear = false,
  error,
}: {
  label?: string;
  required?: boolean;
  placeholder?: string;
  options: readonly { value: T; label: string }[];
  value: T | "" | null | undefined;
  onChange: (value: T | "") => void;
  disabled?: boolean;
  /** Adds a "None" row that clears the value. */
  allowClear?: boolean;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const close = () => setOpen(false);

  return (
    <View className="gap-1.5">
      {label ? <FieldLabel label={label} required={required} /> : null}
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        className={`h-12 flex-row items-center justify-between gap-2 rounded-xl border bg-white px-4 ${
          error ? "border-red-400" : "border-neutral-300"
        } ${disabled ? "opacity-50" : "active:bg-neutral-50"}`}
      >
        <Text
          numberOfLines={1}
          className={`min-w-0 flex-1 text-base ${
            selected ? "text-neutral-900" : "text-neutral-400"
          }`}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#6b7280" />
      </Pressable>
      {error ? <Text className="text-xs text-red-500">{error}</Text> : null}

      <AppModal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
        androidSafeArea={false}
      >
        <Pressable
          onPress={close}
          className="flex-1 items-center justify-center bg-black/40 px-4"
        >
          <Pressable
            onPress={() => {}}
            style={{ width: "100%", maxWidth: 420, maxHeight: "75%" }}
            className="overflow-hidden rounded-2xl bg-white"
          >
            <View className="flex-row items-center justify-between border-b border-neutral-200 px-4 py-3">
              <Text className="text-base font-semibold text-neutral-900">
                {label ?? placeholder}
              </Text>
              <Pressable onPress={close} hitSlop={12} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color="#6b7280" />
              </Pressable>
            </View>
            <ScrollView>
              {allowClear ? (
                <Pressable
                  onPress={() => {
                    close();
                    onChange("");
                  }}
                  className="min-h-[52px] justify-center border-b border-neutral-100 px-4 active:bg-neutral-50"
                >
                  <Text className="text-base text-neutral-500">None</Text>
                </Pressable>
              ) : null}
              {options.map((o) => {
                const active = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => {
                      close();
                      if (!active) onChange(o.value);
                    }}
                    className={`min-h-[52px] flex-row items-center justify-between border-b border-neutral-100 px-4 ${
                      active ? "bg-brand/5" : "active:bg-neutral-50"
                    }`}
                  >
                    <Text className="text-base text-neutral-900">{o.label}</Text>
                    {active ? (
                      <Ionicons name="checkmark" size={20} color="#FD006A" />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </AppModal>
    </View>
  );
}

/** A titled card — one section of the registration screen. */
export function FormCard({
  title,
  description,
  icon,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
  className?: string;
}) {
  return (
    <View
      className={`gap-4 rounded-2xl border border-neutral-200 bg-white p-5 ${className}`}
    >
      <View className="gap-1">
        <View className="flex-row items-center gap-2">
          {icon ? <Ionicons name={icon} size={18} color="#FD006A" /> : null}
          <Text className="text-base font-semibold text-neutral-900">{title}</Text>
        </View>
        {description ? (
          <Text className="text-xs leading-5 text-neutral-500">{description}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Wrapping single-select chips — used where a dropdown would hide the options. */
export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  allowClear = false,
}: {
  label?: string;
  options: readonly { value: T; label: string }[];
  value: T | "" | null | undefined;
  onChange: (value: T | "") => void;
  disabled?: boolean;
  allowClear?: boolean;
}) {
  return (
    <View className="gap-1.5">
      {label ? (
        <Text className="text-sm font-medium text-neutral-700">{label}</Text>
      ) : null}
      <View className={`flex-row flex-wrap gap-2 ${disabled ? "opacity-50" : ""}`}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(active && allowClear ? "" : opt.value)}
              className={`min-w-[52px] items-center rounded-xl border px-3.5 py-2.5 ${
                active
                  ? "border-brand bg-brand"
                  : "border-neutral-300 bg-white active:bg-neutral-50"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  active ? "text-brand-foreground" : "text-neutral-700"
                }`}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A small rounded label. */
export function Tag({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "amber" | "green";
}) {
  const box =
    tone === "amber"
      ? "bg-amber-100"
      : tone === "green"
        ? "bg-emerald-50"
        : "bg-neutral-100";
  const text =
    tone === "amber"
      ? "text-amber-800"
      : tone === "green"
        ? "text-emerald-700"
        : "text-neutral-600";
  return (
    <View className={`rounded-full px-2 py-0.5 ${box}`}>
      <Text className={`text-[10px] font-medium ${text}`}>{label}</Text>
    </View>
  );
}
