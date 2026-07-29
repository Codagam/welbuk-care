import { ActivityIndicator, Text, View } from "react-native";

import { Button } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { SectionChrome } from "@/features/consult/components/SectionChrome";
import { usePatientQuestionnaire } from "../hooks";
import type { PatientQuestionnaire, QuestionnaireField } from "../types";

function fieldText(f?: QuestionnaireField | null): string {
  if (!f) return "—";
  const sel = f.selectedValue;
  const selected = Array.isArray(sel)
    ? sel.filter(Boolean).join(", ")
    : String(sel ?? "").trim();
  const input = String(f.inputValue ?? "").trim();
  if (selected && input) return `${selected}: ${input}`;
  return selected || input || "—";
}

function summarize(q: PatientQuestionnaire | null | undefined): string[] {
  if (!q) return [];
  const lines: string[] = [];
  const mh = q.medicalHistory as Record<string, unknown> | null | undefined;
  if (mh?.pastConditions) {
    lines.push(
      `Past conditions — ${fieldText(mh.pastConditions as QuestionnaireField)}`
    );
  }
  if (mh?.surgeries) {
    lines.push(`Surgeries — ${fieldText(mh.surgeries as QuestionnaireField)}`);
  }
  if (q.allergies?.medicineAllergies) {
    lines.push(
      `Medicine allergies — ${fieldText(q.allergies.medicineAllergies)}`
    );
  }
  if (q.allergies?.foodAllergies) {
    lines.push(`Food allergies — ${fieldText(q.allergies.foodAllergies)}`);
  }
  if (q.CurrentMedications?.medications) {
    lines.push(
      `Current meds — ${fieldText(q.CurrentMedications.medications)}`
    );
  }
  const insurance = (mh?.insurance ?? null) as
    | Record<string, unknown>
    | null
    | undefined;
  if (insurance?.hasInsurance) {
    const name =
      String(insurance.insuranceName ?? insurance.type ?? "").trim() || "Yes";
    lines.push(`Insurance — ${String(insurance.hasInsurance)} (${name})`);
  }
  return lines;
}

export function MedicalHistoryCard({
  patientId,
  onEdit,
}: {
  /** Display or Mongo id accepted by questionnaire GET. */
  patientId: string;
  onEdit: () => void;
}) {
  const q = usePatientQuestionnaire(patientId);
  const lines = summarize(q.data);

  return (
    <SectionChrome
      title="Medical history"
      icon="medkit-outline"
      right={
        <Button
          label={lines.length ? "Edit" : "Add"}
          variant="primary"
          size="md"
          className="shrink-0"
          onPress={onEdit}
        />
      }
    >
      {q.isLoading && q.data === undefined ? (
        <View className="items-center py-4">
          <ActivityIndicator color="#FD006A" />
        </View>
      ) : q.isError ? (
        <Text className="text-sm text-red-500">{describeError(q.error)}</Text>
      ) : lines.length === 0 ? (
        <Text className="text-xs italic text-neutral-500">
          No questionnaire on file. Tap Add to capture history, allergies, meds,
          and insurance.
        </Text>
      ) : (
        <View className="gap-2">
          {lines.map((line) => (
            <Text key={line} className="text-xs text-neutral-800">
              {line}
            </Text>
          ))}
        </View>
      )}
    </SectionChrome>
  );
}
