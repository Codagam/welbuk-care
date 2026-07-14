import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Button } from "@/ui";
import { PlanEditorSheet } from "../components/PlanEditorSheet";
import { useDentalConsult } from "../DentalConsultContext";
import type { DentalTreatmentPlanRow } from "../types";
import { isPlanBillable, randomId, todayYmd } from "../utils";

export function DentalPlanSection() {
  const dental = useDentalConsult();
  const [editRow, setEditRow] = useState<DentalTreatmentPlanRow | null>(null);

  const billable = dental.planItems.filter(isPlanBillable);
  const total = billable.reduce(
    (s, i) =>
      s + (i.totalFee ?? i.providers.reduce((a, p) => a + (p.fee || 0), 0)),
    0
  );

  const addStandalone = () => {
    setEditRow({
      id: randomId(),
      treatmentName: "",
      plannedDate: todayYmd(),
      plannedTime: "10:00",
      status: "planned",
      providers: [{ doctorId: "", role: "Primary", fee: 0 }],
      totalFee: 0,
      selectedActuals: [],
    });
  };

  if (dental.loading) {
    return (
      <View className="items-center py-10">
        <ActivityIndicator color="#FD006A" />
      </View>
    );
  }

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-neutral-900">
          Treatment plan
        </Text>
        <Text className="text-sm font-semibold text-brand">₹{total}</Text>
      </View>

      {dental.planItems.length === 0 ? (
        <Text className="text-sm text-neutral-400">
          No plan rows yet. Use Treat on a finding, or add a standalone
          treatment.
        </Text>
      ) : (
        dental.planItems.map((it) => {
          const fee =
            it.totalFee ??
            it.providers.reduce((s, p) => s + (p.fee || 0), 0);
          return (
            <Pressable
              key={it.id}
              onPress={() => setEditRow(it)}
              className="gap-2 rounded-2xl border border-neutral-200 bg-white p-4 active:bg-neutral-50"
            >
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1 gap-1">
                  <Text className="text-base font-semibold text-neutral-900">
                    {it.treatmentName || "Untitled treatment"}
                  </Text>
                  {it.findingSummary?.tooth ? (
                    <Text className="text-sm text-neutral-500">
                      {it.findingSummary.tooth}
                      {it.findingSummary.conditionsText
                        ? ` · ${it.findingSummary.conditionsText}`
                        : ""}
                    </Text>
                  ) : (
                    <Text className="text-sm text-neutral-400">Standalone</Text>
                  )}
                </View>
                <View className="items-end gap-1">
                  <View className="rounded-full bg-neutral-100 px-2 py-0.5">
                    <Text className="text-xs text-neutral-600">{it.status}</Text>
                  </View>
                  <Text className="text-sm font-semibold text-neutral-900">
                    ₹{fee}
                  </Text>
                </View>
              </View>
              {it.plannedDate ? (
                <Text className="text-xs text-neutral-400">
                  Planned {it.plannedDate}
                  {it.plannedTime ? ` ${it.plannedTime}` : ""}
                </Text>
              ) : null}
            </Pressable>
          );
        })
      )}

      <Button label="+ Add treatment" variant="outline" onPress={addStandalone} />

      {dental.error ? (
        <Text className="text-sm text-red-500">{dental.error}</Text>
      ) : null}
      {dental.statusMsg ? (
        <Text className="text-sm text-emerald-600">{dental.statusMsg}</Text>
      ) : null}

      <Text className="text-center text-xs text-neutral-400">
        Only &quot;done&quot; (and in-progress with a fee) rows are billed on
        save.
      </Text>

      <PlanEditorSheet
        visible={!!editRow}
        row={editRow}
        catalog={dental.catalog}
        finding={
          editRow?.diagnosisEntryId
            ? dental.entries.find((e) => e.id === editRow.diagnosisEntryId) ??
              null
            : null
        }
        facilityId={dental.facilityId}
        defaultDoctorId={dental.defaultDoctorId}
        saving={dental.saving}
        onClose={() => setEditRow(null)}
        onSave={(row) => {
          const next = dental.planItems.some((p) => p.id === row.id)
            ? dental.planItems.map((p) => (p.id === row.id ? row : p))
            : [...dental.planItems, row];
          void dental.savePlan(next).then(() => setEditRow(null));
        }}
      />
    </View>
  );
}
