import { ActivityIndicator, Text, View } from "react-native";

import { describeError } from "@/lib/api/errors";
import { SectionChrome } from "@/features/consult/components/SectionChrome";
import { usePatientAppointments } from "../hooks";

function formatWhen(row: {
  appointmentDate?: string;
  startTime?: string;
}): string {
  const d = row.appointmentDate ? new Date(row.appointmentDate) : null;
  const date =
    d && !Number.isNaN(d.getTime())
      ? d.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—";
  const time = row.startTime?.trim() || "";
  return time ? `${date} · ${time}` : date;
}

export function AppointmentsCard({
  mongoPatientId,
}: {
  mongoPatientId: string;
}) {
  const q = usePatientAppointments(mongoPatientId);
  const rows = q.data ?? [];

  return (
    <SectionChrome
      title="Appointments"
      icon="calendar-outline"
      badge={rows.length}
      collapsible
      defaultOpen
    >
      {q.isLoading && !q.data ? (
        <View className="items-center py-4">
          <ActivityIndicator color="#FD006A" />
        </View>
      ) : q.isError ? (
        <Text className="text-sm text-red-500">{describeError(q.error)}</Text>
      ) : rows.length === 0 ? (
        <Text className="text-xs italic text-neutral-500">
          No appointments for this patient.
        </Text>
      ) : (
        <View className="gap-0">
          {rows.slice(0, 20).map((row, idx) => (
            <View
              key={row.id ?? String(idx)}
              className={`flex-row items-center justify-between py-2.5 ${
                idx < Math.min(rows.length, 20) - 1
                  ? "border-b border-neutral-100"
                  : ""
              }`}
            >
              <View className="min-w-0 flex-1 gap-0.5">
                <Text className="text-xs font-medium text-neutral-900">
                  {formatWhen(row)}
                </Text>
                {row.isFollowUp ? (
                  <Text className="text-[10px] text-neutral-500">Follow-up</Text>
                ) : null}
              </View>
              <View className="rounded-full border border-neutral-200 px-2 py-0.5">
                <Text className="text-[10px] font-medium text-neutral-600">
                  {String(row.status ?? "—")}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </SectionChrome>
  );
}
