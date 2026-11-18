import { ActivityIndicator, Text, View } from "react-native";

import { describeError } from "@/lib/api/errors";
import { useDetectedSymptoms } from "../hooks";
import { SectionChrome } from "./SectionChrome";

/**
 * Detected Symptoms, as in Practice's consult screen (under Patient Records).
 * Read-only: the list comes from Summarise / Promote on the conversation,
 * which replaces it each time.
 */
export function DetectedSymptomsCard({
  consultationId,
}: {
  consultationId: string;
}) {
  const q = useDetectedSymptoms(consultationId);
  const symptoms = q.data ?? [];

  return (
    <SectionChrome
      title="Detected Symptoms"
      icon="checkmark-circle-outline"
      badge={symptoms.length}
    >
      {q.isLoading ? (
        <View className="items-start py-1">
          <ActivityIndicator color="#FD006A" />
        </View>
      ) : q.isError ? (
        <Text className="text-sm text-red-500">{describeError(q.error)}</Text>
      ) : symptoms.length === 0 ? (
        <Text className="text-sm italic text-neutral-400">
          No symptoms detected yet
        </Text>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {symptoms.map((s, idx) => (
            <View
              key={`${s.name}-${idx}`}
              className="rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1"
            >
              <Text className="text-xs font-medium text-neutral-800">
                {s.name}
                {s.since ? ` - Since ${s.since}` : ""}
              </Text>
            </View>
          ))}
        </View>
      )}
    </SectionChrome>
  );
}
