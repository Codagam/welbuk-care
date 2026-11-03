import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type {
  AllergyRecord,
  MedicalCondition,
  MedicationRecord,
  PastHistory,
  PastHistoryAnswer,
} from "../types";
import { SectionChrome } from "./SectionChrome";

function asNamedList(
  items: unknown,
  nameKeys: string[] = ["name"]
): { name: string; extra?: string }[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === "string") return { name: item };
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const name =
          nameKeys.map((k) => o[k]).find((v) => typeof v === "string") ??
          o.allergen ??
          o.drugName ??
          o.title;
        if (typeof name !== "string" || !name.trim()) return null;
        return {
          name: name.trim(),
          extra:
            (typeof o.since === "string" && o.since) ||
            (typeof o.dosage === "string" && o.dosage) ||
            (typeof o.severity === "string" && o.severity) ||
            undefined,
        };
      }
      return null;
    })
    .filter(Boolean) as { name: string; extra?: string }[];
}

function RecordGroup({
  icon,
  label,
  children,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  children: ReactNode;
  isLast?: boolean;
}) {
  return (
    <View className={isLast ? "gap-1.5" : "gap-1.5 pb-3"}>
      <View className="flex-row items-center gap-1.5">
        <Ionicons name={icon} size={14} color="#FD006A" />
        <Text className="text-xs font-medium text-neutral-500">{label}</Text>
      </View>
      {children}
    </View>
  );
}

function PastHistoryText({ value }: { value: PastHistoryAnswer }) {
  return (
    <Text className="pl-5 text-sm text-neutral-900">
      <Text className="font-semibold">{value.answer}</Text>
      {value.details ? ` — ${value.details}` : ""}
    </Text>
  );
}

export function PatientRecordsCard({
  medicalHistory,
  medications,
  allergies,
  pastHistory,
}: {
  medicalHistory?: MedicalCondition[] | unknown;
  medications?: MedicationRecord[] | unknown[];
  allergies?: AllergyRecord[] | unknown[];
  pastHistory?: PastHistory | null;
}) {
  const history = asNamedList(medicalHistory);
  const meds = asNamedList(medications);
  const previousSurgeries = pastHistory?.previousSurgeries ?? null;
  const hospitalizations = pastHistory?.hospitalizations ?? null;
  // Names only, as in Practice. The intake form has no severity field and the
  // Allergy table defaults every row to MODERATE, so a grade here would be one nobody
  // recorded. Allergies print even when the rest of the record is empty.
  const allergyItems = Array.isArray(allergies)
    ? allergies.map((a) => {
        if (typeof a === "string") return { name: a };
        const o = a as AllergyRecord & Record<string, unknown>;
        return {
          name:
            o.name ||
            (typeof o.allergen === "string" ? o.allergen : "") ||
            "—",
        };
      })
    : [];

  const hasAny =
    history.length > 0 ||
    meds.length > 0 ||
    allergyItems.length > 0 ||
    previousSurgeries != null ||
    hospitalizations != null;

  if (!hasAny) {
    return (
      <SectionChrome
        title="Patient Records"
        emptyBorder
        collapsible
        defaultOpen
      >
        <Text className="text-xs italic text-neutral-500">
          No patient records
        </Text>
      </SectionChrome>
    );
  }

  const groups = [
    history.length > 0,
    meds.length > 0,
    allergyItems.length > 0,
    previousSurgeries != null,
    hospitalizations != null,
  ].filter(Boolean).length;

  let shown = 0;

  return (
    <SectionChrome title="Patient Records" collapsible defaultOpen>
      <View className="gap-0">
        {history.length > 0 ? (
          <RecordGroup
            icon="pulse-outline"
            label="Medical History"
            isLast={++shown === groups}
          >
            <View className="gap-1 pl-5">
              {history.map((item, idx) => (
                <Text key={idx} className="text-sm text-neutral-900">
                  <Text className="font-semibold">{item.name}</Text>
                  {item.extra ? (
                    <Text className="text-neutral-500">
                      {" "}
                      (Since {item.extra})
                    </Text>
                  ) : null}
                </Text>
              ))}
            </View>
          </RecordGroup>
        ) : null}

        {previousSurgeries ? (
          <RecordGroup
            icon="cut-outline"
            label="Previous Surgeries"
            isLast={++shown === groups}
          >
            <PastHistoryText value={previousSurgeries} />
          </RecordGroup>
        ) : null}

        {hospitalizations ? (
          <RecordGroup
            icon="business-outline"
            label="Hospitalizations (Past 5 Years)"
            isLast={++shown === groups}
          >
            <PastHistoryText value={hospitalizations} />
          </RecordGroup>
        ) : null}

        {meds.length > 0 ? (
          <RecordGroup
            icon="medkit-outline"
            label="Current Medications"
            isLast={++shown === groups}
          >
            <View className="gap-1 pl-5">
              {meds.map((item, idx) => (
                <Text key={idx} className="text-sm text-neutral-900">
                  <Text className="font-semibold">{item.name}</Text>
                  {item.extra ? (
                    <Text className="text-neutral-500"> ({item.extra})</Text>
                  ) : null}
                </Text>
              ))}
            </View>
          </RecordGroup>
        ) : null}

        {allergyItems.length > 0 ? (
          <RecordGroup
            icon="warning-outline"
            label="Allergies"
            isLast={++shown === groups}
          >
            <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1.5 pl-5">
              {allergyItems.map((item, idx) => (
                <View key={idx} className="rounded-full bg-amber-500 px-2 py-0.5">
                  <Text className="text-xs font-medium text-white">
                    {item.name}
                  </Text>
                </View>
              ))}
            </View>
          </RecordGroup>
        ) : null}
      </View>
    </SectionChrome>
  );
}
