import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { describeError } from "@/lib/api/errors";
import type { FacilityAppointment } from "@/lib/api/endpoints/appointments";
import { SectionChrome } from "@/features/consult/components/SectionChrome";
import { openConsultForAppointment } from "@/lib/api/endpoints/consult";
import { useCanAccessConsult } from "@/features/permissions";
import { Button } from "@/ui";
import { AppAlert } from "@/ui/AppAlert";
import { usePatientAppointments } from "../hooks";
import {
  isConsultBlockedStatus,
  isDentalPlanDone,
  useDentalPlanVisits,
  type DentalPlanVisit,
} from "../dentalPlanVisits";
import { BRAND } from "../components/kit";

type Row = FacilityAppointment & {
  reason?: string | null;
  doctor?: { name?: string | null; specialization?: string | null } | null;
};

function formatTimeLabel(value?: string | null): string {
  if (!value?.trim()) return "";
  const raw = value.trim();
  if (/^\d{1,2}:\d{2}(\s*[AaPp][Mm])?$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(value?: string | null): string {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
}

/** Practice's "Today / Yesterday / 3 days ago / 2 months ago". */
function relativeDay(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.floor((today.getTime() - day.getTime()) / 86_400_000);
  if (days < 0) {
    const ahead = -days;
    if (ahead === 1) return "Tomorrow";
    if (ahead < 7) return `In ${ahead} days`;
    if (ahead < 30) {
      const w = Math.floor(ahead / 7);
      return w === 1 ? "In 1 week" : `In ${w} weeks`;
    }
    return null;
  }
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return w === 1 ? "1 week ago" : `${w} weeks ago`;
  }
  if (days < 365) {
    const m = Math.floor(days / 30);
    return m === 1 ? "1 month ago" : `${m} months ago`;
  }
  const y = Math.floor(days / 365);
  return y === 1 ? "1 year ago" : `${y} years ago`;
}

function formatStatus(status?: string): string {
  return String(status ?? "—")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Same groups as Practice's getAppointmentStatusVariant. */
function statusTone(status?: string): { box: string; text: string } {
  switch (String(status ?? "").toUpperCase()) {
    case "TENTATIVE":
    case "PENDING_PAYMENT":
    case "SCHEDULED":
    case "CONFIRMED":
      return { box: "border-brand bg-brand", text: "text-white" };
    case "WAITING":
    case "IN_PROGRESS":
      return { box: "border-neutral-200 bg-neutral-100", text: "text-neutral-800" };
    case "CANCELLED":
    case "NO_SHOW":
      return { box: "border-red-200 bg-red-50", text: "text-red-700" };
    default:
      return { box: "border-neutral-300 bg-white", text: "text-neutral-700" };
  }
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
  const rows = (q.data ?? []) as Row[];
  /** `${action}:${appointmentId}` so only the pressed button spins. */
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const { canAccess: canAccessConsult, isLoading: consultAccessLoading } =
    useCanAccessConsult();
  const canOpenConsult = canAccessConsult && !consultAccessLoading;
  const dentalVisits = useDentalPlanVisits(mongoPatientId, rows, canOpenConsult);

  const guard = (): boolean => {
    if (consultAccessLoading) return false;
    if (!canOpenConsult) {
      AppAlert.alert(
        "You don't have permission",
        "Your role can't open consultations. Ask a facility administrator if you need access."
      );
      return false;
    }
    return true;
  };

  /**
   * Resolves (or creates) the visit's consultation. That endpoint CREATES one
   * when none exists, which is why a cancelled or no-show visit never gets the
   * button — it would make a clinical record for a visit that never happened.
   */
  const openConsult = async (row: Row) => {
    if (!row.id || isConsultBlockedStatus(row.status) || !guard()) return;
    setBusyKey(`consult:${row.id}`);
    try {
      const consult = await openConsultForAppointment(row.id);
      router.push({
        pathname: "/consult/[id]",
        params: {
          id: consult.id,
          appointmentId: row.id,
          patientId: mongoPatientId,
        },
      });
    } catch (e) {
      AppAlert.alert("Could not open consult", describeError(e));
    } finally {
      setBusyKey(null);
    }
  };

  /** Consult report: view, download or print the prescription PDF. */
  const openReport = async (row: Row) => {
    if (!row.id || !guard()) return;
    setBusyKey(`report:${row.id}`);
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
      AppAlert.alert("Could not open report", describeError(e));
    } finally {
      setBusyKey(null);
    }
  };

  /** Practice's Treat: open the dental chart with the first finding's plan. */
  const openTreat = (row: Row, visit: DentalPlanVisit) => {
    if (!guard()) return;
    const first = visit.treatmentEntries[0];
    router.push({
      pathname: "/consult/[id]",
      params: {
        id: visit.consultationId,
        appointmentId: row.id ?? "",
        patientId: mongoPatientId,
        section: "dental",
        ...(first?.id ? { treatEntryId: first.id } : {}),
      },
    });
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
          <ActivityIndicator color={BRAND} />
        </View>
      ) : q.isError ? (
        <Text className="text-sm text-red-500">{describeError(q.error)}</Text>
      ) : rows.length === 0 ? (
        <View className="items-center gap-1 py-4">
          <Ionicons name="calendar-outline" size={24} color="#9ca3af" />
          <Text className="text-sm text-neutral-500">
            No appointments found.
          </Text>
        </View>
      ) : (
        <View className="gap-0">
          {rows.map((row, idx) => {
            const id = row.id ?? `row-${idx}`;
            const status = String(row.status ?? "").toUpperCase();
            const completed = status === "COMPLETED";
            const blocked = isConsultBlockedStatus(row.status);
            const tone = statusTone(row.status);
            const rel = relativeDay(row.appointmentDate);
            const start = formatTimeLabel(row.startTime);
            const end = formatTimeLabel(row.endTime);
            const time = start ? (end ? `${start} – ${end}` : start) : "—";
            const plan = row.id ? dentalVisits.data?.get(row.id) : undefined;
            const treatDisabled = completed || (plan ? isDentalPlanDone(plan) : false);
            const reason = typeof row.reason === "string" ? row.reason.trim() : "";

            return (
              <View
                key={id}
                className={`gap-2 py-3 ${
                  idx < rows.length - 1 ? "border-b border-neutral-100" : ""
                }`}
              >
                <View className="flex-row flex-wrap items-start gap-3">
                  <View className="min-w-[150px] gap-1">
                    <Text className="text-sm font-medium text-neutral-900">
                      {formatDate(row.appointmentDate)}
                    </Text>
                    <Text className="text-xs text-neutral-500">{time}</Text>
                    <View className="flex-row flex-wrap gap-1">
                      {rel ? (
                        <View className="rounded-full bg-neutral-100 px-2 py-0.5">
                          <Text className="text-[10px] text-neutral-600">{rel}</Text>
                        </View>
                      ) : null}
                      {row.isFollowUp ? (
                        <View className="rounded-full bg-neutral-100 px-2 py-0.5">
                          <Text className="text-[10px] text-neutral-600">
                            Follow-up
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <View className="min-w-[160px] flex-1 gap-0.5">
                    <Text className="text-sm font-medium text-neutral-900">
                      {row.doctor?.name || "—"}
                    </Text>
                    {row.doctor?.specialization ? (
                      <Text className="text-xs text-neutral-500">
                        {row.doctor.specialization}
                      </Text>
                    ) : null}
                    {reason ? (
                      <Text className="text-xs text-neutral-600" numberOfLines={2}>
                        Reason: {reason}
                      </Text>
                    ) : null}
                  </View>

                  <View className={`rounded-full border px-2.5 py-0.5 ${tone.box}`}>
                    <Text className={`text-[11px] font-medium ${tone.text}`}>
                      {formatStatus(row.status)}
                    </Text>
                  </View>
                </View>

                {canOpenConsult && row.id && (plan || completed || !blocked) ? (
                  <View className="flex-row flex-wrap justify-end gap-2">
                    {plan ? (
                      <Button
                        label="Treat"
                        size="md"
                        variant="primary"
                        disabled={treatDisabled}
                        onPress={() => openTreat(row, plan)}
                        icon={<Ionicons name="arrow-forward" size={16} color="#fff" />}
                      />
                    ) : null}
                    {completed ? (
                      <Button
                        label="Report"
                        size="md"
                        variant="outline"
                        loading={busyKey === `report:${row.id}`}
                        onPress={() => void openReport(row)}
                        icon={
                          <Ionicons name="document-text-outline" size={16} color="#111827" />
                        }
                      />
                    ) : null}
                    {!blocked ? (
                      <Button
                        label={completed ? "View consult" : "Open consult"}
                        size="md"
                        variant="outline"
                        loading={busyKey === `consult:${row.id}`}
                        onPress={() => void openConsult(row)}
                        icon={
                          <Ionicons name="medkit-outline" size={16} color="#111827" />
                        }
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </SectionChrome>
  );
}
