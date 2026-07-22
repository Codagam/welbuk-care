import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { SectionChrome } from "./SectionChrome";

function normalizeSymptoms(symptoms?: string[] | string | null): string[] {
  if (!symptoms) return [];
  if (Array.isArray(symptoms)) {
    return symptoms
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter(Boolean);
  }
  const t = symptoms.trim();
  return t ? [t] : [];
}

export function AppointmentIntakeCard({
  symptoms,
  reason,
}: {
  symptoms?: string[] | string | null;
  reason?: string | null;
}) {
  const normalizedSymptoms = normalizeSymptoms(symptoms);
  const normalizedReason = reason?.trim() ?? "";
  const hasAny = normalizedSymptoms.length > 0 || normalizedReason.length > 0;

  if (!hasAny) {
    return (
      <SectionChrome title="Appointment Intake" emptyBorder className="flex-1">
        <View className="gap-2.5">
          <View className="flex-row items-center gap-2">
            <Ionicons name="warning-outline" size={16} color="#9ca3af" />
            <Text className="text-sm text-neutral-500">Symptoms:</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Ionicons name="document-text-outline" size={16} color="#9ca3af" />
            <Text className="text-sm text-neutral-500">Reason for visit:</Text>
          </View>
        </View>
      </SectionChrome>
    );
  }

  return (
    <SectionChrome title="Appointment Intake" className="flex-1">
      <View className="gap-2.5 rounded-lg bg-white p-3">
        <View className="flex-row items-start gap-2">
          <Ionicons
            name="warning-outline"
            size={16}
            color="#dc2626"
            style={{ marginTop: 2 }}
          />
          <Text className="shrink-0 text-sm text-neutral-500">Symptoms:</Text>
          <View className="min-w-0 flex-1 flex-row flex-wrap justify-start gap-1.5">
            {normalizedSymptoms.length > 0 ? (
              normalizedSymptoms.map((symptom) => (
                <View
                  key={symptom}
                  className="rounded-full bg-neutral-100 px-2.5 py-1"
                >
                  <Text className="text-xs font-medium text-neutral-800">
                    {symptom}
                  </Text>
                </View>
              ))
            ) : (
              <Text className="font-semibold text-neutral-400">—</Text>
            )}
          </View>
        </View>

        <View className="flex-row items-start gap-2">
          <Ionicons
            name="document-text-outline"
            size={16}
            color="#9ca3af"
            style={{ marginTop: 2 }}
          />
          <Text className="shrink-0 text-sm text-neutral-500">
            Reason for visit:
          </Text>
          <Text className="min-w-0 flex-1 text-sm font-semibold text-neutral-900">
            {normalizedReason || (
              <Text className="font-normal text-neutral-400">—</Text>
            )}
          </Text>
        </View>
      </View>
    </SectionChrome>
  );
}
