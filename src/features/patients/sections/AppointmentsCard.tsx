import { useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { describeError } from "@/lib/api/errors";
import { SectionChrome } from "@/features/consult/components/SectionChrome";
import { openConsultForAppointment } from "@/lib/api/endpoints/consult";
import { Button } from "@/ui";
import { usePatientAppointments } from "../hooks";

function formatTimeLabel(value?: string | null): string {
  if (!value?.trim()) return "";
  const raw = value.trim();
  if (/^\d{1,2}:\d{2}(\s*[AaPp][Mm])?$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${String(h).padStart(2, "0")}:${m}`;
}

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
  const time = formatTimeLabel(row.startTime);
  return time ? `${date} · ${time}` : date;
}

export function AppointmentsCard({
  mongoPatientId,
  routePatientId,
}: {
  mongoPatientId: string;
  routePatientId: string;
}) {
  const router = useRouter();
  const q = usePatientAppointments(mongoPatientId);
  const rows = q.data ?? [];
  const [openingId, setOpeningId] = useState<string | null>(null);

  const openReport = async (row: {
    id?: string;
    appointmentDate?: string;
    startTime?: string;
  }) => {
    if (!row.id) return;
    setOpeningId(row.id);
    try {
      const consult = await openConsultForAppointment(row.id);
      router.push({
        pathname: "/patients/[id]/report",
        params: {
          id: routePatientId,
          consultationId: consult.id,
          appointmentId: row.id,
          appointmentDate: row.appointmentDate ?? "",
          appointmentTime: row.startTime ?? "",
        },
      });
    } catch (e) {
      Alert.alert("Could not open report", describeError(e));
    } finally {
      setOpeningId(null);
    }
  };

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
              <View className="flex-row items-center gap-2">
                <View className="rounded-full border border-neutral-200 px-2 py-0.5">
                  <Text className="text-[10px] font-medium text-neutral-600">
                    {String(row.status ?? "—")}
                  </Text>
                </View>
                {String(row.status ?? "").toUpperCase() === "COMPLETED" ? (
                  <Button
                    label="View report"
                    size="md"
                    variant="primary"
                    loading={openingId === row.id}
                    onPress={() => void openReport(row)}
                  />
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </SectionChrome>
  );
}
