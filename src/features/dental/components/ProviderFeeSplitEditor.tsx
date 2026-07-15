import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";

import { getFacilityDoctors } from "@/lib/api/endpoints/dental";
import type { TreatmentProvider } from "../types";
import { normalizeFee } from "../utils";

type Props = {
  facilityId?: string;
  value: TreatmentProvider[];
  onChange: (next: TreatmentProvider[]) => void;
  disabled?: boolean;
  /** Consulting doctor Mongo id — seeds first row when list is empty. */
  defaultDoctorId?: string;
  /** Suggested treatment fee sum shown alongside provider total. */
  additionalFeeTotal?: number;
  showTotal?: boolean;
  /** Hide the inner "Provider fee split" heading (parent already labels it). */
  hideTitle?: boolean;
  /** Hide "+ Add provider" (e.g. linked finding follows diagnosis providers). */
  hideAddProvider?: boolean;
};

const ROLES = ["Primary", "Assisting", "Consulting"] as const;

/**
 * Mirrors Practice provider-fee-split-editor.tsx.
 * Changing doctor must NOT reset fee (only doctorId updates).
 */
export function ProviderFeeSplitEditor({
  facilityId,
  value,
  onChange,
  disabled = false,
  defaultDoctorId,
  additionalFeeTotal = 0,
  showTotal = true,
  hideTitle = false,
  hideAddProvider = false,
}: Props) {
  const [doctorPickerOpen, setDoctorPickerOpen] = useState<number | null>(null);
  const [rolePickerOpen, setRolePickerOpen] = useState<number | null>(null);
  const defaultSeededRef = useRef(false);
  const doctorAutoFilledRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const doctorsQuery = useQuery({
    queryKey: ["facility-doctors", facilityId],
    enabled: !!facilityId,
    staleTime: 5 * 60_000,
    queryFn: () => getFacilityDoctors(facilityId!),
  });

  const doctors = doctorsQuery.data ?? [];
  const doctorsLoading = doctorsQuery.isLoading;

  const findDoctor = useCallback(
    (stored: string) => {
      const s = String(stored ?? "").trim();
      if (!s) return undefined;
      const byMongo = doctors.find((d) => d.id === s);
      if (byMongo) return byMongo;
      return doctors.find(
        (d) => d.doctorId != null && String(d.doctorId) === s
      );
    },
    [doctors]
  );

  const resolveDefaultDoctor = useCallback(() => {
    const raw = String(defaultDoctorId ?? "").trim();
    if (raw) {
      const match =
        doctors.find((d) => d.id === raw) ??
        doctors.find((d) => d.doctorId != null && String(d.doctorId) === raw);
      if (match) return match;
    }
    return doctors.find((d) => d.isDefault) ?? doctors[0] ?? undefined;
  }, [doctors, defaultDoctorId]);

  useEffect(() => {
    if (value.length > 0) defaultSeededRef.current = true;
  }, [value.length]);

  useEffect(() => {
    if (disabled || !facilityId || doctorsLoading || doctors.length === 0)
      return;
    if (defaultSeededRef.current) return;
    if (value.length > 0) return;
    const match = resolveDefaultDoctor();
    if (!match) return;
    defaultSeededRef.current = true;
    doctorAutoFilledRef.current = true;
    onChangeRef.current([{ doctorId: match.id, role: "Primary", fee: 0 }]);
  }, [
    disabled,
    facilityId,
    doctorsLoading,
    doctors,
    resolveDefaultDoctor,
    value.length,
  ]);

  // Rematch empty/unknown ids (e.g. staff user id) → appointed doctor with name
  useEffect(() => {
    if (disabled || !facilityId || doctorsLoading || doctors.length === 0)
      return;
    if (value.length === 0) return;
    const first = value[0];
    const stored = String(first?.doctorId ?? "").trim();
    const picked = stored ? findDoctor(stored) : undefined;
    if (picked) {
      doctorAutoFilledRef.current = true;
      if (picked.id !== stored) {
        onChangeRef.current(
          value.map((p, i) => (i === 0 ? { ...p, doctorId: picked.id } : p))
        );
      }
      return;
    }
    const match = resolveDefaultDoctor();
    if (!match || stored === match.id) {
      if (match) doctorAutoFilledRef.current = true;
      return;
    }
    doctorAutoFilledRef.current = true;
    onChangeRef.current(
      value.map((p, i) => (i === 0 ? { ...p, doctorId: match.id } : p))
    );
  }, [
    disabled,
    facilityId,
    doctorsLoading,
    doctors,
    value,
    findDoctor,
    resolveDefaultDoctor,
  ]);

  useEffect(() => {
    if (value.length === 0) {
      doctorAutoFilledRef.current = false;
      defaultSeededRef.current = false;
    }
  }, [value.length]);

  const addProvider = () => {
    const firstId = doctors[0]?.id ?? "";
    const isFirstRow = value.length === 0;
    onChange([
      ...value,
      isFirstRow
        ? { doctorId: firstId, role: "Primary", fee: 0 }
        : { doctorId: "", role: "", fee: 0 },
    ]);
  };

  const updateRow = (index: number, patch: Partial<TreatmentProvider>) => {
    onChange(value.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const removeRow = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const providerTotal = value.reduce(
    (s, p) => s + normalizeFee(Number(p.fee) || 0),
    0
  );
  const externalTotal = normalizeFee(Number(additionalFeeTotal) || 0);
  const total = normalizeFee(providerTotal + externalTotal);

  const doctorIdsTakenByOtherRows = (i: number) => {
    const set = new Set<string>();
    value.forEach((other, j) => {
      if (j === i) return;
      const raw = String(other.doctorId ?? "").trim();
      if (!raw) return;
      const picked = findDoctor(raw);
      set.add(picked?.id ?? raw);
    });
    return set;
  };

  const hasIncompleteRow = value.some((p) => {
    const doctorValid = String(p.doctorId ?? "").trim() !== "";
    const roleValid = String(p.role ?? "").trim() !== "";
    const feeValid = Number.isFinite(Number(p.fee)) && Number(p.fee) >= 0;
    return !doctorValid || !roleValid || !feeValid;
  });

  return (
    <View className="gap-2">
      {!hideTitle || !hideAddProvider ? (
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          {!hideTitle ? (
            <Text className="text-sm font-medium text-neutral-900">
              Provider fee split
            </Text>
          ) : (
            <View />
          )}
          {!hideAddProvider ? (
            <Pressable
              disabled={disabled || !facilityId || hasIncompleteRow}
              onPress={addProvider}
              className={`flex-row items-center gap-1 px-2 py-1 ${
                disabled || !facilityId || hasIncompleteRow ? "opacity-40" : ""
              }`}
            >
              <Text className="text-xs font-medium text-brand">
                + Add provider
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {doctorsLoading && doctors.length === 0 ? (
        <View className="flex-row items-center gap-2 py-2">
          <ActivityIndicator size="small" color="#FD006A" />
          <Text className="text-xs text-neutral-500">Loading doctors…</Text>
        </View>
      ) : null}

      {value.length === 0 ? (
        <Text className="text-xs text-neutral-500">
          No providers yet. Tap &quot;Add provider&quot; to assign doctors to
          this condition.
        </Text>
      ) : (
        <View className="gap-2">
          <View className="flex-row gap-2 px-0.5">
            <Text className="flex-1 text-[11px] text-neutral-400">Doctor</Text>
            <Text className="w-24 text-[11px] text-neutral-400">Role</Text>
            <Text className="w-20 text-[11px] text-neutral-400">Fee (₹)</Text>
            <View className="w-8" />
          </View>

          {value.map((p, i) => {
            const picked = findDoctor(p.doctorId);
            const taken = doctorIdsTakenByOtherRows(i);
            const doctorLabel =
              picked?.name ??
              (p.doctorId
                ? doctorsLoading
                  ? "Loading…"
                  : `Unknown (${p.doctorId.slice(0, 6)}…)`
                : "Select doctor");

            return (
              <View key={`${i}-${p.doctorId}`} className="gap-1">
                <View className="flex-row items-center gap-2">
                  <Pressable
                    disabled={disabled || doctorsLoading}
                    onPress={() =>
                      setDoctorPickerOpen(doctorPickerOpen === i ? null : i)
                    }
                    className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-2 py-2"
                  >
                    <Text
                      numberOfLines={1}
                      className={`text-sm ${
                        picked ? "text-neutral-900" : "text-neutral-400"
                      }`}
                    >
                      {doctorLabel}
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={disabled}
                    onPress={() =>
                      setRolePickerOpen(rolePickerOpen === i ? null : i)
                    }
                    className="w-24 rounded-lg border border-neutral-200 bg-white px-2 py-2"
                  >
                    <Text
                      numberOfLines={1}
                      className={`text-sm ${
                        p.role ? "text-neutral-900" : "text-neutral-400"
                      }`}
                    >
                      {p.role || "Role"}
                    </Text>
                  </Pressable>

                  <TextInput
                    editable={!disabled}
                    keyboardType="decimal-pad"
                    value={String(p.fee ?? 0)}
                    onChangeText={(raw) => {
                      const n = raw === "" ? 0 : Number(raw);
                      updateRow(i, {
                        fee: Number.isFinite(n) ? Math.max(0, n) : 0,
                      });
                    }}
                    onBlur={() =>
                      updateRow(i, { fee: normalizeFee(Number(p.fee) || 0) })
                    }
                    className="w-20 rounded-lg border border-neutral-200 bg-white px-2 py-2 text-sm text-neutral-900"
                  />

                  <Pressable
                    disabled={disabled}
                    onPress={() => removeRow(i)}
                    className="h-9 w-8 items-center justify-center"
                  >
                    <Text className="text-base text-red-500">✕</Text>
                  </Pressable>
                </View>

                {doctorPickerOpen === i ? (
                  <View className="max-h-40 overflow-hidden rounded-lg border border-neutral-200 bg-white">
                    <ScrollView
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      style={{ maxHeight: 160 }}
                    >
                      {doctors.map((d) => {
                        const takenByOther = taken.has(d.id);
                        return (
                          <Pressable
                            key={d.id}
                            disabled={takenByOther}
                            onPress={() => {
                              // CRITICAL: only change doctorId — keep existing fee
                              updateRow(i, { doctorId: d.id });
                              setDoctorPickerOpen(null);
                            }}
                            className={`border-b border-neutral-50 px-3 py-2.5 ${
                              takenByOther ? "opacity-40" : "active:bg-neutral-50"
                            }`}
                          >
                            <Text className="text-sm text-neutral-900">
                              {d.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                      {p.doctorId && !picked && !doctorsLoading ? (
                        <Pressable
                          onPress={() => setDoctorPickerOpen(null)}
                          className="px-3 py-2.5"
                        >
                          <Text className="text-sm text-neutral-500">
                            Unknown doctor (id: {p.doctorId})
                          </Text>
                        </Pressable>
                      ) : null}
                    </ScrollView>
                  </View>
                ) : null}

                {rolePickerOpen === i ? (
                  <View className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                    {ROLES.map((role) => (
                      <Pressable
                        key={role}
                        onPress={() => {
                          updateRow(i, { role });
                          setRolePickerOpen(null);
                        }}
                        className="border-b border-neutral-50 px-3 py-2.5 active:bg-neutral-50"
                      >
                        <Text className="text-sm text-neutral-900">{role}</Text>
                      </Pressable>
                    ))}
                    {i > 0 ? (
                      <View className="border-t border-neutral-100 p-2">
                        <TextInput
                          placeholder="Custom role…"
                          placeholderTextColor="#9ca3af"
                          defaultValue={
                            ROLES.includes(p.role as (typeof ROLES)[number])
                              ? ""
                              : p.role
                          }
                          onSubmitEditing={(e) => {
                            const v = e.nativeEvent.text.trim();
                            if (v) updateRow(i, { role: v });
                            setRolePickerOpen(null);
                          }}
                          className="rounded-md border border-neutral-200 px-2 py-1.5 text-sm"
                        />
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {showTotal && value.length > 0 ? (
        <Text className="text-right text-sm font-medium text-brand">
          Total: ₹{" "}
          {total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
        </Text>
      ) : null}
    </View>
  );
}
