import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button, Segmented, TextField } from "@/ui";
import { getProblemLabel } from "../problems";
import type {
  DiagnosisDetailsEntry,
  DiagnosisOption,
  FindingStatus,
  SuggestedTreatmentPlanRow,
  TreatmentCatalogItem,
  TreatmentProvider,
} from "../types";
import {
  applyDiscount,
  feeStringFromCatalogDefault,
  randomId,
  todayYmd,
  toDateOnly,
} from "../utils";

type ConditionDraft = {
  problem: string;
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
  diagnosisOptions: DiagnosisOption[];
  catalog: TreatmentCatalogItem[];
  defaultDoctorId: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (nextEntries: DiagnosisDetailsEntry[]) => Promise<boolean>;
  onClearTooth?: (toothId: string) => Promise<boolean>;
};

const STATUS: FindingStatus[] = ["planned", "in-progress", "done"];

function emptyDraft(
  problem: string,
  doctorId: string,
  existing?: DiagnosisDetailsEntry
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
    note: existing?.note ?? "",
    status: existing?.treatmentStatus ?? "planned",
    nextAppointmentDate: toDateOnly(existing?.nextAppointmentDate) || today,
    nextAppointmentTime: existing?.nextAppointmentTime ?? "",
    nextAppointmentReason: existing?.nextAppointmentReason ?? "",
    treatments,
    fee: existing?.fee ?? 0,
    providers:
      existing?.treatmentProviders?.length
        ? existing.treatmentProviders
        : doctorId
          ? [{ doctorId, role: "Primary", fee: existing?.fee ?? 0 }]
          : [],
    existingId: existing?.id,
  };
}

function catalogByName(catalog: TreatmentCatalogItem[], name: string) {
  const n = name.trim().toLowerCase();
  return catalog.find((c) => c.name.trim().toLowerCase() === n);
}

export function FindingsSheet({
  visible,
  toothId,
  entries,
  diagnosisOptions,
  catalog,
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !toothId) return;
    const forTooth = entries.filter((e) => e.toothId === toothId);
    const problems = forTooth.map((e) => e.problem);
    setSelectedProblems(problems);
    const next: Record<string, ConditionDraft> = {};
    for (const e of forTooth) {
      next[e.problem] = emptyDraft(e.problem, defaultDoctorId, e);
    }
    setDrafts(next);
    setExpanded(problems[0] ?? null);
    setTreatmentQuery({});
    setLocalError(null);
    // Re-hydrate only when opening / changing tooth — not on every entries tick while editing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, toothId, defaultDoctorId]);

  const toggleProblem = (value: string) => {
    setSelectedProblems((prev) => {
      if (prev.includes(value)) {
        setDrafts((d) => {
          const n = { ...d };
          delete n[value];
          return n;
        });
        return prev.filter((p) => p !== value);
      }
          setDrafts((d) => ({
            ...d,
            [value]:
              d[value] ??
              emptyDraft(
                value,
                defaultDoctorId,
                entries.find(
                  (e) => e.toothId === toothId && e.problem === value
                )
              ),
          }));
      setExpanded(value);
      return [...prev, value];
    });
  };

  const updateDraft = (problem: string, patch: Partial<ConditionDraft>) => {
    setDrafts((d) => ({
      ...d,
      [problem]: { ...d[problem], ...patch },
    }));
  };

  const addTreatment = (
    problem: string,
    name: string,
    catalogDefaultFee?: number,
    catalogMaxDiscountPercent?: number | null
  ) => {
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
    const providers =
      draft.providers.length > 0
        ? draft.providers.map((p, i) =>
            i === 0 ? { ...p, fee: feeSum } : p
          )
        : defaultDoctorId
          ? [{ doctorId: defaultDoctorId, role: "Primary", fee: feeSum }]
          : [];
    updateDraft(problem, { treatments, fee: feeSum, providers });
    setTreatmentQuery((q) => ({ ...q, [problem]: "" }));
  };

  const updateTreatment = (
    problem: string,
    rowId: string,
    patch: Partial<SuggestedTreatmentPlanRow>
  ) => {
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
    const providers = draft.providers.map((p, i) =>
      i === 0 ? { ...p, fee: feeSum } : p
    );
    updateDraft(problem, { treatments, fee: feeSum, providers });
  };

  const removeTreatment = (problem: string, rowId: string) => {
    const draft = drafts[problem];
    if (!draft) return;
    const treatments = draft.treatments.filter((t) => t.id !== rowId);
    const feeSum = treatments.reduce((s, t) => s + (Number(t.fee) || 0), 0);
    const providers = draft.providers.map((p, i) =>
      i === 0 ? { ...p, fee: feeSum } : p
    );
    updateDraft(problem, { treatments, fee: feeSum, providers });
  };

  const handleSave = async () => {
    if (!toothId) return;
    if (selectedProblems.length === 0) {
      setLocalError("Select at least one condition, or clear the tooth.");
      return;
    }
    setLocalError(null);

    const rest = entries.filter((e) => e.toothId !== toothId);
    const built: DiagnosisDetailsEntry[] = selectedProblems.map((problem) => {
      const d = drafts[problem] ?? emptyDraft(problem, defaultDoctorId);
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
        treatmentProviders:
          d.providers.length > 0
            ? d.providers
            : defaultDoctorId
              ? [
                  {
                    doctorId: defaultDoctorId,
                    role: "Primary",
                    fee: feeSum || 0,
                  },
                ]
              : undefined,
      };
    });

    await onSave([...rest, ...built]);
  };

  const suggestionsFor = (problem: string) => {
    const q = (treatmentQuery[problem] ?? "").trim().toLowerCase();
    if (!q) return catalog.slice(0, 8);
    return catalog
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 8);
  };

  if (!toothId) return null;

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
            Tooth {toothId}
          </Text>
          <View className="flex-row items-center gap-3">
            {onClearTooth ? (
              <Pressable
                onPress={() => void onClearTooth(toothId)}
                hitSlop={8}
              >
                <Text className="text-sm text-red-500">Clear tooth</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onClose} hitSlop={8}>
              <Text className="text-sm text-neutral-500">Cancel</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
        >
          <View className="gap-2">
            <Text className="text-sm font-medium text-neutral-700">
              Conditions
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {diagnosisOptions.map((opt) => {
                const on = selectedProblems.includes(opt.value);
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => toggleProblem(opt.value)}
                    style={{ flexShrink: 0 }}
                    className={`rounded-full px-3 py-2 ${
                      on ? "bg-brand" : "bg-white border border-neutral-300"
                    }`}
                  >
                    <Text
                      numberOfLines={1}
                      className={`text-sm ${
                        on ? "text-brand-foreground font-medium" : "text-neutral-700"
                      }`}
                    >
                      {opt.label || getProblemLabel(opt.value)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {selectedProblems.map((problem) => {
            const d = drafts[problem];
            if (!d) return null;
            const isOpen = expanded === problem;
            return (
              <View
                key={problem}
                className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
              >
                <Pressable
                  onPress={() => setExpanded(isOpen ? null : problem)}
                  className="flex-row items-center justify-between px-4 py-3"
                >
                  <Text className="text-base font-semibold text-neutral-900">
                    {getProblemLabel(problem)}
                  </Text>
                  <Text className="text-neutral-400">{isOpen ? "▲" : "▼"}</Text>
                </Pressable>

                {isOpen ? (
                  <View className="gap-3 border-t border-neutral-100 px-4 pb-4 pt-3">
                    <TextField
                      label="Clinical note"
                      value={d.note}
                      onChangeText={(v) => updateDraft(problem, { note: v })}
                      placeholder="e.g. occlusal decay"
                      multiline
                      style={{ minHeight: 64, textAlignVertical: "top" }}
                    />

                    <View className="gap-1.5">
                      <Text className="text-sm font-medium text-neutral-700">
                        Suggested treatments
                      </Text>
                      <TextField
                        value={treatmentQuery[problem] ?? ""}
                        onChangeText={(v) =>
                          setTreatmentQuery((q) => ({ ...q, [problem]: v }))
                        }
                        placeholder="Search catalog or type custom…"
                        onSubmitEditing={() => {
                          const name = (treatmentQuery[problem] ?? "").trim();
                          if (!name) return;
                          const hit = catalogByName(catalog, name);
                          if (hit) {
                            addTreatment(
                              problem,
                              hit.name,
                              hit.defaultFee,
                              hit.maxDiscountPercent
                            );
                          } else {
                            addTreatment(problem, name);
                          }
                        }}
                      />
                      {(treatmentQuery[problem] ?? "").trim() ? (
                        <View className="overflow-hidden rounded-xl border border-neutral-200">
                          {suggestionsFor(problem).map((item) => (
                            <Pressable
                              key={item.id}
                              onPress={() =>
                                addTreatment(
                                  problem,
                                  item.name,
                                  item.defaultFee,
                                  item.maxDiscountPercent
                                )
                              }
                              className="border-b border-neutral-100 px-3 py-2.5 active:bg-neutral-50"
                            >
                              <Text className="text-sm text-neutral-900">
                                {item.name}
                                {item.defaultFee != null
                                  ? ` · ₹${item.defaultFee}`
                                  : ""}
                              </Text>
                            </Pressable>
                          ))}
                          {!catalogByName(
                            catalog,
                            treatmentQuery[problem] ?? ""
                          ) ? (
                            <Pressable
                              onPress={() =>
                                addTreatment(
                                  problem,
                                  (treatmentQuery[problem] ?? "").trim()
                                )
                              }
                              className="px-3 py-2.5 active:bg-neutral-50"
                            >
                              <Text className="text-sm text-brand">
                                Use &quot;{(treatmentQuery[problem] ?? "").trim()}&quot;
                                (custom)
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ) : null}

                      {d.treatments.map((row) => (
                        <View
                          key={row.id}
                          className="gap-2 rounded-xl border border-neutral-100 bg-neutral-50 p-3"
                        >
                          <View className="flex-row items-center justify-between">
                            <Text className="flex-1 text-sm font-medium text-neutral-900">
                              {row.treatmentName}
                            </Text>
                            <Pressable
                              onPress={() => removeTreatment(problem, row.id)}
                            >
                              <Text className="text-sm text-red-500">Remove</Text>
                            </Pressable>
                          </View>
                          <View className="flex-row gap-2">
                            <TextField
                              containerClassName="flex-1"
                              label="Date"
                              value={row.date}
                              onChangeText={(v) =>
                                updateTreatment(problem, row.id, { date: v })
                              }
                              placeholder="YYYY-MM-DD"
                            />
                            <TextField
                              containerClassName="flex-1"
                              label="Fee (₹)"
                              value={row.fee}
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

                    <View className="flex-row gap-2">
                      <TextField
                        containerClassName="flex-1"
                        label="Next date"
                        value={d.nextAppointmentDate}
                        onChangeText={(v) =>
                          updateDraft(problem, { nextAppointmentDate: v })
                        }
                        placeholder="YYYY-MM-DD"
                      />
                      <TextField
                        containerClassName="w-28"
                        label="Time"
                        value={d.nextAppointmentTime}
                        onChangeText={(v) =>
                          updateDraft(problem, { nextAppointmentTime: v })
                        }
                        placeholder="HH:mm"
                      />
                    </View>
                    <TextField
                      label="Next visit reason"
                      value={d.nextAppointmentReason}
                      onChangeText={(v) =>
                        updateDraft(problem, { nextAppointmentReason: v })
                      }
                      placeholder="Optional"
                    />

                    <View className="gap-1.5">
                      <Text className="text-sm font-medium text-neutral-700">
                        Status
                      </Text>
                      <Segmented
                        options={STATUS}
                        value={d.status}
                        onChange={(s) =>
                          updateDraft(problem, { status: s as FindingStatus })
                        }
                      />
                    </View>

                    <TextField
                      label="Aggregate fee (₹)"
                      value={d.fee ? String(d.fee) : ""}
                      onChangeText={(v) =>
                        updateDraft(problem, {
                          fee: Number(v.replace(/[^0-9.]/g, "")) || 0,
                        })
                      }
                      keyboardType="decimal-pad"
                      placeholder="Sum of treatments"
                    />
                  </View>
                ) : null}
              </View>
            );
          })}

          {localError ? (
            <Text className="text-sm text-red-500">{localError}</Text>
          ) : null}

          <Button
            label="Save findings"
            onPress={() => void handleSave()}
            loading={saving}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}
