import { ActivityIndicator, Text, View } from "react-native";

import { describeError } from "@/lib/api/errors";
import { usePatientHistory } from "../hooks";
import type { PreviousNote } from "../types";

function labelOf(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    return (
      (o.name as string) ??
      (o.allergen as string) ??
      (o.drugName as string) ??
      (o.title as string) ??
      "—"
    );
  }
  return "—";
}

export function HistorySection({
  consultationId,
  patientId,
}: {
  consultationId: string;
  patientId?: string;
}) {
  const q = usePatientHistory(patientId, consultationId);

  if (q.isLoading) {
    return (
      <View className="items-center py-10">
        <ActivityIndicator color="#FD006A" />
      </View>
    );
  }
  if (q.isError) {
    return (
      <View className="rounded-2xl border border-neutral-200 bg-white p-5">
        <Text className="text-sm text-red-500">{describeError(q.error)}</Text>
      </View>
    );
  }

  const data = (q.data ?? {}) as Record<string, unknown>;
  const notes: PreviousNote[] = Array.isArray(data.previousNotes)
    ? (data.previousNotes as PreviousNote[])
    : [];
  const allergies = Array.isArray(data.allergies) ? data.allergies : [];
  const meds = Array.isArray(data.medications) ? data.medications : [];

  return (
    <View className="gap-4">
      {allergies.length ? (
        <View className="gap-2 rounded-2xl border border-red-100 bg-red-50 p-5">
          <Text className="text-sm font-semibold text-red-700">Allergies</Text>
          <View className="flex-row flex-wrap gap-2">
            {allergies.map((a, i) => (
              <View key={i} className="rounded-full bg-white px-3 py-1">
                <Text className="text-xs font-medium text-red-600">{labelOf(a)}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {meds.length ? (
        <View className="gap-2 rounded-2xl border border-neutral-200 bg-white p-5">
          <Text className="text-sm font-semibold text-neutral-900">
            Current medications
          </Text>
          {meds.map((m, i) => (
            <Text key={i} className="text-sm text-neutral-700">
              • {labelOf(m)}
            </Text>
          ))}
        </View>
      ) : null}

      <View className="gap-3 rounded-2xl border border-neutral-200 bg-white p-5">
        <Text className="text-lg font-semibold text-neutral-900">
          Previous notes
        </Text>
        {notes.length === 0 ? (
          <Text className="text-sm text-neutral-400">No previous consultations.</Text>
        ) : (
          notes.map((n, i) => (
            <View
              key={n.consultationId ?? i}
              className="gap-1 border-t border-neutral-100 pt-3"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-medium text-neutral-900">
                  {n.doctorName ?? "Consultation"}
                </Text>
                {n.date ? (
                  <Text className="text-xs text-neutral-400">
                    {new Date(n.date).toLocaleDateString()}
                  </Text>
                ) : null}
              </View>
              {n.assessment ? (
                <Text className="text-sm text-neutral-700">A: {n.assessment}</Text>
              ) : null}
              {n.plan ? (
                <Text className="text-sm text-neutral-700">P: {n.plan}</Text>
              ) : null}
              {!n.assessment && !n.plan && n.summary ? (
                <Text className="text-sm text-neutral-700">{n.summary}</Text>
              ) : null}
            </View>
          ))
        )}
      </View>
    </View>
  );
}
