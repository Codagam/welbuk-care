import { ActivityIndicator, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { describeError } from "@/lib/api/errors";
import type { PatientHeaderProps } from "../patientHeader";

export {
  calculateAge,
  consultPatientDisplayName,
  formatDobShort,
  mapPatientHeaderProps,
} from "../patientHeader";

type Props = {
  header?: PatientHeaderProps | null;
  loading?: boolean;
  error?: unknown;
};

/**
 * Read-only pink patient header — name, #patientId, DOB, age, phone.
 * Fields come from consult GET `patient` (not patient CRUD / URL alone).
 */
export function PatientHeaderCard({ header, loading, error }: Props) {
  if (loading) {
    return (
      <View className="items-center justify-center rounded-2xl border border-brand-100 bg-brand-50 px-4 py-6">
        <ActivityIndicator color="#FD006A" />
        <Text className="mt-2 text-xs text-neutral-500">Loading patient…</Text>
      </View>
    );
  }

  if (error && !header) {
    return (
      <View className="rounded-2xl border border-red-100 bg-red-50 px-4 py-4">
        <Text className="text-sm text-red-600">
          {describeError(error) || "Could not load patient details."}
        </Text>
      </View>
    );
  }

  if (!header) {
    return (
      <View className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">
        <Text className="text-sm text-neutral-500">
          Patient details unavailable for this consultation.
        </Text>
      </View>
    );
  }

  const { name, patientId, phone, dobFormatted, age } = header;
  const showAge = age > 0;

  return (
    <View className="gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3">
      <View className="flex-row items-start gap-3">
        <View className="mt-0.5 h-10 w-10 items-center justify-center rounded-full bg-brand">
          <Ionicons name="person" size={20} color="#fff" />
        </View>
        <View className="min-w-0 flex-1 gap-2">
          <Text
            className="text-base font-bold text-neutral-900"
            numberOfLines={1}
          >
            {name}
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {patientId != null ? (
              <View
                style={{ flexShrink: 0 }}
                className="flex-row items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5"
              >
                <Text numberOfLines={1} className="text-xs text-neutral-500">
                  Patient ID:
                </Text>
                <Text numberOfLines={1} className="text-xs font-semibold text-brand">
                  #
                </Text>
                <Text
                  numberOfLines={1}
                  className="text-xs font-medium tabular-nums text-neutral-900"
                >
                  {patientId}
                </Text>
              </View>
            ) : null}

            {dobFormatted || showAge ? (
              <View
                style={{ flexShrink: 0 }}
                className="flex-row items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5"
              >
                <Text numberOfLines={1} className="text-xs text-neutral-500">
                  Date of Birth:
                </Text>
                <Ionicons name="calendar-outline" size={12} color="#FD006A" />
                <Text
                  numberOfLines={1}
                  className="text-xs font-medium text-neutral-900"
                >
                  {dobFormatted
                    ? `${dobFormatted}${showAge ? ` (${age} years)` : ""}`
                    : `${age} years`}
                </Text>
              </View>
            ) : null}

            {phone ? (
              <View
                style={{ flexShrink: 0 }}
                className="flex-row items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5"
              >
                <Text numberOfLines={1} className="text-xs text-neutral-500">
                  Phone:
                </Text>
                <Ionicons name="call-outline" size={12} color="#FD006A" />
                <Text
                  numberOfLines={1}
                  className="text-xs font-medium text-neutral-900"
                >
                  {phone}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
