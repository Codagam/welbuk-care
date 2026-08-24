import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type {
  AllergyRecord,
  MedicalCondition,
  MedicationRecord,
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

export function PatientRecordsCard({
  medicalHistory,
  medications,
  allergies,
}: {
  medicalHistory?: MedicalCondition[] | unknown;
  medications?: MedicationRecord[] | unknown[];
  allergies?: AllergyRecord[] | unknown[];
}) {
  const history = asNamedList(medicalHistory);
  const meds = asNamedList(medications);
  const allergyItems = Array.isArray(allergies)
    ? allergies.map((a) => {
        if (typeof a === "string") {
          return { name: a, severity: "MODERATE" };
        }
        const o = a as AllergyRecord & Record<string, unknown>;
        return {
          name:
            o.name ||
            (typeof o.allergen === "string" ? o.allergen : "") ||
            "—",
          severity: o.severity || "MODERATE",
        };
      })
    : [];

  const hasAny =
    history.length > 0 || meds.length > 0 || allergyItems.length > 0;

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
              {allergyItems.map((item, idx) => {
                const high =
                  item.severity === "High" ||
                  item.severity === "CRITICAL" ||
                  item.severity === "critical";
                return (
                  <View key={idx} className="flex-row items-center gap-1">
                    <View
                      className={`rounded-full px-2 py-0.5 ${
                        high ? "bg-red-600" : "bg-amber-500"
                      }`}
                    >
                      <Text className="text-xs font-medium text-white">
                        {item.name}
                      </Text>
                    </View>
                    <Text className="text-[10px] text-neutral-500">
                      ({item.severity})
                    </Text>
                  </View>
                );
              })}
            </View>
          </RecordGroup>
        ) : null}
      </View>
    </SectionChrome>
  );
}
