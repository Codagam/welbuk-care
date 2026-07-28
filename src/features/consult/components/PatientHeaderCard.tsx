import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Text, View } from "react-native";

import { describeError } from "@/lib/api/errors";
import type { PatientHeaderProps } from "../patientHeader";

export {
  calculateAge,
  consultPatientDisplayName,
  formatDobShort,
  mapPatientHeaderProps
} from "../patientHeader";

type Props = {
  header?: PatientHeaderProps | null;
  loading?: boolean;
  error?: unknown;
  /** When true, omit outer card chrome (parent provides the unified card). */
  embedded?: boolean;
};

/**
 * Compact patient identity strip — name + #id · age · DOB · phone.
 * Fields come from consult GET `patient` (not patient CRUD / URL alone).
 */
export function PatientHeaderCard({
  header,
  loading,
  error,
  embedded = false,
}: Props) {
  const shell = embedded
    ? "px-3.5 py-2.5"
    : "rounded-2xl border border-neutral-200 bg-white px-3.5 py-2.5";

  if (loading) {
    return (
      <View className={`items-center justify-center ${shell}`}>
        <ActivityIndicator color="#FD006A" />
        <Text className="mt-1.5 text-xs text-neutral-500">Loading patient…</Text>
      </View>
    );
  }

  if (error && !header) {
    return (
      <View
        className={
          embedded
            ? "bg-red-50 px-3.5 py-3"
            : "rounded-2xl border border-red-100 bg-red-50 px-3.5 py-3"
        }
      >
        <Text className="text-sm text-red-600">
          {describeError(error) || "Could not load patient details."}
        </Text>
      </View>
    );
  }

  if (!header) {
    return (
      <View className={shell}>
        <Text className="text-sm text-neutral-500">
          Patient details unavailable for this consultation.
        </Text>
      </View>
    );
  }

  const { name, patientId, phone, dobFormatted, age } = header;
  const showAge = age > 0;

  const metaParts: string[] = [];
  if (patientId != null) metaParts.push(`#${patientId}`);
  if (showAge) metaParts.push(`${age} yrs`);
  if (dobFormatted) metaParts.push(dobFormatted);
  if (phone) metaParts.push(phone);

  return (
    <View className={`flex-row items-center gap-2.5 ${shell}`}>
      <View className="h-9 w-9 items-center justify-center rounded-full bg-brand">
        <Ionicons name="person" size={18} color="#fff" />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className="text-base font-bold text-neutral-900"
          numberOfLines={1}
        >
          {name}
        </Text>
        {metaParts.length > 0 ? (
          <Text
            className="mt-0.5 text-xs leading-4 text-neutral-500"
            numberOfLines={1}
          >
            {metaParts.join("  ·  ")}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
