import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { FindingsTable } from "../components/FindingsTable";
import { FindingsSheet } from "../components/FindingsSheet";
import {
  buildPlanFromFinding,
  PlanEditorSheet,
} from "../components/PlanEditorSheet";
import { useDentalConsult } from "../DentalConsultContext";
import type { DentalTreatmentPlanRow, DiagnosisDetailsEntry } from "../types";

export function DentalFindingsSection() {
  const dental = useDentalConsult();
  const [planDraft, setPlanDraft] = useState<DentalTreatmentPlanRow | null>(
    null
  );
  const [planFinding, setPlanFinding] =
    useState<DiagnosisDetailsEntry | null>(null);

  const onTreat = (entry: DiagnosisDetailsEntry) => {
    const existing = dental.planItems.filter(
      (p) => p.diagnosisEntryId === entry.id
    );
    if (existing.length > 0) {
      setPlanFinding(entry);
      setPlanDraft(existing[0]);
      return;
    }
    setPlanFinding(entry);
    setPlanDraft(buildPlanFromFinding(entry, dental.defaultDoctorId));
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
      <Text className="text-lg font-semibold text-neutral-900">Findings</Text>

      <FindingsTable
        entries={dental.entries}
        planItems={dental.planItems}
        onEdit={dental.openTooth}
        onTreat={onTreat}
        onDelete={(id) => void dental.deleteFinding(id)}
      />

      {dental.error ? (
        <Text className="text-sm text-red-500">{dental.error}</Text>
      ) : null}
      {dental.statusMsg ? (
        <Text className="text-sm text-emerald-600">{dental.statusMsg}</Text>
      ) : null}

      <FindingsSheet
        visible={dental.findingsOpen}
        toothId={dental.selectedTooth}
        entries={dental.entries}
        diagnosisOptions={dental.diagnosisOptions}
        catalog={dental.catalog}
        defaultDoctorId={dental.defaultDoctorId}
        saving={dental.saving}
        onClose={dental.closeFindings}
        onSave={dental.saveFindings}
        onClearTooth={dental.clearTooth}
      />

      <PlanEditorSheet
        visible={!!planDraft}
        row={planDraft}
        catalog={dental.catalog}
        finding={planFinding}
        defaultDoctorId={dental.defaultDoctorId}
        saving={dental.saving}
        onClose={() => {
          setPlanDraft(null);
          setPlanFinding(null);
        }}
        onSave={(row) => {
          const next = dental.planItems.some((p) => p.id === row.id)
            ? dental.planItems.map((p) => (p.id === row.id ? row : p))
            : [...dental.planItems, row];
          void dental.savePlan(next).then(() => {
            setPlanDraft(null);
            setPlanFinding(null);
          });
        }}
      />
    </View>
  );
}
