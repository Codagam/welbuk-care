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
};

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
                    <View className="rounded-full bg-neutral-100 px-2 py-0.5">
                      <Text className="text-xs text-neutral-600">
                        {e.treatmentStatus ?? "planned"}
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
                <View className="gap-1">
                  {treatments.map((name) => {
                    const fee = e.suggestedTreatmentFees?.[name];
                    const date = toDateOnly(
                      e.suggestedTreatmentNextDates?.[name]
                    );
                    return (
                      <Text key={name} className="text-sm text-neutral-700">
                        · {name}
                        {fee != null ? ` · ₹${fee}` : ""}
                        {date ? ` · ${date}` : ""}
                      </Text>
                    );
                  })}
                </View>
              ) : null}

              <View className="flex-row flex-wrap gap-2">
                <Button
                  label="Edit"
                  variant="outline"
                  onPress={() => onEdit(e.toothId)}
                  className="min-w-[88px]"
                />
                <Button
                  label="Treat"
                  onPress={() => onTreat(e)}
                  disabled={treatDisabled}
                  className="min-w-[88px]"
                />
                <Pressable
                  onPress={() => onDelete(e.id)}
                  className="justify-center px-3"
                >
                  <Text className="text-sm text-red-500">Delete</Text>
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
