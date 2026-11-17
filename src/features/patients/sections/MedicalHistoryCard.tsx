import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { SectionChrome } from "@/features/consult/components/SectionChrome";
import { usePatientQuestionnaire } from "../hooks";
import {
  buildMedicalHistoryView,
  isYes,
  yesNo,
  type MedsAllergiesView,
  type PastHistoryView,
} from "../medicalHistory";

type YesTone = "brand" | "danger";

const BADGE = {
  no: { box: "border-neutral-300 bg-white", text: "text-neutral-600" },
  brand: { box: "border-brand bg-brand", text: "text-white" },
  danger: { box: "border-red-200 bg-red-50", text: "text-red-700" },
} as const;

function AnswerBadge({ value, yesTone }: { value: unknown; yesTone: YesTone }) {
  const answer = yesNo(value);
  if (!answer) return null;
  const tone = answer === "No" ? BADGE.no : BADGE[yesTone];
  return (
    <View className={`rounded-full border px-2 py-0.5 ${tone.box}`}>
      <Text className={`text-[11px] font-medium ${tone.text}`}>{answer}</Text>
    </View>
  );
}

function Item({
  icon,
  iconColor = "#6b7280",
  label,
  answer,
  yesTone = "brand",
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  /** Omit for a question with no Yes/No (medical conditions). */
  answer?: unknown;
  yesTone?: YesTone;
  children: ReactNode;
}) {
  return (
    <View className="min-w-[240px] flex-1 gap-1">
      <View className="flex-row flex-wrap items-center gap-2">
        <Ionicons name={icon} size={15} color={iconColor} />
        <Text className="text-sm font-medium text-neutral-500">{label}</Text>
        {answer !== undefined ? (
          <AnswerBadge value={answer} yesTone={yesTone} />
        ) : null}
      </View>
      <View className="pl-6">{children}</View>
    </View>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <Text className="text-sm italic text-neutral-500">{children}</Text>;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3 rounded-xl border border-neutral-100 p-3">
      <Text className="text-sm font-semibold tracking-wide text-neutral-900">
        {title}
      </Text>
      <View className="flex-row flex-wrap gap-4">{children}</View>
    </View>
  );
}

function PastHistory({ v }: { v: PastHistoryView }) {
  return (
    <Group title="Past medical history">
      <Item icon="pulse-outline" label="Medical conditions">
        {v.conditions.length ? (
          <View className="gap-1.5">
            {v.conditions.map((c, i) => (
              <View
                key={`${c.name}-${i}`}
                className="flex-row flex-wrap items-center gap-2"
              >
                <View className="rounded-full bg-neutral-100 px-2.5 py-0.5">
                  <Text className="text-sm text-neutral-800">{c.name}</Text>
                </View>
                {c.since ? (
                  <Text className="text-xs text-neutral-500">
                    Since: {c.since}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <Muted>None reported</Muted>
        )}
      </Item>
      <Item
        icon="document-text-outline"
        label="Previous surgeries"
        answer={v.hasSurgeries}
      >
        <Muted>
          {isYes(v.hasSurgeries)
            ? v.surgeryDetails || "Not specified"
            : "Not specified"}
        </Muted>
      </Item>
      <Item
        icon="heart-outline"
        label="Hospitalizations (past 5 years)"
        answer={v.hasHospitalizations}
      >
        <Muted>
          {isYes(v.hasHospitalizations)
            ? v.hospitalizationDetails || "Not specified"
            : "Not specified"}
        </Muted>
      </Item>
    </Group>
  );
}

function AllergyText({ yes, text }: { yes: boolean; text: string }) {
  return (
    <Text
      className={`text-sm italic ${
        yes ? "font-medium text-red-600" : "text-neutral-500"
      }`}
    >
      {yes ? text || "Not specified" : "Not specified"}
    </Text>
  );
}

function MedsAllergies({ v }: { v: MedsAllergiesView }) {
  const meds = isYes(v.takingMedicines) ? v.medicines : [];
  return (
    <Group title="Medications & allergies">
      <Item
        icon="medkit-outline"
        label="Current medications"
        answer={v.takingMedicines}
      >
        {meds.length ? (
          <View className="gap-0.5">
            {meds.map((m, i) => (
              <Text key={`${m}-${i}`} className="text-sm text-neutral-700">
                • {m}
              </Text>
            ))}
          </View>
        ) : (
          <Muted>Not specified</Muted>
        )}
      </Item>
      <Item
        icon="alert-circle-outline"
        iconColor="#dc2626"
        label="Medicine allergies"
        answer={v.allergicToMedicines}
        yesTone="danger"
      >
        <AllergyText
          yes={isYes(v.allergicToMedicines)}
          text={v.medicineAllergies}
        />
      </Item>
      {/* Practice's card does not show food allergies. Care already did, and
          dropping a recorded allergy from the chart would lose information. */}
      {yesNo(v.hasFoodAllergies) || v.foodAllergies ? (
        <Item
          icon="nutrition-outline"
          iconColor="#dc2626"
          label="Food allergies"
          answer={v.hasFoodAllergies}
          yesTone="danger"
        >
          <AllergyText yes={isYes(v.hasFoodAllergies)} text={v.foodAllergies} />
        </Item>
      ) : null}
    </Group>
  );
}

export function MedicalHistoryCard({
  patientId,
  canEdit,
  onEdit,
}: {
  /** Display or Mongo id accepted by questionnaire GET. */
  patientId: string;
  /** patient.write at this facility, and the patient still linked to it. */
  canEdit: boolean;
  onEdit: () => void;
}) {
  const q = usePatientQuestionnaire(patientId);
  const view = buildMedicalHistoryView(q.data);
  const loading = q.isLoading && q.data === undefined;

  return (
    <SectionChrome
      title="Medical history"
      icon="medkit-outline"
      right={
        canEdit ? (
          <Button
            label={q.data ? "Edit" : "Add"}
            variant="primary"
            size="md"
            className="shrink-0"
            disabled={loading}
            onPress={onEdit}
          />
        ) : undefined
      }
    >
      {loading ? (
        <View className="items-center py-4">
          <ActivityIndicator color="#FD006A" />
        </View>
      ) : q.isError ? (
        <Text className="text-sm text-red-500">{describeError(q.error)}</Text>
      ) : !view ? (
        <View className="items-center gap-1 py-4">
          <Ionicons name="clipboard-outline" size={24} color="#9ca3af" />
          <Text className="text-sm text-neutral-500">
            No questionnaire data available
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {view.past ? <PastHistory v={view.past} /> : null}
          {view.medsAllergies ? <MedsAllergies v={view.medsAllergies} /> : null}
        </View>
      )}
    </SectionChrome>
  );
}
