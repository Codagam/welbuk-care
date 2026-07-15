import { useEffect, useMemo, useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";

import { Button, DateField, Segmented, TextField, TimeField } from "@/ui";
import { formatConditionLabel } from "../problems";
import type {
    DentalTreatmentPlanRow,
    DiagnosisDetailsEntry,
    PlanStatus,
    SelectedActualItem,
    TreatmentCatalogItem,
} from "../types";
import {
    clampDateToToday,
    normalizeFee,
    normalizeTimeHHmm,
    providerFeeSum,
    randomId,
    selectedActualsTreatmentFee,
    toDateOnly,
    todayYmd,
} from "../utils";
import { ProviderFeeSplitEditor } from "./ProviderFeeSplitEditor";
import { ToothBadge } from "./ToothBadge";

const STATUS: PlanStatus[] = ["planned", "in-progress", "done"];

type Props = {
  visible: boolean;
  row: DentalTreatmentPlanRow | null;
  catalog: TreatmentCatalogItem[];
  finding?: DiagnosisDetailsEntry | null;
  facilityId?: string;
  defaultDoctorId: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (row: DentalTreatmentPlanRow) => void;
};

function feesMapFrom(
  finding?: DiagnosisDetailsEntry | null,
  summary?: DentalTreatmentPlanRow["findingSummary"]
): Record<string, number> | undefined {
  return (
    finding?.suggestedTreatmentFees ??
    summary?.suggestedTreatmentFees ??
    undefined
  );
}

function combinedPlanTotal(
  providers: { fee?: number }[],
  selectedActuals: SelectedActualItem[] | undefined,
  finding?: DiagnosisDetailsEntry | null,
  summary?: DentalTreatmentPlanRow["findingSummary"],
  catalog?: TreatmentCatalogItem[]
): number {
  return normalizeFee(
    providerFeeSum(providers) +
      selectedActualsTreatmentFee(
        selectedActuals,
        feesMapFrom(finding, summary),
        catalog
      )
  );
}

/** Display DD-MM-YYYY like Practice planned treatment pills. */
function formatPlanRowDate(value?: string): string {
  const d = toDateOnly(value);
  if (!d || d.length < 10) return "—";
  const [y, m, day] = d.split("-");
  return `${day}-${m}-${y}`;
}

function diagnosisPlannedDateForTreatment(
  entry: DiagnosisDetailsEntry | undefined,
  treatmentName: string
): string {
  if (!entry) return "";
  const name = String(treatmentName).trim();
  if (!name) return "";
  const fromMap = toDateOnly(
    String(entry.suggestedTreatmentNextDates?.[name] ?? "").trim()
  );
  if (fromMap) return fromMap;
  return toDateOnly(entry.nextAppointmentDate);
}

/** none → planned; partial → in-progress; all suggested treated → done */
function statusFromSuggestedAndTreated(
  suggestedOptions: string[] | undefined,
  selectedActuals: SelectedActualItem[] | undefined
): PlanStatus {
  const sug = (suggestedOptions ?? [])
    .map((s) => String(s).trim())
    .filter(Boolean);
  if (sug.length === 0) return "planned";
  const sel = new Set(
    (selectedActuals ?? []).map((a) => a.name.trim()).filter(Boolean)
  );
  if (sel.size === 0) return "planned";
  if (sug.every((s) => sel.has(s))) return "done";
  return "in-progress";
}

function toothNumberFromSummary(tooth?: string | null): string | null {
  if (!tooth?.trim()) return null;
  const m = /^Tooth\s+(.+)$/i.exec(tooth.trim());
  return (m?.[1] ?? tooth).trim() || null;
}

export function buildPlanFromFinding(
  entry: DiagnosisDetailsEntry,
  _defaultDoctorId: string
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
      : [{ doctorId: "", role: "Primary", fee: 0 }];
  const totalFee = providers.reduce((s, p) => s + (Number(p.fee) || 0), 0);

  return {
    id: randomId(),
    treatmentName: first,
    treatmentNames: suggested.length > 0 ? suggested : undefined,
    plannedTreatment: first,
    plannedDate,
    plannedTime: normalizeTimeHHmm(entry.nextAppointmentTime),
    actualDate: todayYmd(),
    status: "planned",
    providers,
    totalFee,
    diagnosisEntryId: entry.id,
    findingSummary: {
      tooth: `Tooth ${entry.toothId}`,
      conditionsText: formatConditionLabel(entry.problem),
      clinicalNote: entry.note ?? "",
      suggestedOptions: suggested,
      suggestedTreatmentFees: entry.suggestedTreatmentFees
        ? { ...entry.suggestedTreatmentFees }
        : undefined,
    },
    selectedActuals: [],
  };
}

export function PlanEditorSheet({
  visible,
  row,
  catalog,
  finding,
  facilityId,
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
    const suggestedOpts = row.findingSummary?.suggestedOptions;
    const usesPicker =
      !!row.diagnosisEntryId &&
      Array.isArray(suggestedOpts) &&
      suggestedOpts.some((s) => String(s).trim());
    const selectedActuals = row.selectedActuals ?? [];
    const providers =
      row.providers?.length > 0
        ? row.providers.map((p) => ({ ...p }))
        : [{ doctorId: "", role: "Primary", fee: 0 }];
    const findingSummary = row.findingSummary
      ? {
          ...row.findingSummary,
          suggestedTreatmentFees:
            row.findingSummary.suggestedTreatmentFees ??
            finding?.suggestedTreatmentFees,
        }
      : row.findingSummary;
    setDraft({
      ...row,
      plannedTime: normalizeTimeHHmm(row.plannedTime),
      plannedDate: row.plannedDate || todayYmd(),
      actualDate:
        row.actualDate?.trim() ||
        (row.diagnosisEntryId ? todayYmd() : ""),
      status: usesPicker
        ? statusFromSuggestedAndTreated(suggestedOpts, selectedActuals)
        : row.status,
      providers,
      findingSummary,
      selectedActuals,
      totalFee: combinedPlanTotal(
        providers,
        selectedActuals,
        finding,
        findingSummary,
        catalog
      ),
    });
    setPickQuery("");
    // Hydrate when the sheet opens for a row; finding/catalog are read for fee snapshot only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, row]);

  const suggestions = useMemo(() => {
    const q = pickQuery.trim().toLowerCase();
    if (!q) return catalog.slice(0, 8);
    return catalog.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [catalog, pickQuery]);

  if (!draft) return null;

  const isLinked = Boolean(draft.diagnosisEntryId?.trim());
  const suggestedOptions = (draft.findingSummary?.suggestedOptions ?? []).filter(
    Boolean
  );
  const usesSuggestedPicker = isLinked && suggestedOptions.length > 0;
  const selectedActuals = draft.selectedActuals ?? [];
  const remainingSuggested = suggestedOptions.filter(
    (opt) => !selectedActuals.some((a) => a.name === opt)
  );
  const treatmentCost = selectedActualsTreatmentFee(
    selectedActuals,
    feesMapFrom(finding, draft.findingSummary),
    catalog
  );

  const canSave = usesSuggestedPicker
    ? selectedActuals.length > 0
    : isLinked
      ? Boolean(String(draft.actualTreatment ?? "").trim())
      : Boolean(String(draft.treatmentName ?? "").trim());

  const toothNum = toothNumberFromSummary(draft.findingSummary?.tooth);

  const toggleActualFromSuggestion = (name: string) => {
    setDraft((d) => {
      if (!d) return d;
      const current = d.selectedActuals ?? [];
      const exists = current.some((a) => a.name === name);
      const next = exists
        ? current.filter((a) => a.name !== name)
        : [...current, { name, date: todayYmd() }];
      const suggested = d.findingSummary?.suggestedOptions ?? [];
      const usesPicker = suggested.some((s) => String(s).trim());
      return {
        ...d,
        selectedActuals: next,
        actualTreatment: next.map((a) => a.name).join(", "),
        totalFee: combinedPlanTotal(
          d.providers,
          next,
          finding,
          d.findingSummary,
          catalog
        ),
        ...(usesPicker
          ? { status: statusFromSuggestedAndTreated(suggested, next) }
          : {}),
      };
    });
  };

  const pickTreatment = (name: string) => {
    setDraft((d) => {
      if (!d) return d;
      const names = Array.from(
        new Set([...(d.treatmentNames ?? []), name].filter(Boolean))
      );
      // Doctor fee split stays at whatever the user entered (default 0)
      const providers =
        d.providers.length > 0
          ? d.providers
          : [{ doctorId: "", role: "Primary", fee: 0 }];
      return {
        ...d,
        treatmentName: names[0] ?? name,
        treatmentNames: names,
        plannedTreatment: names.join(", "),
        providers,
        totalFee: combinedPlanTotal(
          providers,
          d.selectedActuals,
          finding,
          d.findingSummary,
          catalog
        ),
      };
    });
    setPickQuery("");
  };

  const handleSave = () => {
    if (!canSave) return;
    const providers = draft.providers.map((p) => ({
      doctorId: p.doctorId || "",
      role: p.role?.trim() || "Primary",
      fee: normalizeFee(Number(p.fee) || 0),
    }));
    const totalFee = combinedPlanTotal(
      providers,
      draft.selectedActuals,
      finding,
      draft.findingSummary,
      catalog
    );
    onSave({
      ...draft,
      providers,
      totalFee,
      plannedTime: normalizeTimeHHmm(draft.plannedTime),
      plannedDate: toDateOnly(draft.plannedDate) || todayYmd(),
      actualDate: toDateOnly(draft.actualDate) || todayYmd(),
      actualTreatment:
        (draft.selectedActuals ?? []).map((a) => a.name).join(", ") ||
        draft.actualTreatment,
      treatmentName:
        draft.treatmentName ||
        (draft.selectedActuals ?? [])[0]?.name ||
        draft.plannedTreatment ||
        "",
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white">
        {/* Header — Planned Treatment + tooth badge */}
        <View className="gap-1 border-b border-neutral-200 px-4 pb-3 pt-3">
          <View className="flex-row items-center gap-3">
            {toothNum ? <ToothBadge toothNumber={toothNum} size={40} /> : null}
            <Text className="min-w-0 flex-1 text-xl font-bold text-neutral-900">
              {isLinked ? "Planned Treatment" : "New Treatment Plan"}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} className="px-1">
              <Text className="text-xl leading-none text-neutral-400">×</Text>
            </Pressable>
          </View>
          <Text className="text-sm text-neutral-500">
            Planned and actual treatment, provider fee split, and status.
          </Text>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 16 }}
        >
          {/* Condition banner (linked) */}
          {isLinked && draft.findingSummary?.conditionsText ? (
            <View className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <Text className="text-sm text-neutral-600">
                · Condition:{" "}
                <Text className="font-semibold text-neutral-900">
                  {draft.findingSummary.conditionsText}
                </Text>
              </Text>
              {draft.findingSummary.clinicalNote ? (
                <Text className="mt-1 text-xs text-neutral-500" numberOfLines={2}>
                  Clinical note: {draft.findingSummary.clinicalNote}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* Linked: Suggested | Treated */}
          {usesSuggestedPicker ? (
            <View className="gap-3">
              <View className="flex-row gap-3">
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="text-xs text-neutral-500">Suggested</Text>
                  <View className="min-h-[88px] rounded-lg border border-neutral-200 p-2">
                    {remainingSuggested.length === 0 ? (
                      <Text className="text-xs text-neutral-400">
                        No more suggestions
                      </Text>
                    ) : (
                      remainingSuggested.map((opt) => {
                        const planned = diagnosisPlannedDateForTreatment(
                          finding ?? undefined,
                          opt
                        );
                        return (
                          <Pressable
                            key={opt}
                            onPress={() => toggleActualFromSuggestion(opt)}
                            className="mb-1 flex-row items-center justify-between gap-2 rounded-md bg-brand px-2.5 py-2 active:opacity-90"
                          >
                            <Text
                              className="min-w-0 flex-1 text-xs font-medium text-white"
                              numberOfLines={1}
                            >
                              {opt}
                            </Text>
                            <Text className="shrink-0 text-xs tabular-nums text-white/90">
                              {formatPlanRowDate(planned || draft.plannedDate)}
                            </Text>
                          </Pressable>
                        );
                      })
                    )}
                  </View>
                </View>

                <View className="min-w-0 flex-1 gap-1">
                  <Text className="text-xs text-neutral-500">Treated</Text>
                  <View className="min-h-[88px] rounded-lg border border-neutral-200 p-2">
                    {selectedActuals.length === 0 ? (
                      <Text className="text-xs text-neutral-400">
                        Click from left to add
                      </Text>
                    ) : (
                      selectedActuals.map((act) => (
                        <Pressable
                          key={act.name}
                          onPress={() => toggleActualFromSuggestion(act.name)}
                          className="mb-1 flex-row items-center justify-between gap-2 rounded-md bg-brand px-2.5 py-2 active:opacity-90"
                        >
                          <Text
                            className="min-w-0 flex-1 text-xs font-medium text-white"
                            numberOfLines={1}
                          >
                            {act.name}
                          </Text>
                          <Text className="shrink-0 text-xs tabular-nums text-white/90">
                            {formatPlanRowDate(act.date || todayYmd())}
                          </Text>
                          <Text className="shrink-0 text-xs text-white">✕</Text>
                        </Pressable>
                      ))
                    )}
                  </View>
                </View>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Text className="text-sm font-medium text-neutral-700">
                    Status
                  </Text>
                  <Segmented
                    options={STATUS}
                    value={draft.status}
                    onChange={(s) =>
                      setDraft((d) =>
                        d ? { ...d, status: s as PlanStatus } : d
                      )
                    }
                  />
                </View>
              </View>

              <DateField
                label="Actual date"
                value={draft.actualDate ?? todayYmd()}
                onChange={(v) =>
                  setDraft((d) => (d ? { ...d, actualDate: v } : d))
                }
              />
            </View>
          ) : null}

          {/* Standalone / linked without suggestions */}
          {!usesSuggestedPicker ? (
            <View className="gap-3">
              {!isLinked ? (
                <>
                  <TextField
                    label="Treatment name"
                    value={draft.treatmentName}
                    onChangeText={(v) =>
                      setDraft((d) =>
                        d
                          ? { ...d, treatmentName: v, plannedTreatment: v }
                          : d
                      )
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
                            onPress={() => pickTreatment(item.name)}
                            className="border-b border-neutral-100 px-3 py-2.5"
                          >
                            <Text className="text-sm text-neutral-900">
                              {item.name}
                              {item.defaultFee != null
                                ? ` · ₹${item.defaultFee}`
                                : ""}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                  <View className="flex-row gap-2">
                    <DateField
                      containerClassName="flex-1"
                      label="Planned date"
                      value={draft.plannedDate || todayYmd()}
                      onChange={(v) =>
                        setDraft((d) => (d ? { ...d, plannedDate: v } : d))
                      }
                    />
                    <TimeField
                      containerClassName="w-28"
                      label="Time"
                      value={draft.plannedTime || "10:00"}
                      onChange={(v) =>
                        setDraft((d) => (d ? { ...d, plannedTime: v } : d))
                      }
                    />
                  </View>
                </>
              ) : (
                <TextField
                  label="Actual treatment"
                  value={draft.actualTreatment ?? ""}
                  onChangeText={(v) =>
                    setDraft((d) => (d ? { ...d, actualTreatment: v } : d))
                  }
                  placeholder="What was actually done…"
                  multiline
                  style={{ minHeight: 72, textAlignVertical: "top" }}
                />
              )}

              <View className="gap-1.5">
                <Text className="text-sm font-medium text-neutral-700">
                  Status
                </Text>
                <Segmented
                  options={STATUS}
                  value={draft.status}
                  onChange={(s) =>
                    setDraft((d) =>
                      d ? { ...d, status: s as PlanStatus } : d
                    )
                  }
                />
              </View>
              <DateField
                label="Actual date"
                value={draft.actualDate || todayYmd()}
                onChange={(v) =>
                  setDraft((d) => (d ? { ...d, actualDate: v } : d))
                }
              />
            </View>
          ) : null}

          {/* Provider fee split */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-neutral-900">
              {isLinked
                ? "Provider fee split (linked finding)"
                : "Provider fee split"}
            </Text>
            <Text className="text-[11px] leading-snug text-neutral-500">
              {isLinked
                ? "Treated treatment costs plus doctor fees make the total. Doctor fee split starts at 0 until you enter amounts."
                : "Fee amounts are editable — doctor fees start at 0 and are separate from treatment costs."}
            </Text>
            <ProviderFeeSplitEditor
              facilityId={facilityId}
              defaultDoctorId={defaultDoctorId}
              value={draft.providers}
              additionalFeeTotal={isLinked ? treatmentCost : 0}
              onChange={(providers) => {
                const totalFee = combinedPlanTotal(
                  providers,
                  draft.selectedActuals,
                  finding,
                  draft.findingSummary,
                  catalog
                );
                setDraft((d) => (d ? { ...d, providers, totalFee } : d));
              }}
              showTotal
              hideTitle
              hideAddProvider={isLinked}
            />
          </View>

          {!canSave && usesSuggestedPicker ? (
            <Text className="text-xs text-amber-700">
              Add at least one treatment under Treated before saving.
            </Text>
          ) : null}
        </ScrollView>

        {/* Footer */}
        <View className="gap-2 border-t border-neutral-200 bg-white px-4 py-3">
          <Button
            label="Save"
            loading={saving}
            disabled={!canSave}
            onPress={handleSave}
          />
          <Button label="Cancel" variant="outline" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
