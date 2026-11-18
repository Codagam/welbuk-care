/**
 * Small pieces shared by the patient-chart cards ported from Practice
 * (Family, Vaccines & wellness, Prescription history): a toast, a reason
 * dialog, a patient picker and choice chips.
 */
import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppModal, Button } from "@/ui";
import { useRealtimeToastStore } from "@/lib/realtime/toastStore";
import {
  listFacilityPatients,
  type FacilityPatientOption,
} from "@/lib/api/endpoints/family";

export const BRAND = "#FD006A";

export function showToast(
  title: string,
  tone: "success" | "error" | "info" = "success"
) {
  useRealtimeToastStore.getState().show({
    id: `chart-${Date.now()}`,
    title,
    tone,
  });
}

export function fieldInputClass(error?: boolean) {
  return `min-h-[48px] rounded-xl border bg-white px-3 text-base text-neutral-900 ${
    error ? "border-red-400" : "border-neutral-300"
  }`;
}

/** Centred dialog shell over a dimmed backdrop. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 520,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
}) {
  return (
    <AppModal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      androidSafeArea={false}
    >
      <Pressable
        onPress={onClose}
        className="flex-1 items-center justify-center bg-black/40 px-4"
      >
        <Pressable
          onPress={() => {}}
          style={{ width: "100%", maxWidth, maxHeight: "88%" }}
          className="overflow-hidden rounded-2xl bg-white"
        >
          <View className="flex-row items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-base font-semibold text-neutral-900">
                {title}
              </Text>
              {description ? (
                <Text className="text-sm text-neutral-500">{description}</Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20, gap: 16 }}
          >
            {children}
          </ScrollView>
          {footer ? (
            <View className="flex-row flex-wrap justify-end gap-2 border-t border-neutral-200 px-5 py-3">
              {footer}
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </AppModal>
  );
}

/** "Say why" before an irreversible-looking act (unlink, withdraw, delete). */
export function ReasonDialog(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
  placeholder?: string;
  pending?: boolean;
  minLength?: number;
  missingMessage?: string;
  onConfirm: (reason: string) => void;
}) {
  // Mounted only while open, so the reason starts empty every time.
  return props.open ? <ReasonDialogBody {...props} /> : null;
}

function ReasonDialogBody({
  onClose,
  title,
  description,
  confirmLabel,
  placeholder,
  pending,
  minLength = 3,
  missingMessage = "Say why.",
  onConfirm,
}: Parameters<typeof ReasonDialog>[0]) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button
            label="Cancel"
            variant="outline"
            size="md"
            onPress={onClose}
            disabled={pending}
          />
          <Button
            label={confirmLabel}
            variant="danger"
            size="md"
            loading={pending}
            onPress={() => {
              if (reason.trim().length < minLength) {
                setError(missingMessage);
                return;
              }
              onConfirm(reason.trim());
            }}
          />
        </>
      }
    >
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-neutral-700">
          Reason <Text className="text-red-500">*</Text>
        </Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          multiline
          style={{ minHeight: 84, textAlignVertical: "top" }}
          className={`rounded-xl border bg-white px-3 py-2 text-base text-neutral-900 ${
            error ? "border-red-400" : "border-neutral-300"
          }`}
        />
        {error ? <Text className="text-xs text-red-500">{error}</Text> : null}
      </View>
    </Dialog>
  );
}

/** Single-select pill row (Practice ToggleGroup). */
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  labels,
  disabled,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={o}
            disabled={disabled}
            onPress={() => onChange(o)}
            className={`min-h-[40px] items-center justify-center rounded-xl border px-4 ${
              active ? "border-brand bg-brand" : "border-neutral-300 bg-white"
            } ${disabled ? "opacity-50" : ""}`}
          >
            <Text
              className={`text-sm font-medium ${
                active ? "text-white" : "text-neutral-700"
              }`}
            >
              {labels?.[o] ?? o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function patientOptionName(p: FacilityPatientOption): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "Patient";
}

/** Search the facility's patients by name, phone or ID and pick one. */
export function PatientSearchList({
  facilityId,
  onSelect,
  excludeId,
}: {
  facilityId: string;
  onSelect: (p: FacilityPatientOption) => void;
  excludeId?: string;
}) {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<FacilityPatientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await listFacilityPatients({ facilityId, search });
        if (alive) setRows(list.filter((p) => p.id !== excludeId));
      } catch {
        if (alive) setError("Failed to load patients.");
      } finally {
        if (alive) setLoading(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [facilityId, search, excludeId]);

  return (
    <View className="gap-2">
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search patients…"
        placeholderTextColor="#9ca3af"
        autoCorrect={false}
        className={fieldInputClass()}
      />
      <View className="overflow-hidden rounded-xl border border-neutral-200">
        {loading ? (
          <View className="items-center py-4">
            <ActivityIndicator color={BRAND} />
          </View>
        ) : error ? (
          <Text className="px-3 py-4 text-sm text-red-500">{error}</Text>
        ) : rows.length === 0 ? (
          <Text className="px-3 py-4 text-center text-sm text-neutral-500">
            No patients found at this clinic.
          </Text>
        ) : (
          rows.map((p, i) => (
            <Pressable
              key={p.id}
              onPress={() => onSelect(p)}
              className={`min-h-[48px] justify-center px-3 py-2 active:bg-neutral-50 ${
                i < rows.length - 1 ? "border-b border-neutral-100" : ""
              }`}
            >
              <Text className="text-sm text-neutral-900">
                {patientOptionName(p)}
                {p.phone ? (
                  <Text className="text-neutral-500"> · {p.phone}</Text>
                ) : null}
                {p.patientId != null ? (
                  <Text className="text-neutral-400"> · #{p.patientId}</Text>
                ) : null}
              </Text>
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

export function EmptyNote({
  icon,
  title,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
}) {
  return (
    <View className="items-center gap-1.5 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6">
      <Ionicons name={icon} size={22} color="#9ca3af" />
      <Text className="text-sm font-medium text-neutral-700">{title}</Text>
      {description ? (
        <Text className="text-center text-xs text-neutral-500">
          {description}
        </Text>
      ) : null}
    </View>
  );
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
