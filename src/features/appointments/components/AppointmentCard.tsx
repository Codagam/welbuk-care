import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui";
import { fullName } from "@/features/patients/utils";
import type { Appointment } from "../types";
import {
  formatLateness,
  resolveOverdueState,
} from "../lib/appointmentLifecycle";
import {
  canAddVitalsFromList,
  canOpenAppointmentFromList,
  formatAppointmentDate,
  formatDoctorNameForDisplay,
  formatTime12h,
  isAppointmentFollowUp,
  isAppointmentInFuture,
  isAppointmentOnToday,
  isFollowUpAwaitingTimeSlot,
  isPreConsultVitalStatus,
  isTreatAsNoShow,
  normalizeStatusToken,
  shouldShowCheckIn,
} from "../lib/appointmentGates";
import {
  hasAnyAppointmentAction,
  type AppointmentActions,
} from "../lib/appointmentActions";
import { statusStyle } from "../lib/statusStyles";
import { formatTokenOrClass } from "../lib/tokenSeries";

export type AppointmentPrimaryAction =
  | "check-in"
  | "open-consult"
  | "fit-in-slot"
  | "coming-soon"
  | "awaiting-slot"
  | "none";

export function resolvePrimaryAction(
  appointment: Appointment,
  options: { canUpdate: boolean; canOpenConsult: boolean }
): AppointmentPrimaryAction {
  if (isFollowUpAwaitingTimeSlot(appointment)) return "awaiting-slot";

  if (isTreatAsNoShow(appointment)) {
    return options.canUpdate ? "fit-in-slot" : "none";
  }

  if (
    isPreConsultVitalStatus(appointment.status) &&
    (appointment.appointmentDate || appointment.startTime)
  ) {
    if (isAppointmentInFuture(appointment)) return "coming-soon";
    if (!isAppointmentOnToday(appointment)) return "none";
    if (shouldShowCheckIn(appointment) && options.canUpdate) return "check-in";
  }

  if (options.canOpenConsult && canOpenAppointmentFromList(appointment)) {
    return "open-consult";
  }

  return "none";
}

type Props = {
  appointment: Appointment;
  opening?: boolean;
  checkingIn?: boolean;
  fittingIn?: boolean;
  checkInBlocked?: boolean;
  canOpenConsult?: boolean;
  canUpdateAppointment?: boolean;
  showPatientPhone?: boolean;
  /** Receptionist / nurse desk: show "Add vitals" on eligible visits. */
  canAddVitals?: boolean;
  openingVitals?: boolean;
  /** Receptionist / nurse recorded vitals for this visit this session. */
  vitalsAdded?: boolean;
  onAddVitals?: () => void;
  onCheckIn?: () => void;
  onOpenConsult?: () => void;
  onFitInNextSlot?: () => void;
  /** Permission- and status-checked edit / reschedule / cancel / delete. */
  actions?: AppointmentActions;
  onOpenActions?: () => void;
  /** Briefly outlined after a notification about this visit is tapped. */
  highlighted?: boolean;
};

function AppointmentCardInner({
  appointment,
  opening,
  checkingIn,
  fittingIn,
  checkInBlocked = false,
  canOpenConsult = true,
  canUpdateAppointment = false,
  showPatientPhone = false,
  canAddVitals = false,
  openingVitals = false,
  vitalsAdded = false,
  onAddVitals,
  onCheckIn,
  onOpenConsult,
  onFitInNextSlot,
  actions,
  onOpenActions,
  highlighted = false,
}: Props) {
  const { t } = useTranslation();
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
  const rowBusy = opening || checkingIn || fittingIn || openingVitals;
  const showAddVital = canAddVitals && canAddVitalsFromList(appointment);
  const checkInDisabled = rowBusy || checkInBlocked;
  const isToday = isAppointmentOnToday(appointment);
  const isCompleted =
    normalizeStatusToken(appointment.status) === "COMPLETED";
  const showMore =
    Boolean(onOpenActions) && Boolean(actions) && hasAnyAppointmentAction(actions!);

  const statusToken = normalizeStatusToken(appointment.status);
  // Finished or void visits drop to grey so live ones carry the colour.
  const muted =
    isCompleted || statusToken === "CANCELLED" || statusToken === "DROPS";
  const initials =
    patientName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "—";
  const hasSlot = Boolean(slotLabel && slotLabel !== "—");
  const lateLabel = late.overdue
    ? late.waitingTooLong
      ? `Waiting ${formatLateness(late.lateMinutes)}`
      : `${formatLateness(late.lateMinutes)} late`
    : null;
  const refundLabel = appointment.refundId
    ? `Refund${
        appointment.refundAmount != null ? ` ₹${appointment.refundAmount}` : ""
      }${appointment.refundStatus ? ` · ${appointment.refundStatus}` : ""}`
    : null;
  const showPhone = showPatientPhone && Boolean(patientPhone);
  const showVitalsTag = canAddVitals && vitalsAdded;
  const hasTags =
    hasSlot || followUp || showPhone || !!lateLabel || showVitalsTag || !!refundLabel;
  const showFooter = primaryAction !== "none" || showAddVital;

  return (
    <View
      className={`flex-row overflow-hidden rounded-2xl bg-white ${
        highlighted
          ? "border-2 border-brand"
          : muted
            ? "border border-neutral-200"
            : "border border-brand-100"
      }`}
      style={{
        shadowColor: muted ? "#0f172a" : "#FD006A",
        shadowOpacity: muted ? 0.04 : 0.07,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }}
    >
      {/* Time column — the desk scans a schedule by time first. */}
      <View
        className={`w-[92px] items-center justify-center px-2 py-4 ${
          muted ? "bg-neutral-50" : "bg-brand-50"
        }`}
      >
        <Text
          className={`text-[15px] font-bold ${
            muted ? "text-neutral-500" : "text-brand-700"
          }`}
          style={{ fontVariant: ["tabular-nums"] }}
          numberOfLines={1}
        >
          {start || "—"}
        </Text>
        {end ? (
          <Text
            className={`mt-0.5 text-[11px] ${
              muted ? "text-neutral-400" : "text-brand-400"
            }`}
            style={{ fontVariant: ["tabular-nums"] }}
            numberOfLines={1}
          >
            to {end}
          </Text>
        ) : null}
        <View
          className={`mt-2.5 rounded-full px-2 py-0.5 ${
            isToday && !muted ? "bg-brand" : "bg-white"
          }`}
        >
          <Text
            className={`text-[10px] font-semibold uppercase tracking-wide ${
              isToday && !muted
                ? "text-white"
                : muted
                  ? "text-neutral-500"
                  : "text-brand-700"
            }`}
            numberOfLines={1}
          >
            {isToday ? "Today" : dateLabel || "—"}
          </Text>
        </View>
      </View>

      <View className="min-w-0 flex-1 gap-2.5 py-3.5 pl-3.5 pr-2">
        {/* Who */}
        <View className="flex-row items-center gap-3">
          <View
            className={`h-10 w-10 items-center justify-center rounded-full ${
              muted ? "bg-neutral-100" : "bg-brand-100"
            }`}
          >
            <Text
              className={`text-sm font-bold ${
                muted ? "text-neutral-500" : "text-brand-700"
              }`}
            >
              {initials}
            </Text>
          </View>

          <View className="min-w-0 flex-1">
            <Text
              className="text-base font-semibold text-neutral-900"
              numberOfLines={1}
            >
              {patientName}
            </Text>
            {doctorLine ? (
              <Text className="text-[13px] text-neutral-500" numberOfLines={1}>
                {doctorLine}
              </Text>
            ) : null}
          </View>

          <View className="flex-row items-center self-start">
            <View
              className="rounded-full border px-2.5 py-1"
              style={{
                backgroundColor: s.backgroundColor,
                borderColor: s.borderColor,
              }}
            >
              <Text
                className="text-[11px] font-semibold"
                style={{ color: s.color }}
              >
                {s.label}
              </Text>
            </View>
            {showMore ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("appointments.actions.more")}
                disabled={rowBusy}
                onPress={onOpenActions}
                hitSlop={10}
                className={`ml-0.5 h-8 w-8 items-center justify-center rounded-full active:bg-brand-50 ${
                  rowBusy ? "opacity-40" : ""
                }`}
              >
                <Ionicons name="ellipsis-vertical" size={16} color="#737373" />
              </Pressable>
            ) : (
              <View className="w-2" />
            )}
          </View>
        </View>

        {/* Tags */}
        {hasTags ? (
          <View className="flex-row flex-wrap gap-1.5">
            {hasSlot ? (
              <View className="rounded-md bg-brand-50 px-2 py-1">
                <Text
                  className="text-[11px] font-semibold text-brand-700"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {slotLabel}
                </Text>
              </View>
            ) : null}
            {followUp ? (
              <View className="rounded-md bg-brand-100 px-2 py-1">
                <Text className="text-[11px] font-semibold text-brand-700">
                  Follow-up
                </Text>
              </View>
            ) : null}
            {showPhone ? (
              <View className="rounded-md bg-neutral-100 px-2 py-1">
                <Text className="text-[11px] font-medium text-neutral-600">
                  {patientPhone}
                </Text>
              </View>
            ) : null}
            {lateLabel ? (
              <View className="rounded-md bg-red-50 px-2 py-1">
                <Text className="text-[11px] font-semibold text-red-700">
                  {lateLabel}
                </Text>
              </View>
            ) : null}
            {showVitalsTag ? (
              <View className="rounded-md bg-emerald-50 px-2 py-1">
                <Text className="text-[11px] font-semibold text-emerald-700">
                  {t("appointments.vitalsAdded")}
                </Text>
              </View>
            ) : null}
            {refundLabel ? (
              <View className="rounded-md bg-neutral-100 px-2 py-1">
                <Text className="text-[11px] font-medium text-neutral-600">
                  {refundLabel}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {reason ? (
          <Text
            className="pr-2 text-xs leading-[18px] text-neutral-500"
            numberOfLines={2}
          >
            {reason}
          </Text>
        ) : null}

        {showFooter ? (
          <View className="flex-row flex-wrap items-center justify-end gap-2 border-t border-brand-50 pr-2 pt-3">
            {showAddVital ? (
              <Button
                label={
                  vitalsAdded
                    ? t("appointments.updateVital")
                    : t("appointments.addVital")
                }
                variant="outline"
                size="md"
                loading={openingVitals}
                disabled={rowBusy}
                onPress={onAddVitals}
                style={{ height: 40, minWidth: 112 }}
                className="rounded-xl border-brand-200 bg-brand-50"
              />
            ) : null}
            {primaryAction === "check-in" ? (
              <Button
                label={t("appointments.checkIn")}
                size="md"
                loading={checkingIn}
                disabled={checkInDisabled}
                onPress={onCheckIn}
                style={{ height: 40, minWidth: 112 }}
                className="rounded-xl"
              />
            ) : primaryAction === "open-consult" ? (
              <Button
                label={t("appointments.consult")}
                variant={isCompleted ? "outline" : "primary"}
                size="md"
                loading={opening}
                disabled={rowBusy}
                onPress={onOpenConsult}
                style={{ height: 40, minWidth: 112 }}
                className="rounded-xl"
              />
            ) : primaryAction === "fit-in-slot" ? (
              <Button
                label={t("appointments.fitInNextSlot")}
                variant="outline"
                size="md"
                loading={fittingIn}
                disabled={rowBusy}
                onPress={onFitInNextSlot}
                style={{ height: 40, minWidth: 136 }}
                className="rounded-xl border-brand-200 bg-brand-50"
              />
            ) : primaryAction === "coming-soon" ? (
              <View className="rounded-xl bg-neutral-100 px-3 py-2.5">
                <Text className="text-xs font-medium text-neutral-500">
                  {t("appointments.comingSoon")}
                </Text>
              </View>
            ) : primaryAction === "awaiting-slot" ? (
              <View className="rounded-xl bg-brand-50 px-3 py-2.5">
                <Text className="text-xs font-semibold text-brand-700">
                  {t("appointments.setFollowUpSlot")}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export const AppointmentCard = memo(AppointmentCardInner);
