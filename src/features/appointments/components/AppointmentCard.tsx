import { memo } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { fullName } from "@/features/patients/utils";
import type { Appointment } from "../types";
import {
  canOpenAppointmentFromList,
  formatAppointmentDate,
  formatDoctorNameForDisplay,
  formatTime12h,
  isAppointmentFollowUp,
  isAppointmentInFuture,
  isFollowUpAwaitingTimeSlot,
  isPreConsultVitalStatus,
} from "../lib/appointmentGates";
import { statusStyle } from "../lib/statusStyles";

type Props = {
  appointment: Appointment;
  opening?: boolean;
  /** RBAC: false when role has no consult.read (e.g. nurse). */
  canOpenConsult?: boolean;
  onPress: () => void;
  onOpenMenu?: () => void;
};

function AppointmentCardInner({
  appointment,
  opening,
  canOpenConsult = true,
  onPress,
  onOpenMenu,
}: Props) {
  const s = statusStyle(appointment.status);
  const patientName = appointment.patient
    ? fullName(appointment.patient)
    : "Unknown patient";
  const doctorName = formatDoctorNameForDisplay(appointment.doctor?.name);
  const specialty = formatDoctorNameForDisplay(
    appointment.doctor?.specialization
  );
  const dateLabel = formatAppointmentDate(
    appointment.startTime || appointment.appointmentDate
  );
  const start = formatTime12h(appointment.startTime);
  const end = formatTime12h(appointment.endTime);
  const timeLabel =
    start && end ? `${start} – ${end}` : start || "—";
  const canOpen =
    canOpenConsult && canOpenAppointmentFromList(appointment);
  const followUp = isAppointmentFollowUp(appointment);
  const awaitingSlot = isFollowUpAwaitingTimeSlot(appointment);
  const comingSoon =
    isPreConsultVitalStatus(appointment.status) &&
    isAppointmentInFuture(appointment) &&
    !awaitingSlot;

  return (
    <Pressable
      onPress={onPress}
      disabled={opening}
      className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 active:bg-neutral-50"
    >
      <View className="flex-row items-start gap-3">
        <View className="min-w-[88px] gap-0.5">
          <Text className="text-xs font-medium text-neutral-500">
            {dateLabel || "—"}
          </Text>
          <Text className="text-sm font-semibold text-neutral-800">
            {timeLabel}
          </Text>
        </View>

        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text
              className="text-base font-semibold text-neutral-900"
              numberOfLines={1}
            >
              {patientName}
            </Text>
            {followUp ? (
              <View className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5">
                <Text className="text-[10px] font-semibold uppercase text-brand">
                  follow-up
                </Text>
              </View>
            ) : null}
          </View>

          <Text className="text-sm text-neutral-700" numberOfLines={1}>
            {[doctorName, specialty].filter(Boolean).join(" · ") || "—"}
          </Text>

          <Text className="text-xs text-neutral-500" numberOfLines={2}>
            {appointment.reason?.trim() || "—"}
          </Text>

          <View className="mt-1 flex-row flex-wrap items-center gap-2">
            <View
              className={`rounded-full border px-2.5 py-1 ${s.chip} ${s.border}`}
            >
              <Text className={`text-[11px] font-medium ${s.text}`}>
                {s.label}
              </Text>
            </View>

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

            {awaitingSlot ? (
              <Text className="text-[11px] font-medium text-brand">
                Set time slot
              </Text>
            ) : null}
            {comingSoon ? (
              <Text className="text-[11px] text-neutral-400">Coming soon</Text>
            ) : null}
          </View>
        </View>

        <View className="items-center gap-2">
          {opening ? (
            <ActivityIndicator size="small" color="#FD006A" />
          ) : canOpen ? (
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          ) : null}
          {onOpenMenu ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onOpenMenu();
              }}
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-full active:bg-neutral-100"
            >
              <Ionicons
                name="ellipsis-vertical"
                size={18}
                color="#6b7280"
              />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export const AppointmentCard = memo(AppointmentCardInner);
