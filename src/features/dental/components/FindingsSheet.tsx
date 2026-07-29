import { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { AppModal, Button, DateField, TextField, TimeField } from "@/ui";
import { getProblemLabel } from "../problems";
import { ALL_FDI_IDS } from "../teeth";
import type {
    DentalTreatmentPlanRow,
    DiagnosisDetailsEntry,
    DiagnosisOption,
    FindingStatus,
    SuggestedTreatmentPlanRow,
    TreatmentCatalogItem,
    TreatmentProvider,
} from "../types";
import {
    applyDiscount,
    doneDiagnosisEntryIds,
    feeStringFromCatalogDefault,
    normalizeFee,
    randomId,
    toDateOnly,
    todayYmd,
} from "../utils";
import { DiagnosisTypesAutocomplete } from "./DiagnosisTypesAutocomplete";
import { ProviderFeeSplitEditor } from "./ProviderFeeSplitEditor";
import { ToothBadge } from "./ToothBadge";

type ConditionDraft = {
  problem: string;
  label: string;
  note: string;
  status: FindingStatus;
  nextAppointmentDate: string;
  nextAppointmentTime: string;
  nextAppointmentReason: string;
  treatments: SuggestedTreatmentPlanRow[];
  fee: number;
  providers: TreatmentProvider[];
  existingId?: string;
};

type Props = {
  visible: boolean;
  toothId: string | null;
  entries: DiagnosisDetailsEntry[];
  planItems?: DentalTreatmentPlanRow[];
  diagnosisOptions: DiagnosisOption[];
  catalog: TreatmentCatalogItem[];
  facilityId?: string;
  defaultDoctorId: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (
    nextEntries: DiagnosisDetailsEntry[],
    options?: { cloneToToothIds?: string[] }
  ) => Promise<boolean>;
  onClearTooth?: (toothId: string) => Promise<boolean>;
};

function emptyDraft(
  problem: string,
  label: string,
  existing?: DiagnosisDetailsEntry,
  defaultDoctorId = ""
): ConditionDraft {
  const today = todayYmd();
  const treatments: SuggestedTreatmentPlanRow[] = (
    existing?.suggestedTreatments ?? []
  )
    .filter((n) => n && n !== "Other")
    .map((name) => {
      const fee =
        existing?.suggestedTreatmentFees?.[name] != null
          ? String(existing.suggestedTreatmentFees[name])
          : "";
      const date =
        toDateOnly(existing?.suggestedTreatmentNextDates?.[name]) ||
        toDateOnly(existing?.nextAppointmentDate) ||
        today;
      return {
        id: randomId(),
        treatmentName: name,
        date,
        feeBase: fee,
        fee,
        discountPct: "",
        maxDiscountPercent: null,
      };
    });

  return {
    problem,
    label,
    note: existing?.note ?? "",
    status: existing?.treatmentStatus ?? "planned",
    nextAppointmentDate: toDateOnly(existing?.nextAppointmentDate) || today,
    nextAppointmentTime: existing?.nextAppointmentTime ?? "",
    nextAppointmentReason: existing?.nextAppointmentReason ?? "",
    treatments,
    fee: existing?.fee ?? 0,
    // Seed Primary consulting doctor fee 0 so fee split is open immediately
    providers: existing?.treatmentProviders?.length
      ? existing.treatmentProviders.map((p) => ({ ...p }))
      : defaultDoctorId
        ? [{ doctorId: defaultDoctorId, role: "Primary", fee: 0 }]
        : [],
    existingId: existing?.id,
  };
}

function catalogByName(catalog: TreatmentCatalogItem[], name: string) {
  const n = name.trim().toLowerCase();
  return catalog.find((c) => c.name.trim().toLowerCase() === n);
}

function statusBadge(status: FindingStatus): string {
  if (status === "done") return "Done";
  if (status === "in-progress") return "In progress";
  return "Pending";
}

export function FindingsSheet({
  visible,
  toothId,
  entries,
  planItems = [],
  diagnosisOptions,
  catalog,
  facilityId,
  defaultDoctorId,
  saving,
  onClose,
  onSave,
  onClearTooth,
}: Props) {
  const [selectedProblems, setSelectedProblems] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ConditionDraft>>({});
  const [treatmentQuery, setTreatmentQuery] = useState<Record<string, string>>(
    {}
  );
  const [treatmentPickerOpenFor, setTreatmentPickerOpenFor] = useState<
    string | null
  >(null);
  const [treatmentPickerAnchor, setTreatmentPickerAnchor] = useState({
    x: 0,
    y: 0,
    width: 280,
    height: 40,
  });
  const treatmentFieldRefs = useRef<Record<string, View | null>>({});
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [localError, setLocalError] = useState<string | null>(null);
  const [clonePickerOpen, setClonePickerOpen] = useState(false);
  const [cloneTargetIds, setCloneTargetIds] = useState<string[]>([]);

  const closeTreatmentPicker = () => {
    setTreatmentPickerOpenFor(null);
  };

  const doneIds = useMemo(
    () => doneDiagnosisEntryIds(planItems),
    [planItems]
  );

  const labelFor = (problem: string, draftLabel?: string) => {
    if (draftLabel?.trim()) return draftLabel;
    const hit = diagnosisOptions.find((o) => o.value === problem);
    return hit?.label || getProblemLabel(problem);
  };

  useEffect(() => {
    if (!visible || !toothId) return;
    const forTooth = entries.filter((e) => e.toothId === toothId);
    const problems = forTooth.map((e) => e.problem);
    setSelectedProblems(problems);
    const next: Record<string, ConditionDraft> = {};
    for (const e of forTooth) {
      next[e.problem] = emptyDraft(
        e.problem,
        labelFor(e.problem),
        e,
        defaultDoctorId
      );
    }
    setDrafts(next);
    // Conditions start collapsed — expand only when the user taps the arrow
    setExpanded(new Set());
    setTreatmentQuery({});
    setTreatmentPickerOpenFor(null);
    setDiagnosisOpen(false);
    setLocalError(null);
    setCloneTargetIds([]);
    setClonePickerOpen(false);
    // Re-hydrate only when opening / changing tooth
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, toothId, defaultDoctorId]);

  const otherFdiTeeth = useMemo(
    () =>
      toothId
        ? ALL_FDI_IDS.filter((id) => id !== String(toothId).trim())
        : [],
    [toothId]
  );

  const cloneTargetsSorted = useMemo(
    () =>
      [...cloneTargetIds].sort(
        (a, b) => (Number.parseInt(a, 10) || 0) - (Number.parseInt(b, 10) || 0)
      ),
    [cloneTargetIds]
  );

  const selectedLabels = selectedProblems.map(
    (p) => drafts[p]?.label || labelFor(p)
  );

  const addCondition = (opt: DiagnosisOption) => {
    if (selectedProblems.includes(opt.value)) return;
    setSelectedProblems((prev) => [...prev, opt.value]);
    setDrafts((d) => ({
      ...d,
      [opt.value]:
        d[opt.value] ??
        emptyDraft(
          opt.value,
          opt.label,
          entries.find(
            (e) => e.toothId === toothId && e.problem === opt.value
          ),
          defaultDoctorId
        ),
    }));
    // Stay collapsed until user taps the arrow
  };

  const removeCondition = (problem: string) => {
    const draft = drafts[problem];
    if (draft?.existingId && doneIds.has(draft.existingId)) return;
    setSelectedProblems((prev) => prev.filter((p) => p !== problem));
    setDrafts((d) => {
      const n = { ...d };
      delete n[problem];
      return n;
    });
    setExpanded((prev) => {
      const n = new Set(prev);
      n.delete(problem);
      return n;
    });
  };

  const updateDraft = (problem: string, patch: Partial<ConditionDraft>) => {
    setDrafts((d) => ({
      ...d,
      [problem]: { ...d[problem], ...patch },
    }));
  };

  const isLocked = (problem: string) => {
    const id = drafts[problem]?.existingId;
    return !!(id && doneIds.has(id));
  };

  const openTreatmentPicker = (problem: string) => {
    if (isLocked(problem)) return;
    setDiagnosisOpen(false);
    // Open immediately — do not wait on measureInWindow (can fail after Modal close)
    setTreatmentPickerOpenFor(problem);
    treatmentFieldRefs.current[problem]?.measureInWindow?.(
      (x, y, width, height) => {
        if (width > 0 && height > 0) {
          setTreatmentPickerAnchor({
            x,
            y,
            width: Math.max(width, 240),
            height,
          });
        }
      }
    );
  };

  const addTreatment = (
    problem: string,
    name: string,
    catalogDefaultFee?: number,
    catalogMaxDiscountPercent?: number | null
  ) => {
    if (isLocked(problem)) return;
    const draft = drafts[problem];
    if (!draft) return;
    if (
      draft.treatments.some(
        (t) => t.treatmentName.trim().toLowerCase() === name.trim().toLowerCase()
      )
    ) {
      return;
    }
    const date = draft.nextAppointmentDate?.trim() || todayYmd();
    const feeStr = feeStringFromCatalogDefault(catalogDefaultFee);
    const row: SuggestedTreatmentPlanRow = {
      id: randomId(),
      treatmentName: name.trim(),
      date,
      feeBase: feeStr,
      fee: feeStr,
      discountPct: "",
      maxDiscountPercent: catalogMaxDiscountPercent ?? null,
    };
    const treatments = [...draft.treatments, row];
    const feeSum = treatments.reduce((s, t) => s + (Number(t.fee) || 0), 0);
    // Doctor fee split stays at 0 until the user enters amounts (separate from treatment fees)
    updateDraft(problem, { treatments, fee: feeSum });
    setTreatmentQuery((q) => ({ ...q, [problem]: "" }));
  };

  const updateTreatment = (
    problem: string,
    rowId: string,
    patch: Partial<SuggestedTreatmentPlanRow>
  ) => {
    if (isLocked(problem)) return;
    const draft = drafts[problem];
    if (!draft) return;
    const treatments = draft.treatments.map((t) => {
      if (t.id !== rowId) return t;
      const next = { ...t, ...patch };
      if (patch.discountPct !== undefined || patch.feeBase !== undefined) {
        const base = Number(next.feeBase) || 0;
        const disc = Number(next.discountPct);
        if (next.discountPct.trim() && Number.isFinite(disc)) {
          next.fee = String(
            applyDiscount(base, disc, next.maxDiscountPercent)
          );
        } else if (patch.feeBase !== undefined && !next.discountPct.trim()) {
          next.fee = next.feeBase;
        }
      }
      if (patch.fee !== undefined && patch.discountPct === undefined) {
        next.feeBase = next.fee;
        next.discountPct = "";
      }
      return next;
    });
    const feeSum = treatments.reduce((s, t) => s + (Number(t.fee) || 0), 0);
    // Keep provider fees independent of treatment catalog amounts
    updateDraft(problem, { treatments, fee: feeSum });
  };

  const removeTreatment = (problem: string, rowId: string) => {
    if (isLocked(problem)) return;
    const draft = drafts[problem];
    if (!draft) return;
    const treatments = draft.treatments.filter((t) => t.id !== rowId);
    const feeSum = treatments.reduce((s, t) => s + (Number(t.fee) || 0), 0);
    updateDraft(problem, { treatments, fee: feeSum });
  };

  const toggleTreatment = (
    problem: string,
    name: string,
    catalogDefaultFee?: number,
    catalogMaxDiscountPercent?: number | null
  ) => {
    if (isLocked(problem)) return;
    const draft = drafts[problem];
    if (!draft) return;
    const existing = draft.treatments.find(
      (t) => t.treatmentName.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (existing) {
      removeTreatment(problem, existing.id);
      return;
    }
    addTreatment(problem, name, catalogDefaultFee, catalogMaxDiscountPercent);
  };

  const canSaveFindings = useMemo(() => {
    if (selectedProblems.length === 0) return false;
    return selectedProblems.every((problem) => {
      const list = drafts[problem]?.treatments ?? [];
      return list.some((t) => String(t.treatmentName ?? "").trim().length > 0);
    });
  }, [selectedProblems, drafts]);

  const handleSave = async () => {
    if (!toothId) return;
    if (selectedProblems.length === 0) {
      setLocalError("Select at least one condition, or delete the tooth plan.");
      return;
    }
    if (!canSaveFindings) {
      setLocalError(
        "Add a suggested treatment for each selected diagnosis before saving."
      );
      return;
    }
    setLocalError(null);

    const rest = entries.filter((e) => e.toothId !== toothId);
    const built: DiagnosisDetailsEntry[] = selectedProblems.map((problem) => {
      const d =
        drafts[problem] ??
        emptyDraft(problem, labelFor(problem), undefined, defaultDoctorId);
      const suggestedTreatments = d.treatments
        .map((t) => t.treatmentName.trim())
        .filter(Boolean);
      const suggestedTreatmentFees: Record<string, number> = {};
      const suggestedTreatmentNextDates: Record<string, string> = {};
      let earliest = "";
      for (const t of d.treatments) {
        const name = t.treatmentName.trim();
        if (!name) continue;
        const feeNum = Number(t.fee);
        if (Number.isFinite(feeNum)) suggestedTreatmentFees[name] = feeNum;
        const date = toDateOnly(t.date) || todayYmd();
        suggestedTreatmentNextDates[name] = date;
        if (!earliest || date < earliest) earliest = date;
      }
      const feeSum = Object.values(suggestedTreatmentFees).reduce(
        (s, n) => s + n,
        0
      );
      const providers = (d.providers ?? [])
        .filter((p) => String(p.doctorId ?? "").trim())
        .map((p) => ({
          doctorId: p.doctorId,
          role: p.role?.trim() || "Primary",
          fee: normalizeFee(Number(p.fee) || 0),
        }));
      return {
        id: d.existingId ?? randomId(),
        toothId,
        problem,
        note: d.note.trim() || undefined,
        fee: feeSum || d.fee || undefined,
        suggestedTreatments,
        suggestedTreatmentFees:
          Object.keys(suggestedTreatmentFees).length > 0
            ? suggestedTreatmentFees
            : undefined,
        suggestedTreatmentNextDates:
          Object.keys(suggestedTreatmentNextDates).length > 0
            ? suggestedTreatmentNextDates
            : undefined,
        nextAppointmentDate:
          earliest || toDateOnly(d.nextAppointmentDate) || undefined,
        nextAppointmentTime: d.nextAppointmentTime.trim() || undefined,
        nextAppointmentReason: d.nextAppointmentReason.trim() || undefined,
        treatmentStatus: d.status,
        treatmentProviders: providers.length > 0 ? providers : undefined,
      };
    });

    await onSave([...rest, ...built], {
      cloneToToothIds:
        cloneTargetIds.length > 0 ? cloneTargetIds : undefined,
    });
  };

  const confirmClearTooth = () => {
    if (!toothId || !onClearTooth) return;
    Alert.alert(
      "Delete tooth plan",
      `Remove all findings and linked plan rows for tooth ${toothId}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void onClearTooth(toothId),
        },
      ]
    );
  };

  const toggleCloneTarget = (id: string) => {
    setCloneTargetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const suggestionsFor = (problem: string) => {
    const q = (treatmentQuery[problem] ?? "").trim().toLowerCase();
    if (!q) return catalog.slice(0, 50);
    return catalog
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 50);
  };

  const isTreatmentSelected = (problem: string, name: string) =>
    (drafts[problem]?.treatments ?? []).some(
      (t) => t.treatmentName.trim().toLowerCase() === name.trim().toLowerCase()
    );

  const expandAll = () => setExpanded(new Set(selectedProblems));
  const collapseAll = () => setExpanded(new Set());

  if (!toothId) return null;

  const treatmentFeeTotal = (problem: string) =>
    (drafts[problem]?.treatments ?? []).reduce(
      (s, t) => s + (Number(t.fee) || 0),
      0
    );

  return (
    <AppModal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-neutral-50">
        {/* Header */}
        <View className="gap-3 border-b border-neutral-200 bg-white px-4 pb-3 pt-3">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="min-w-0 flex-1 text-lg font-semibold text-neutral-900">
              Treatment Plan
            </Text>
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={() => setClonePickerOpen(true)}
                className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5"
              >
                <Text className="text-xs text-neutral-700">
                  Clone to teeth…
                </Text>
              </Pressable>
              <ToothBadge toothNumber={toothId} size={40} />
              {cloneTargetsSorted.map((tid) => (
                <ToothBadge key={tid} toothNumber={tid} size={36} />
              ))}
              <Pressable onPress={onClose} hitSlop={10} className="px-1 py-1">
                <Text className="text-xl leading-none text-neutral-400">×</Text>
              </Pressable>
            </View>
          </View>

          {/* Add diagnosis — dropdown autocomplete */}
          <View className="flex-row items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5">
            <Text className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Add Diagnosis
            </Text>
            <DiagnosisTypesAutocomplete
              selectedValues={selectedProblems}
              selectedLabels={selectedLabels}
              onSelect={addCondition}
              onDeselect={(opt) => removeCondition(opt.value)}
              open={diagnosisOpen}
              onOpenChange={(open) => {
                setDiagnosisOpen(open);
                if (open) closeTreatmentPicker();
              }}
              placeholder="Search or type…"
            />
          </View>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 12 }}
        >
          {selectedProblems.length > 0 ? (
            <View className="flex-row items-center justify-between">
              <Text className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Conditions ({selectedProblems.length})
              </Text>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={expandAll}
                  className="rounded-md border border-neutral-300 bg-white px-2 py-1"
                >
                  <Text className="text-xs text-neutral-600">Expand all</Text>
                </Pressable>
                <Pressable
                  onPress={collapseAll}
                  className="rounded-md border border-neutral-300 bg-white px-2 py-1"
                >
                  <Text className="text-xs text-neutral-600">Collapse all</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {selectedProblems.map((problem) => {
            const d = drafts[problem];
            if (!d) return null;
            const isOpen = expanded.has(problem);
            const locked = isLocked(problem);
            const feeSum = treatmentFeeTotal(problem);
            const providerSum = (d.providers ?? []).reduce(
              (s, p) => s + (Number(p.fee) || 0),
              0
            );
            // Treatment fees + doctor fees (provider split starts at 0 until entered)
            const totalDisplay = feeSum + providerSum;

            return (
              <View
                key={problem}
                className="overflow-hidden rounded-xl border border-brand/20 bg-brand/5"
              >
                <Pressable
                  onPress={() =>
                    setExpanded((prev) => {
                      const n = new Set(prev);
                      if (n.has(problem)) n.delete(problem);
                      else n.add(problem);
                      return n;
                    })
                  }
                  className="flex-row items-center gap-2 px-3 py-3"
                >
                  <Text
                    className="flex-1 text-base font-semibold text-neutral-900"
                    numberOfLines={1}
                  >
                    {d.label || labelFor(problem)}
                  </Text>
                  <View className="rounded-full bg-sky-100 px-2 py-0.5">
                    <Text className="text-[11px] font-medium text-sky-800">
                      {statusBadge(d.status)}
                    </Text>
                  </View>
                  <View className="rounded-full bg-white px-2 py-0.5">
                    <Text className="text-[11px] text-neutral-700">
                      Total: ₹ {totalDisplay}
                    </Text>
                  </View>
                  {!locked ? (
                    <Pressable
                      onPress={() => removeCondition(problem)}
                      hitSlop={6}
                      className="px-1"
                    >
                      <Text className="text-sm text-red-500">✕</Text>
                    </Pressable>
                  ) : null}
                  <Text className="text-neutral-400">
                    {isOpen ? "▲" : "▼"}
                  </Text>
                </Pressable>

                {isOpen ? (
                  <View className="gap-3 border-t border-brand/10 bg-white px-3 pb-4 pt-3">
                    {locked ? (
                      <Text className="text-xs text-neutral-400">
                        Linked treatment is done — this condition is read-only.
                      </Text>
                    ) : null}

                    <View className="gap-1.5">
                      <Text className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                        Suggested treatment
                      </Text>
                      {!locked ? (
                        <View
                          ref={(node) => {
                            treatmentFieldRefs.current[problem] = node;
                          }}
                          collapsable={false}
                        >
                          <TextField
                            value={treatmentQuery[problem] ?? ""}
                            onChangeText={(v) => {
                              setTreatmentQuery((q) => ({
                                ...q,
                                [problem]: v,
                              }));
                              openTreatmentPicker(problem);
                            }}
                            onFocus={() => openTreatmentPicker(problem)}
                            onPressIn={() => openTreatmentPicker(problem)}
                            placeholder="Search or type a treatment…"
                            onSubmitEditing={() => {
                              const name = (
                                treatmentQuery[problem] ?? ""
                              ).trim();
                              if (!name) return;
                              const hit = catalogByName(catalog, name);
                              if (hit) {
                                toggleTreatment(
                                  problem,
                                  hit.name,
                                  hit.defaultFee,
                                  hit.maxDiscountPercent
                                );
                              } else {
                                toggleTreatment(problem, name);
                              }
                            }}
                          />
                        </View>
                      ) : null}

                      {d.treatments.map((row) => (
                        <View
                          key={row.id}
                          className="gap-2 rounded-xl border border-brand/25 p-3"
                          style={{ backgroundColor: "rgba(253, 0, 106, 0.08)" }}
                        >
                          <View className="flex-row items-center justify-between">
                            <Text className="flex-1 text-sm font-semibold text-brand">
                              {row.treatmentName}
                            </Text>
                            {!locked ? (
                              <Pressable
                                onPress={() =>
                                  removeTreatment(problem, row.id)
                                }
                              >
                                <Text className="text-sm text-red-500">✕</Text>
                              </Pressable>
                            ) : null}
                          </View>
                          <View className="flex-row gap-2">
                            <DateField
                              containerClassName="flex-1"
                              label="Date"
                              value={row.date || todayYmd()}
                              disabled={locked}
                              onChange={(v) =>
                                updateTreatment(problem, row.id, { date: v })
                              }
                            />
                            <TextField
                              containerClassName="flex-1"
                              label="Fees"
                              value={row.fee}
                              editable={!locked}
                              onChangeText={(v) =>
                                updateTreatment(problem, row.id, {
                                  fee: v.replace(/[^0-9.]/g, ""),
                                })
                              }
                              keyboardType="decimal-pad"
                              placeholder="0"
                            />
                            <TextField
                              containerClassName="w-20"
                              label="Disc %"
                              value={row.discountPct}
                              editable={!locked}
                              onChangeText={(v) =>
                                updateTreatment(problem, row.id, {
                                  discountPct: v.replace(/[^0-9.]/g, ""),
                                })
                              }
                              keyboardType="decimal-pad"
                              placeholder="0"
                            />
                          </View>
                        </View>
                      ))}
                    </View>

                    <TimeField
                      label="Planned time (optional)"
                      value={d.nextAppointmentTime}
                      disabled={locked}
                      onChange={(v) =>
                        updateDraft(problem, { nextAppointmentTime: v })
                      }
                      placeholder="Optional"
                    />

                    <TextField
                      label="Clinical note"
                      value={d.note}
                      editable={!locked}
                      onChangeText={(v) => updateDraft(problem, { note: v })}
                      placeholder="Clinical note…"
                      multiline
                      style={{ minHeight: 64, textAlignVertical: "top" }}
                    />

                    <ProviderFeeSplitEditor
                      facilityId={facilityId}
                      defaultDoctorId={defaultDoctorId}
                      disabled={locked}
                      additionalFeeTotal={feeSum}
                      showTotal
                      value={d.providers}
                      onChange={(next) =>
                        updateDraft(problem, { providers: next })
                      }
                    />
                  </View>
                ) : null}
              </View>
            );
          })}

          {localError ? (
            <Text className="text-sm text-red-500">{localError}</Text>
          ) : null}
          {!canSaveFindings && selectedProblems.length > 0 ? (
            <Text className="text-xs text-amber-700">
              Add a suggested treatment to each condition before saving.
            </Text>
          ) : null}
        </ScrollView>

        {/* Footer */}
        <View className="gap-3 border-t border-neutral-200 bg-white px-4 py-3">
          <Text className="text-[11px] leading-snug text-neutral-500">
            Use Add diagnosis in the header to add conditions. Expand a row to
            plan treatment, notes, and provider split (saved as planned). Pick
            extra teeth under Clone to teeth — they appear above and copy when
            you Save findings.
          </Text>
          <View className="flex-row flex-wrap items-center justify-end gap-2">
            {onClearTooth && selectedProblems.length > 0 ? (
              <Pressable
                onPress={confirmClearTooth}
                className="rounded-lg border border-red-200 px-3 py-2"
              >
                <Text className="text-sm font-medium text-red-600">
                  Delete tooth plan
                </Text>
              </Pressable>
            ) : null}
            <Button
              label="Cancel"
              variant="outline"
              size="md"
              onPress={onClose}
            />
            <Button
              label="Save"
              size="md"
              loading={saving}
              disabled={!canSaveFindings}
              onPress={() => void handleSave()}
            />
          </View>
        </View>
      </View>

      {/* Suggested treatment dropdown — outside tap closes; re-tap toggles off */}
      <AppModal
        visible={!!treatmentPickerOpenFor}
        transparent
        animationType="fade"
        onRequestClose={closeTreatmentPicker}
      >
        <View style={styles.pickerModalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeTreatmentPicker}
            accessibilityLabel="Close treatment dropdown"
          />
          {treatmentPickerOpenFor ? (
            <View
              style={[
                styles.pickerPanel,
                {
                  top: Math.max(8, treatmentPickerAnchor.y),
                  left: Math.max(8, treatmentPickerAnchor.x),
                  width: Math.min(
                    Math.max(treatmentPickerAnchor.width, 260),
                    420
                  ),
                },
              ]}
            >
              <TextField
                value={treatmentQuery[treatmentPickerOpenFor] ?? ""}
                onChangeText={(v) =>
                  setTreatmentQuery((q) => ({
                    ...q,
                    [treatmentPickerOpenFor]: v,
                  }))
                }
                placeholder="Search or type a treatment…"
                autoFocus
                onSubmitEditing={() => {
                  const problem = treatmentPickerOpenFor;
                  const name = (treatmentQuery[problem] ?? "").trim();
                  if (!name) return;
                  const hit = catalogByName(catalog, name);
                  if (hit) {
                    toggleTreatment(
                      problem,
                      hit.name,
                      hit.defaultFee,
                      hit.maxDiscountPercent
                    );
                  } else {
                    toggleTreatment(problem, name);
                  }
                }}
              />
              <View
                className="mt-1 overflow-hidden rounded-xl border border-neutral-200 bg-white"
                style={{ elevation: 8, maxHeight: 240 }}
              >
                {catalog.length === 0 ? (
                  <View className="px-3 py-3">
                    <Text className="text-sm text-neutral-500">
                      Loading treatments…
                    </Text>
                  </View>
                ) : suggestionsFor(treatmentPickerOpenFor).length === 0 &&
                  !(treatmentQuery[treatmentPickerOpenFor] ?? "").trim() ? (
                  <View className="px-3 py-3">
                    <Text className="text-sm text-neutral-500">
                      No treatments available.
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    style={{ maxHeight: 220 }}
                  >
                    {suggestionsFor(treatmentPickerOpenFor).map((item) => {
                      const selected = isTreatmentSelected(
                        treatmentPickerOpenFor,
                        item.name
                      );
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() =>
                            toggleTreatment(
                              treatmentPickerOpenFor,
                              item.name,
                              item.defaultFee,
                              item.maxDiscountPercent
                            )
                          }
                          style={
                            selected
                              ? {
                                  backgroundColor: "rgba(253, 0, 106, 0.14)",
                                }
                              : undefined
                          }
                          className={`flex-row items-center justify-between border-b border-neutral-100 px-3 py-2.5 ${
                            selected ? "" : "active:bg-neutral-50"
                          }`}
                        >
                          <Text
                            className={`flex-1 text-sm ${
                              selected
                                ? "font-semibold text-brand"
                                : "text-neutral-900"
                            }`}
                          >
                            {item.name}
                            {item.defaultFee != null
                              ? ` · ₹${item.defaultFee}`
                              : ""}
                          </Text>
                          {selected ? (
                            <Text className="ml-2 text-sm font-bold text-brand">
                              ✓
                            </Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                    {(treatmentQuery[treatmentPickerOpenFor] ?? "").trim() &&
                    !catalogByName(
                      catalog,
                      treatmentQuery[treatmentPickerOpenFor] ?? ""
                    ) ? (
                      <Pressable
                        onPress={() =>
                          toggleTreatment(
                            treatmentPickerOpenFor,
                            (
                              treatmentQuery[treatmentPickerOpenFor] ?? ""
                            ).trim()
                          )
                        }
                        className="px-3 py-2.5 active:bg-neutral-50"
                      >
                        <Text className="text-sm text-brand">
                          Use &quot;
                          {(treatmentQuery[treatmentPickerOpenFor] ?? "").trim()}
                          &quot; (custom)
                        </Text>
                      </Pressable>
                    ) : null}
                  </ScrollView>
                )}
              </View>
            </View>
          ) : null}
        </View>
      </AppModal>

      {/* Clone tooth picker */}
      <AppModal
        visible={clonePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setClonePickerOpen(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 px-6"
          onPress={() => setClonePickerOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="max-h-[70%] w-full overflow-hidden rounded-2xl bg-white"
          >
            <View className="border-b border-neutral-100 px-4 py-3">
              <Text className="text-base font-semibold text-neutral-900">
                Select target teeth
              </Text>
              <Text className="mt-1 text-xs text-neutral-500">
                Findings copy to these teeth when you Save. Source tooth{" "}
                {toothId} is excluded.
              </Text>
            </View>
            <ScrollView
              contentContainerStyle={{ padding: 12, gap: 4 }}
              style={{ maxHeight: 360 }}
            >
              {otherFdiTeeth.map((tid) => {
                const on = cloneTargetIds.includes(tid);
                return (
                  <Pressable
                    key={tid}
                    onPress={() => toggleCloneTarget(tid)}
                    className="flex-row items-center gap-3 rounded-lg px-2 py-2.5 active:bg-neutral-50"
                  >
                    <View
                      className={`h-5 w-5 items-center justify-center rounded border ${
                        on
                          ? "border-brand bg-brand"
                          : "border-neutral-300 bg-white"
                      }`}
                    >
                      {on ? (
                        <Text className="text-[10px] font-bold text-white">
                          ✓
                        </Text>
                      ) : null}
                    </View>
                    <Text className="text-sm text-neutral-900">
                      Tooth {tid}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View className="flex-row justify-end gap-2 border-t border-neutral-100 px-4 py-3">
              <Button
                label="Done"
                size="md"
                onPress={() => setClonePickerOpen(false)}
              />
            </View>
          </Pressable>
        </Pressable>
      </AppModal>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  pickerModalRoot: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  pickerPanel: {
    position: "absolute",
    zIndex: 2,
  },
});
