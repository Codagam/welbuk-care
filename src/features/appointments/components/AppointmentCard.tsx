import { memo } from "react";
import { Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { Button } from "@/ui";
import { fullName } from "@/features/patients/utils";
import type { Appointment } from "../types";
import {
  formatLateness,
  resolveOverdueState,
} from "../lib/appointmentLifecycle";
import {
  canOpenAppointmentFromList,
  formatAppointmentDate,
  formatDoctorNameForDisplay,
  formatTime12h,
  isAppointmentFollowUp,
  isAppointmentInFuture,
  isAppointmentOnToday,
  isFollowUpAwaitingTimeSlot,
  isPreConsultVitalStatus,
  normalizeStatusToken,
} from "../lib/appointmentGates";
import { statusStyle } from "../lib/statusStyles";
import { formatTokenOrClass } from "../lib/tokenSeries";

export type AppointmentPrimaryAction =
  | "check-in"
  | "open-consult"
  | "coming-soon"
  | "awaiting-slot"
  | "none";

export function resolvePrimaryAction(
  appointment: Appointment,
  options: { canUpdate: boolean; canOpenConsult: boolean }
): AppointmentPrimaryAction {
  const status = normalizeStatusToken(appointment.status);
  const onToday = isAppointmentOnToday(appointment);
  const awaitingSlot = isFollowUpAwaitingTimeSlot(appointment);

  if (awaitingSlot) return "awaiting-slot";

  if (
    isPreConsultVitalStatus(appointment.status) &&
    (appointment.appointmentDate || appointment.startTime)
  ) {
    if (isAppointmentInFuture(appointment)) return "coming-soon";
    if (!onToday) return "none";
    if (status === "SCHEDULED" && options.canUpdate) return "check-in";
  }

  // After check-in (WAITING+) — or other openable rows — chevron opens consult
  if (options.canOpenConsult && canOpenAppointmentFromList(appointment)) {
    return "open-consult";
  }

  return "none";
}

type Props = {
  appointment: Appointment;
  opening?: boolean;
  checkingIn?: boolean;
  canOpenConsult?: boolean;
  canUpdateAppointment?: boolean;
  showPatientPhone?: boolean;
  onCheckIn?: () => void;
  onOpenConsult?: () => void;
};

function AppointmentCardInner({
  appointment,
  opening,
  checkingIn,
  canOpenConsult = true,
  canUpdateAppointment = false,
  showPatientPhone = false,
  onCheckIn,
  onOpenConsult,
}: Props) {
  const s = statusStyle(appointment.status);
  const patientName = appointment.patient
    ? fullName(appointment.patient)
    : "—";
  const patientPhone = appointment.patient?.phone?.trim() || null;
  const doctorName = formatDoctorNameForDisplay(appointment.doctor?.name);
  const specialty = formatDoctorNameForDisplay(
    appointment.doctor?.specialization
  );
  const dateLabel = formatAppointmentDate(
    appointment.startTime || appointment.appointmentDate
  );
  const start = formatTime12h(appointment.startTime);
  const end = formatTime12h(appointment.endTime);
  const timeLabel = start && end ? `${start} – ${end}` : start || "—";
  const followUp = isAppointmentFollowUp(appointment);
  const slotLabel = formatTokenOrClass({
    tokenNumber: appointment.tokenNumber,
    tokenSeries: appointment.tokenSeries,
    appointmentType: appointment.appointmentType,
  });
  const late = resolveOverdueState({
    status: appointment.status,
    startTime: appointment.startTime,
  });
  const primaryAction = resolvePrimaryAction(appointment, {
    canUpdate: canUpdateAppointment,
    canOpenConsult,
  });
  const doctorLine = [doctorName, specialty].filter(Boolean).join(" · ");
  const reason = appointment.reason?.trim() || "";
  const primaryBusy = opening || checkingIn;
  const isToday = isAppointmentOnToday(appointment);

  return (
    <View
      className="relative overflow-hidden rounded-2xl border border-brand/15 bg-white"
      style={{
        shadowColor: "#FD006A",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}
    >
      <View
        className="absolute right-0 top-0 z-10 rounded-bl-2xl border-b border-l px-3 py-1.5"
        style={{
          backgroundColor: s.backgroundColor,
          borderColor: s.borderColor,
        }}
      >
        <Text
          className="text-[11px] font-semibold tracking-wide"
          style={{ color: s.color }}
        >
          {s.label}
        </Text>
      </View>

      <View className="gap-3 px-3.5 py-3.5">
        <View className="flex-row items-start gap-3">
          <View
            className="h-[72px] w-[64px] items-center justify-center rounded-2xl"
            style={{ backgroundColor: "rgba(253, 0, 106, 0.1)" }}
          >
            <Text className="text-[10px] font-semibold uppercase tracking-wider text-brand/70">
              Slot
            </Text>
            <Text
              className="mt-0.5 text-base font-bold text-brand"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {slotLabel}
            </Text>
          </View>

          <View className="min-w-0 flex-1 gap-1.5 pr-14">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text
                className="text-[17px] font-bold leading-6 text-neutral-900"
                numberOfLines={1}
              >
                {patientName}
              </Text>
              {followUp ? (
                <View
                  className="rounded-full px-2 py-0.5"
                  style={{ backgroundColor: "rgba(253, 0, 106, 0.12)" }}
                >
                  <Text className="text-[10px] font-bold uppercase tracking-wide text-brand">
                    Follow-up
                  </Text>
                </View>
              ) : null}
            </View>

            <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
              <View className="flex-row items-center gap-1">
                <Ionicons name="calendar-outline" size={13} color="#FD006A" />
                <Text className="text-xs font-medium text-neutral-600">
                  {isToday ? "Today" : dateLabel || "—"}
                </Text>
              </View>
              <Text className="text-neutral-300">·</Text>
              <View className="flex-row items-center gap-1">
                <Ionicons name="time-outline" size={13} color="#FD006A" />
                <Text
                  className="text-xs font-semibold text-neutral-800"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {timeLabel}
                </Text>
              </View>
            </View>

            {late.overdue ? (
              <View className="self-start rounded-full bg-red-50 px-2 py-0.5">
                <Text className="text-[11px] font-semibold text-red-700">
                  {late.waitingTooLong
                    ? `Waiting ${formatLateness(late.lateMinutes)}`
                    : `${formatLateness(late.lateMinutes)} late`}
                </Text>
              </View>
            ) : null}

            {doctorLine ? (
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="medkit-outline" size={13} color="#94a3b8" />
                <Text
                  className="min-w-0 flex-1 text-sm text-neutral-600"
                  numberOfLines={1}
                >
                  {doctorLine}
                </Text>
              </View>
            ) : null}

            {reason ? (
              <Text
                className="text-xs leading-4 text-neutral-500"
                numberOfLines={2}
              >
                {reason}
              </Text>
            ) : null}

            {showPatientPhone && patientPhone ? (
              <View className="flex-row items-center gap-1">
                <Ionicons name="call-outline" size={12} color="#94a3b8" />
                <Text className="text-xs text-neutral-500">{patientPhone}</Text>
              </View>
            ) : null}

            {appointment.refundId ? (
              <Text className="text-[11px] text-neutral-500">
                Refund
                {appointment.refundAmount != null
                  ? ` ₹${appointment.refundAmount}`
                  : ""}
                {appointment.refundStatus
                  ? ` · ${appointment.refundStatus}`
                  : ""}
              </Text>
            ) : null}
          </View>
        </View>

        {primaryAction !== "none" ? (
          <View className="flex-row items-center justify-end border-t border-neutral-100 pt-3">
            {primaryAction === "check-in" ? (
              <Button
                label="Check-in"
                variant="primary"
                size="md"
                loading={checkingIn}
                disabled={primaryBusy}
                onPress={onCheckIn}
                icon={
                  checkingIn ? null : (
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  )
                }
                style={{ height: 40, minWidth: 128 }}
                className="rounded-xl"
              />
            ) : primaryAction === "open-consult" ? (
              <Button
                label="Consult"
                variant="primary"
                size="md"
                loading={opening}
                disabled={primaryBusy}
                onPress={onOpenConsult}
                icon={
                  opening ? null : (
                    <MaterialCommunityIcons
                      name="stethoscope"
                      size={16}
                      color="#fff"
                    />
                  )
                }
                style={{ height: 40, minWidth: 128 }}
                className="rounded-xl"
              />
            ) : primaryAction === "coming-soon" ? (
              <View className="flex-row items-center gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                <Ionicons name="hourglass-outline" size={16} color="#9ca3af" />
                <Text className="text-[11px] font-semibold text-neutral-400">
                  Coming soon
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-1.5 rounded-xl bg-brand/10 px-3 py-2">
                <Ionicons name="calendar-outline" size={16} color="#FD006A" />
                <Text className="text-[11px] font-semibold text-brand">
                  Set time slot
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export const AppointmentCard = memo(AppointmentCardInner);
