import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { FieldLabel } from "@/ui/FieldLabel";

export type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

export function formatBytes(size?: number): string | null {
  if (typeof size !== "number" || size <= 0) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

type FileKind = "pdf" | "image" | "word" | "other";

function kindOf(mimeType: string): FileKind {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.includes("word")) return "word";
  return "other";
}

const KIND: Record<
  FileKind,
  {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    tile: string;
    label: string;
  }
> = {
  pdf: { icon: "document-text", color: "#DC2626", tile: "bg-red-50", label: "PDF" },
  image: { icon: "image", color: "#2563EB", tile: "bg-blue-50", label: "Image" },
  word: { icon: "document", color: "#1D4ED8", tile: "bg-indigo-50", label: "Word" },
  other: { icon: "document-outline", color: "#6B7280", tile: "bg-neutral-100", label: "File" },
};

/** Sheet title bar: icon tile, title + subtitle, close button. */
export function UploadSheetHeader({
  title,
  subtitle,
  icon = "cloud-upload-outline",
  onClose,
  disabled,
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onClose: () => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-3 border-b border-neutral-100 px-5 py-4">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
        <Ionicons name={icon} size={20} color="#FD006A" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-lg font-bold text-neutral-900">{title}</Text>
        {subtitle ? (
          <Text className="text-xs text-neutral-500" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={onClose}
        hitSlop={12}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Close"
        className="h-9 w-9 items-center justify-center rounded-full bg-neutral-100 active:bg-neutral-200"
      >
        <Ionicons name="close" size={20} color="#404040" />
      </Pressable>
    </View>
  );
}

/** Empty-state picker. Turns red when `error` is set. */
export function FileDropZone({
  title = "Tap to choose a file",
  hint,
  formats,
  onPress,
  disabled,
  error,
  compact,
}: {
  title?: string;
  hint: string;
  formats: string[];
  onPress: () => void;
  disabled?: boolean;
  error?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      className={`items-center rounded-2xl border-2 border-dashed px-4 ${
        compact ? "gap-1.5 py-5" : "gap-2 py-8"
      } ${
        error
          ? "border-red-300 bg-red-50/60"
          : "border-brand-200 bg-brand-50/40 active:bg-brand-50"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <View
        className={`items-center justify-center rounded-full ${
          compact ? "h-11 w-11" : "h-14 w-14"
        } ${error ? "bg-red-100" : "bg-white"}`}
      >
        <Ionicons
          name="cloud-upload-outline"
          size={compact ? 22 : 26}
          color={error ? "#DC2626" : "#FD006A"}
        />
      </View>
      <Text
        className={`text-sm font-semibold ${
          error ? "text-red-700" : "text-neutral-900"
        }`}
      >
        {title}
      </Text>
      <Text className="text-center text-xs text-neutral-500">{hint}</Text>
      <View className="mt-1 flex-row flex-wrap justify-center gap-1.5">
        {formats.map((f) => (
          <View
            key={f}
            className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5"
          >
            <Text className="text-[10px] font-semibold tracking-wide text-neutral-500">
              {f}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

/** A chosen file: type tile, name, size · type, and replace / remove actions. */
export function PickedFileRow({
  file,
  onReplace,
  onRemove,
  disabled,
}: {
  file: PickedFile;
  onReplace?: () => void;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  const kind = KIND[kindOf(file.mimeType)];
  const size = formatBytes(file.size);
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3">
      <View
        className={`h-11 w-11 items-center justify-center rounded-xl ${kind.tile}`}
      >
        <Ionicons name={kind.icon} size={22} color={kind.color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className="text-sm font-semibold text-neutral-900"
          numberOfLines={1}
        >
          {file.name}
        </Text>
        <View className="mt-0.5 flex-row items-center gap-1">
          <Ionicons name="checkmark-circle" size={12} color="#059669" />
          <Text className="text-xs text-neutral-500">
            {[size, kind.label].filter(Boolean).join(" · ")}
          </Text>
        </View>
      </View>
      {onReplace ? (
        <Pressable
          onPress={onReplace}
          disabled={disabled}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Replace ${file.name}`}
          className="rounded-lg px-2.5 py-1.5 active:bg-brand-50"
        >
          <Text className="text-xs font-semibold text-brand">Replace</Text>
        </Pressable>
      ) : null}
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          disabled={disabled}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${file.name}`}
          className="h-8 w-8 items-center justify-center rounded-full active:bg-neutral-100"
        >
          <Ionicons name="trash-outline" size={18} color="#9CA3AF" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Labelled form block with an inline error line. */
export function FormSection({
  label,
  required,
  optional,
  error,
  aside,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string | null;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <FieldLabel label={label} required={required} optional={optional} />
        {aside}
      </View>
      {children}
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

export function FieldError({ message }: { message: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <Ionicons name="alert-circle" size={13} color="#EF4444" />
      <Text className="text-xs text-red-500">{message}</Text>
    </View>
  );
}

/** Request-level failure shown above the footer. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <View className="flex-row items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
      <Ionicons name="alert-circle" size={18} color="#DC2626" />
      <Text className="min-w-0 flex-1 text-sm text-red-800">{message}</Text>
    </View>
  );
}

/** Sticky footer: required-field legend + Cancel / primary action. */
export function UploadSheetFooter({
  primaryLabel,
  busyLabel = "Uploading…",
  onPrimary,
  onCancel,
  busy,
  primaryDisabled,
  showRequiredHint,
  icon = "cloud-upload-outline",
}: {
  primaryLabel: string;
  busyLabel?: string;
  onPrimary: () => void;
  onCancel: () => void;
  busy: boolean;
  primaryDisabled?: boolean;
  showRequiredHint?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const disabled = busy || primaryDisabled;
  return (
    <View className="gap-2.5 border-t border-neutral-100 bg-white px-5 pb-4 pt-3">
      {showRequiredHint ? (
        <Text className="text-xs text-neutral-400">
          Fields marked <Text className="text-red-500">*</Text> are required
        </Text>
      ) : null}
      <View className="flex-row gap-3">
        <Pressable
          onPress={onCancel}
          disabled={busy}
          accessibilityRole="button"
          className={`h-12 flex-1 items-center justify-center rounded-xl border border-neutral-200 bg-white active:bg-neutral-50 ${
            busy ? "opacity-50" : ""
          }`}
        >
          <Text className="text-base font-semibold text-neutral-800">
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={onPrimary}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!disabled, busy }}
          className={`h-12 flex-[1.4] flex-row items-center justify-center gap-2 rounded-xl bg-brand active:bg-brand-600 ${
            disabled && !busy ? "opacity-40" : ""
          }`}
        >
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name={icon} size={18} color="#fff" />
          )}
          <Text className="text-base font-semibold text-white" numberOfLines={1}>
            {busy ? busyLabel : primaryLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
