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
    return <SectionChrome title="Patient Records" emptyBorder />;
  }

  return (
    <SectionChrome title="Patient Records">
      <View className="divide-y divide-neutral-200 rounded-lg bg-white p-3">
        {history.length > 0 ? (
          <View className="flex-row items-start gap-2 py-2">
            <Ionicons
              name="pulse-outline"
              size={16}
              color="#9ca3af"
              style={{ marginTop: 2 }}
            />
            <View className="min-w-0 flex-1">
              <Text className="mb-1 text-base text-neutral-500">
                Medical History
              </Text>
              <View className="gap-1 pl-4">
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
            </View>
          </View>
        ) : null}

        {meds.length > 0 ? (
          <View className="flex-row items-start gap-2 border-t border-neutral-200 py-2">
            <Ionicons
              name="medkit-outline"
              size={16}
              color="#9ca3af"
              style={{ marginTop: 2 }}
            />
            <View className="min-w-0 flex-1">
              <Text className="mb-1 text-base text-neutral-500">
                Current Medications
              </Text>
              <View className="gap-1 pl-4">
                {meds.map((item, idx) => (
                  <Text key={idx} className="text-sm text-neutral-900">
                    <Text className="font-semibold">{item.name}</Text>
                    {item.extra ? (
                      <Text className="text-neutral-500">
                        {" "}
                        ({item.extra})
                      </Text>
                    ) : null}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {allergyItems.length > 0 ? (
          <View className="flex-row items-start gap-2 border-t border-neutral-200 py-2">
            <Ionicons
              name="warning-outline"
              size={16}
              color="#9ca3af"
              style={{ marginTop: 2 }}
            />
            <View className="min-w-0 flex-1">
              <Text className="mb-1 text-base text-neutral-500">Allergies</Text>
              <View className="flex-row flex-wrap items-center gap-x-3 gap-y-2 pl-4">
                {allergyItems.map((item, idx) => {
                  const high =
                    item.severity === "High" ||
                    item.severity === "CRITICAL" ||
                    item.severity === "critical";
                  return (
                    <View
                      key={idx}
                      className="flex-row items-center gap-1"
                    >
                      <View
                        className={`rounded-full px-2 py-0.5 ${
                          high ? "bg-red-600" : "bg-amber-500"
                        }`}
                      >
                        <Text className="text-sm font-medium text-white">
                          {item.name}
                        </Text>
                      </View>
                      <Text className="text-xs text-neutral-500">
                        ({item.severity})
                      </Text>
                      {idx !== allergyItems.length - 1 ? (
                        <Text className="ml-2 text-neutral-400">|</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </SectionChrome>
  );
}
