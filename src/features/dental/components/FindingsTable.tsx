import { Pressable, Text, View } from "react-native";

import { Button } from "@/ui";
import { formatConditionLabel } from "../problems";
import type { DentalTreatmentPlanRow, DiagnosisDetailsEntry } from "../types";
import { doneDiagnosisEntryIds, toDateOnly } from "../utils";

type Props = {
  entries: DiagnosisDetailsEntry[];
  planItems: DentalTreatmentPlanRow[];
  onEdit: (toothId: string) => void;
  onTreat: (entry: DiagnosisDetailsEntry) => void;
  onDelete: (id: string) => void;
  deleting?: boolean;
  locked?: boolean;
};

const STATUS_LABEL = {
  planned: "Planned",
  "in-progress": "In progress",
  done: "Done",
} as const;

const STATUS_PILL = {
  planned: { bg: "bg-neutral-100", text: "text-neutral-600" },
  "in-progress": { bg: "bg-amber-50", text: "text-amber-700" },
  done: { bg: "bg-emerald-50", text: "text-emerald-700" },
} as const;

/**
 * A finding's status as Practice shows it: driven by its linked treatment row.
 * Treating on the plan never writes back to `entry.treatmentStatus`, so reading
 * that field alone left every finding on "planned" after treatment.
 */
function findingDisplayStatus(
  entry: DiagnosisDetailsEntry,
  planItems: DentalTreatmentPlanRow[]
): keyof typeof STATUS_LABEL {
  const linked = planItems.filter((p) => p.diagnosisEntryId === entry.id);
  if (linked.some((p) => p.status === "done")) return "done";
  if (linked.some((p) => p.status === "in-progress")) return "in-progress";
  return entry.treatmentStatus ?? "planned";
}

/** Suggested names already ticked as Treated on the linked plan row(s). */
function treatedNamesFor(
  entry: DiagnosisDetailsEntry,
  planItems: DentalTreatmentPlanRow[]
): Set<string> {
  const out = new Set<string>();
  for (const p of planItems) {
    if (p.diagnosisEntryId !== entry.id) continue;
    for (const a of p.selectedActuals ?? []) {
      const n = a.name.trim().toLowerCase();
      if (n) out.add(n);
    }
  }
  return out;
}

function earliestDate(e: DiagnosisDetailsEntry): string {
  const dates = Object.values(e.suggestedTreatmentNextDates ?? {})
    .map(toDateOnly)
    .filter(Boolean);
  if (e.nextAppointmentDate) dates.push(toDateOnly(e.nextAppointmentDate));
  if (dates.length === 0) return "9999-99-99";
  return dates.sort()[0];
}

export function FindingsTable({
  entries,
  planItems,
  onEdit,
  onTreat,
  onDelete,
  locked = false,
}: Props) {
  const doneIds = doneDiagnosisEntryIds(planItems);

  const sorted = [...entries].sort((a, b) => {
    const t = a.toothId.localeCompare(b.toothId);
    if (t !== 0) return t;
    return earliestDate(a).localeCompare(earliestDate(b));
  });

  if (sorted.length === 0) {
    return (
      <Text className="text-center text-sm text-neutral-400">
        No findings yet. Tap a tooth on the Chart tab to add conditions.
      </Text>
    );
  }

  let lastTooth = "";

  return (
    <View className="gap-3">
      {sorted.map((e) => {
        const showTooth = e.toothId !== lastTooth;
        lastTooth = e.toothId;
        const treatDisabled = doneIds.has(e.id);
        const treatments = e.suggestedTreatments?.filter(Boolean) ?? [];
        const status = findingDisplayStatus(e, planItems);
        const treated = treatedNamesFor(e, planItems);

        return (
          <View key={e.id} className="gap-1">
            {showTooth ? (
              <Text className="mt-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Tooth {e.toothId}
              </Text>
            ) : null}
            <View className="gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1 gap-1">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <View className="rounded-full bg-brand/10 px-2.5 py-1">
                      <Text className="text-xs font-semibold text-brand">
                        {e.toothId}
                      </Text>
                    </View>
                    <Text className="text-base font-semibold text-neutral-900">
                      {formatConditionLabel(e.problem)}
                    </Text>
                    <View
                      className={`rounded-full px-2 py-0.5 ${STATUS_PILL[status].bg}`}
                    >
                      <Text
                        className={`text-xs font-medium ${STATUS_PILL[status].text}`}
                      >
                        {STATUS_LABEL[status]}
                      </Text>
                    </View>
                  </View>
                  {e.note ? (
                    <Text className="text-sm text-neutral-500" numberOfLines={2}>
                      {e.note}
                    </Text>
                  ) : null}
                </View>
              </View>

              {treatments.length > 0 ? (
                <View className="gap-1.5">
                  {treatments.map((name) => {
                    const fee = e.suggestedTreatmentFees?.[name];
                    const date = toDateOnly(
                      e.suggestedTreatmentNextDates?.[name]
                    );
                    const isTreated = treated.has(name.trim().toLowerCase());
                    return (
                      <View
                        key={name}
                        className="flex-row flex-wrap items-center gap-2"
                      >
                        <View className="rounded-md bg-neutral-100 px-2 py-1">
                          <Text className="text-sm font-medium text-neutral-800">
                            {name}
                          </Text>
                        </View>
                        {fee != null ? (
                          <Text className="text-sm text-neutral-600">
                            ₹{fee}
                          </Text>
                        ) : null}
                        {date ? (
                          <Text className="text-sm text-neutral-500">
                            {date.split("-").reverse().join("-")}
                          </Text>
                        ) : null}
                        <Text
                          className={
                            isTreated
                              ? "text-xs font-medium text-emerald-700"
                              : "text-xs font-medium text-amber-700"
                          }
                        >
                          {isTreated ? "Treated" : "Pending"}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              <View className="flex-row flex-wrap items-center gap-2">
                <Button
                  label="Edit"
                  variant="outline"
                  size="md"
                  onPress={() => onEdit(e.toothId)}
                  disabled={locked}
                />
                <Button
                  label="Treat"
                  size="md"
                  onPress={() => onTreat(e)}
                  disabled={treatDisabled || locked}
                />
                <Pressable
                  onPress={() => onDelete(e.id)}
                  disabled={locked}
                  style={{ flexShrink: 0 }}
                  className={`justify-center px-3 py-2 ${locked ? "opacity-40" : ""}`}
                >
                  <Text numberOfLines={1} className="text-sm text-red-500">
                    Delete
                  </Text>
                </Pressable>
              </View>
              {treatDisabled ? (
                <Text className="text-xs text-neutral-400">
                  Linked treatment is done — Treat disabled.
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
