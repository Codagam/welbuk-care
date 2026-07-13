import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button, Segmented, TextField } from "@/ui";
import type {
  DentalTreatmentPlanRow,
  DiagnosisDetailsEntry,
  PlanStatus,
  TreatmentCatalogItem,
} from "../types";
import {
  clampDateToToday,
  normalizeTimeHHmm,
  randomId,
  todayYmd,
  toDateOnly,
} from "../utils";
import { formatConditionLabel } from "../problems";

const STATUS: PlanStatus[] = ["planned", "in-progress", "done"];

type Props = {
  visible: boolean;
  row: DentalTreatmentPlanRow | null;
  catalog: TreatmentCatalogItem[];
  finding?: DiagnosisDetailsEntry | null;
  defaultDoctorId: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (row: DentalTreatmentPlanRow) => void;
};

function sumCatalogFees(
  names: string[],
  catalog: TreatmentCatalogItem[]
): number {
  const seen = new Set<string>();
  let sum = 0;
  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const hit = catalog.find((c) => c.name.trim().toLowerCase() === key);
    if (hit && typeof hit.defaultFee === "number" && hit.defaultFee > 0) {
      sum += hit.defaultFee;
    }
  }
  return sum;
}

export function buildPlanFromFinding(
  entry: DiagnosisDetailsEntry,
  defaultDoctorId: string
): DentalTreatmentPlanRow {
  const suggested = (entry.suggestedTreatments ?? []).filter(
    (t) => t && t !== "Other"
  );
  const first = suggested[0] ?? "";
  const plannedDate = clampDateToToday(
    toDateOnly(entry.suggestedTreatmentNextDates?.[first]) ||
      toDateOnly(entry.nextAppointmentDate) ||
      todayYmd()
  );
  const providers =
    entry.treatmentProviders && entry.treatmentProviders.length > 0
      ? entry.treatmentProviders.map((p) => ({ ...p }))
      : [
          {
            doctorId: defaultDoctorId || "",
            role: "Primary",
            fee: entry.fee ?? 0,
          },
        ];
  const totalFee = providers.reduce((s, p) => s + (p.fee || 0), 0);

  return {
    id: randomId(),
    treatmentName: first,
    treatmentNames: suggested.length > 0 ? suggested : undefined,
    plannedTreatment: first,
    plannedDate,
    plannedTime: normalizeTimeHHmm(entry.nextAppointmentTime),
    status: "planned",
    providers,
    totalFee,
    diagnosisEntryId: entry.id,
    findingSummary: {
      tooth: `Tooth ${entry.toothId}`,
      conditionsText: formatConditionLabel(entry.problem),
      clinicalNote: entry.note ?? "",
      suggestedOptions: suggested,
    },
    selectedActuals: [],
  };
}

export function PlanEditorSheet({
  visible,
  row,
  catalog,
  finding,
  defaultDoctorId,
  saving,
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<DentalTreatmentPlanRow | null>(null);
  const [pickQuery, setPickQuery] = useState("");

  useEffect(() => {
    if (!visible || !row) {
      setDraft(null);
      return;
    }
    setDraft({
      ...row,
      plannedTime: normalizeTimeHHmm(row.plannedTime),
      plannedDate: row.plannedDate || todayYmd(),
      providers:
        row.providers?.length > 0
          ? row.providers
          : [
              {
                doctorId: defaultDoctorId || "",
                role: "Primary",
                fee: row.totalFee ?? 0,
              },
            ],
    });
    setPickQuery("");
  }, [visible, row, defaultDoctorId]);

  // Catalog fee sync when names change (standalone / linked) — don't wipe if sum<=0
  useEffect(() => {
    if (!draft || !visible) return;
    const labels = [
      ...(draft.treatmentNames ?? []),
      draft.treatmentName,
      ...(draft.findingSummary?.suggestedOptions ?? []),
    ].filter(Boolean);
    const sum = sumCatalogFees(labels, catalog);
    if (sum <= 0) return;
    setDraft((d) => {
      if (!d) return d;
      const providers =
        d.providers.length > 0
          ? d.providers.map((p, i) => (i === 0 ? { ...p, fee: sum } : p))
          : [{ doctorId: defaultDoctorId || "", role: "Primary", fee: sum }];
      return { ...d, providers, totalFee: sum };
    });
    // intentionally only when treatment name set changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.treatmentName, draft?.treatmentNames?.join("|"), catalog, visible]);

  const suggestions = useMemo(() => {
    const q = pickQuery.trim().toLowerCase();
    if (!q) return catalog.slice(0, 8);
    return catalog.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [catalog, pickQuery]);

  if (!draft) return null;

  const feeDisplay = (name: string): number => {
    const fromFinding = finding?.suggestedTreatmentFees?.[name];
    if (fromFinding != null) return fromFinding;
    const hit = catalog.find(
      (c) => c.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    return hit?.defaultFee ?? 0;
  };

  const toggleActual = (name: string) => {
    setDraft((d) => {
      if (!d) return d;
      const cur = d.selectedActuals ?? [];
      const exists = cur.some((a) => a.name === name);
      const selectedActuals = exists
        ? cur.filter((a) => a.name !== name)
        : [...cur, { name, date: todayYmd() }];
      const actualTreatment = selectedActuals.map((a) => a.name).join(", ");
      return { ...d, selectedActuals, actualTreatment };
    });
  };

  const setPrimaryFee = (fee: number) => {
    setDraft((d) => {
      if (!d) return d;
      const providers =
        d.providers.length > 0
          ? d.providers.map((p, i) => (i === 0 ? { ...p, fee } : p))
          : [{ doctorId: defaultDoctorId || "", role: "Primary", fee }];
      return { ...d, providers, totalFee: fee };
    });
  };

  const pickTreatment = (name: string, defaultFee?: number) => {
    setDraft((d) => {
      if (!d) return d;
      const names = Array.from(
        new Set([...(d.treatmentNames ?? []), name].filter(Boolean))
      );
      const fee =
        typeof defaultFee === "number" && defaultFee >= 0
          ? defaultFee
          : d.totalFee ?? 0;
      const providers =
        d.providers.length > 0
          ? d.providers.map((p, i) =>
              i === 0
                ? {
                    ...p,
                    fee:
                      typeof defaultFee === "number" && defaultFee > 0
                        ? sumCatalogFees(names, catalog) || fee
                        : p.fee,
                  }
                : p
            )
          : [
              {
                doctorId: defaultDoctorId || "",
                role: "Primary",
                fee:
                  typeof defaultFee === "number" && defaultFee > 0
                    ? defaultFee
                    : 0,
              },
            ];
      const totalFee = providers.reduce((s, p) => s + (p.fee || 0), 0);
      return {
        ...d,
        treatmentName: names[0] ?? name,
        treatmentNames: names,
        plannedTreatment: names.join(", "),
        providers,
        totalFee,
      };
    });
    setPickQuery("");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-neutral-50">
        <View className="flex-row items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
          <Text className="text-lg font-semibold text-neutral-900">
            {draft.diagnosisEntryId ? "Treat finding" : "Treatment plan"}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text className="text-sm text-neutral-500">Cancel</Text>
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}
        >
          {draft.findingSummary ? (
            <View className="gap-1 rounded-2xl border border-brand-100 bg-brand/5 p-3">
              <Text className="text-sm font-semibold text-neutral-900">
                {draft.findingSummary.tooth} ·{" "}
                {draft.findingSummary.conditionsText}
              </Text>
              {draft.findingSummary.clinicalNote ? (
                <Text className="text-sm text-neutral-600">
                  {draft.findingSummary.clinicalNote}
                </Text>
              ) : null}
            </View>
          ) : null}

          <TextField
            label="Treatment name"
            value={draft.treatmentName}
            onChangeText={(v) =>
              setDraft((d) => (d ? { ...d, treatmentName: v, plannedTreatment: v } : d))
            }
            placeholder="e.g. Composite filling"
          />

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-neutral-700">
              Add from catalog
            </Text>
            <TextField
              value={pickQuery}
              onChangeText={setPickQuery}
              placeholder="Search treatments…"
            />
            {pickQuery.trim() ? (
              <View className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                {suggestions.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => pickTreatment(item.name, item.defaultFee)}
                    className="border-b border-neutral-100 px-3 py-2.5"
                  >
                    <Text className="text-sm text-neutral-900">
                      {item.name}
                      {item.defaultFee != null ? ` · ₹${item.defaultFee}` : ""}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          {(draft.findingSummary?.suggestedOptions?.length ?? 0) > 0 ? (
            <View className="gap-2">
              <Text className="text-sm font-medium text-neutral-700">
                Actual / treated
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {draft.findingSummary!.suggestedOptions.map((name) => {
                  const on = (draft.selectedActuals ?? []).some(
                    (a) => a.name === name
                  );
                  return (
                    <Pressable
                      key={name}
                      onPress={() => toggleActual(name)}
                      className={`rounded-full px-3 py-2 ${
                        on ? "bg-emerald-600" : "border border-neutral-300 bg-white"
                      }`}
                    >
                      <Text
                        className={`text-sm ${
                          on ? "text-white" : "text-neutral-700"
                        }`}
                      >
                        {name} · ₹{feeDisplay(name)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View className="flex-row gap-2">
            <TextField
              containerClassName="flex-1"
              label="Planned date"
              value={draft.plannedDate ?? ""}
              onChangeText={(v) =>
                setDraft((d) => (d ? { ...d, plannedDate: v } : d))
              }
              placeholder="YYYY-MM-DD"
            />
            <TextField
              containerClassName="w-28"
              label="Time"
              value={draft.plannedTime ?? "10:00"}
              onChangeText={(v) =>
                setDraft((d) => (d ? { ...d, plannedTime: v } : d))
              }
              placeholder="HH:mm"
            />
          </View>

          <TextField
            label="Actual date"
            value={draft.actualDate ?? ""}
            onChangeText={(v) =>
              setDraft((d) => (d ? { ...d, actualDate: v } : d))
            }
            placeholder="YYYY-MM-DD"
          />

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-neutral-700">Status</Text>
            <Segmented
              options={STATUS}
              value={draft.status}
              onChange={(s) =>
                setDraft((d) => (d ? { ...d, status: s as PlanStatus } : d))
              }
            />
          </View>

          <TextField
            label="Total fee (₹)"
            value={
              draft.totalFee != null
                ? String(draft.totalFee)
                : String(draft.providers[0]?.fee ?? "")
            }
            onChangeText={(v) =>
              setPrimaryFee(Number(v.replace(/[^0-9.]/g, "")) || 0)
            }
            keyboardType="decimal-pad"
            placeholder="0"
          />

          <Text className="text-xs text-neutral-400">
            Billable when status is done, or in-progress with fee &gt; 0.
          </Text>

          <Button
            label="Save plan"
            loading={saving}
            onPress={() => {
              const providers = draft.providers.map((p, i) =>
                i === 0
                  ? {
                      ...p,
                      fee: draft.totalFee ?? p.fee,
                      doctorId: p.doctorId || defaultDoctorId || "",
                    }
                  : p
              );
              const totalFee = providers.reduce(
                (s, p) => s + (p.fee || 0),
                0
              );
              onSave({
                ...draft,
                providers,
                totalFee,
                plannedTime: normalizeTimeHHmm(draft.plannedTime),
                plannedDate: toDateOnly(draft.plannedDate) || todayYmd(),
                actualDate: toDateOnly(draft.actualDate) || undefined,
                actualTreatment:
                  (draft.selectedActuals ?? []).map((a) => a.name).join(", ") ||
                  draft.actualTreatment,
              });
            }}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}
