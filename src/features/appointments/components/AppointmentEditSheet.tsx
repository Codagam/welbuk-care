import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { AppModal, Button, DateField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import type { DoctorDaySlot } from "@/lib/api/endpoints/appointments";
import { useFacilityDoctors } from "@/features/walk-in/hooks";
import { fullName } from "@/features/patients/utils";
import type { Appointment } from "../types";
import {
  appointmentLocalYmd,
  formatDoctorNameForDisplay,
} from "../lib/appointmentGates";
import { localCalendarYmd } from "../lib/buildSearchParams";
import {
  useDoctorDaySlots,
  useUpdateAppointment,
} from "../hooks/useAppointmentActions";

export type AppointmentEditMode = "reschedule" | "changeDoctor";

const TITLE_KEY: Record<AppointmentEditMode, string> = {
  reschedule: "appointments.actions.reschedule",
  changeDoctor: "appointments.actions.changeDoctor",
};

function sameInstant(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

/**
 * One sheet, two jobs, each a single PUT /api/facility/appointments:
 *  - reschedule:  { id, appointmentDate, startTime, endTime }
 *  - changeDoctor: { id, doctorId }
 *
 * The server validates every move (frozen status, break, slot taken, patient
 * double-booked) and answers with a message; it is shown as-is.
 */
export function AppointmentEditSheet({
  appointment,
  mode,
  onClose,
}: {
  appointment: Appointment;
  mode: AppointmentEditMode;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const update = useUpdateAppointment();
  const [error, setError] = useState<string | null>(null);

  const today = localCalendarYmd();
  const doctorId = appointment.doctor?.id ?? appointment.doctorId ?? null;
  const patientName = appointment.patient ? fullName(appointment.patient) : "—";

  // ── Reschedule ───────────────────────────────────────────────
  // Opens on the visit's own date, unless that has already gone.
  const [date, setDate] = useState(() => {
    const own = appointmentLocalYmd(appointment);
    return own && own >= today ? own : today;
  });
  const [slot, setSlot] = useState<DoctorDaySlot | null>(null);
  const slotsQ = useDoctorDaySlots({
    doctorId,
    date,
    excludeAppointmentId: appointment.id,
    enabled: mode === "reschedule",
  });
  // A slot belongs to the day it was picked on.
  const onDateChange = (ymd: string) => {
    setDate(ymd);
    setSlot(null);
  };

  // ── Change doctor ────────────────────────────────────────────
  const doctorsQ = useFacilityDoctors();
  const [newDoctorId, setNewDoctorId] = useState<string | null>(null);
  const otherDoctors = useMemo(
    () => (doctorsQ.data ?? []).filter((d) => d.id && d.id !== doctorId),
    [doctorsQ.data, doctorId]
  );

  const canSave =
    mode === "reschedule"
      ? Boolean(slot) && !sameInstant(slot?.startTime, appointment.startTime)
      : Boolean(newDoctorId);

  const onSave = async () => {
    setError(null);
    let body: Record<string, unknown> & { id: string };
    if (mode === "reschedule") {
      if (!slot) return;
      if (date < today) {
        setError(t("appointments.edit.dateInPast"));
        return;
      }
      body = {
        id: appointment.id,
        // Same shape Practice's reschedule dialog sends: the day as UTC
        // midnight, the time as the slot's own instant. The server joins them.
        appointmentDate: `${date}T00:00:00.000Z`,
        startTime: slot.startTime,
        endTime: slot.endTime,
      };
    } else {
      if (!newDoctorId) return;
      // Doctor only. The server checks the new doctor's calendar at the
      // existing time, and leaving status alone keeps a checked-in patient
      // checked in.
      body = { id: appointment.id, doctorId: newDoctorId };
    }

    try {
      await update.mutateAsync(body);
      onClose();
    } catch (e) {
      setError(describeError(e));
    }
  };

  return (
    <AppModal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-5 pb-2 pt-4">
          <View className="min-w-0 flex-1">
            <Text className="text-lg font-semibold text-brand">
              {t(TITLE_KEY[mode])}
            </Text>
            <Text className="text-sm text-neutral-600" numberOfLines={1}>
              {patientName}
              {appointment.doctor?.name
                ? ` · ${formatDoctorNameForDisplay(appointment.doctor.name)}`
                : ""}
            </Text>
          </View>
          <Pressable onPress={onClose} className="p-2" hitSlop={8}>
            <Text className="text-brand">{t("appointments.edit.close")}</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {mode === "reschedule" ? (
            <>
              <DateField
                label={t("appointments.edit.date")}
                value={date}
                onChange={onDateChange}
                minimumDate={today}
              />
              <Text className="text-sm font-medium text-neutral-700">
                {t("appointments.edit.slot")}
              </Text>
              {!doctorId ? (
                <Text className="text-sm text-red-500">
                  {t("appointments.edit.noDoctor")}
                </Text>
              ) : slotsQ.isLoading ? (
                <ActivityIndicator color="#FD006A" />
              ) : slotsQ.isError ? (
                <Text className="text-sm text-red-500">
                  {describeError(slotsQ.error)}
                </Text>
              ) : (slotsQ.data ?? []).length === 0 ? (
                <Text className="text-sm text-neutral-500">
                  {t("appointments.edit.noSlots")}
                </Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {(slotsQ.data ?? []).map((s) => {
                    const current = sameInstant(s.startTime, appointment.startTime);
                    const blocked = s.disabled === true || s.past === true;
                    const selected = slot?.startTime === s.startTime;
                    return (
                      <Pressable
                        key={s.startTime}
                        disabled={blocked || current}
                        onPress={() => setSlot(s)}
                        className={`rounded-lg border px-3 py-2 ${
                          selected
                            ? "border-brand bg-brand"
                            : current
                              ? "border-brand/40 bg-brand/10"
                              : blocked
                                ? "border-neutral-200 bg-neutral-100"
                                : "border-neutral-300 bg-white active:bg-neutral-50"
                        }`}
                      >
                        <Text
                          className={`text-xs font-medium ${
                            selected
                              ? "text-white"
                              : current
                                ? "text-brand"
                                : blocked
                                  ? "text-neutral-400 line-through"
                                  : "text-neutral-800"
                          }`}
                        >
                          {s.label?.trim() || s.startTime}
                        </Text>
                        {current ? (
                          <Text className="text-[10px] text-brand">
                            {t("appointments.edit.currentSlot")}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          ) : null}

          {mode === "changeDoctor" ? (
            doctorsQ.isLoading ? (
              <ActivityIndicator color="#FD006A" />
            ) : doctorsQ.isError ? (
              <Text className="text-sm text-red-500">
                {describeError(doctorsQ.error)}
              </Text>
            ) : otherDoctors.length === 0 ? (
              <Text className="text-sm text-neutral-500">
                {t("appointments.edit.noOtherDoctors")}
              </Text>
            ) : (
              <View className="gap-2">
                {otherDoctors.map((d) => {
                  const selected = d.id === newDoctorId;
                  return (
                    <Pressable
                      key={d.id}
                      onPress={() => setNewDoctorId(d.id)}
                      className={`rounded-xl border px-4 py-3 ${
                        selected
                          ? "border-brand bg-brand/10"
                          : "border-neutral-300 bg-white active:bg-neutral-50"
                      }`}
                    >
                      <Text className="text-base font-medium text-neutral-900">
                        {formatDoctorNameForDisplay(d.name)}
                      </Text>
                      {d.specialization ? (
                        <Text className="text-xs text-neutral-500">
                          {formatDoctorNameForDisplay(d.specialization)}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
                <Text className="text-xs text-neutral-500">
                  {t("appointments.edit.sameTimeHint")}
                </Text>
              </View>
            )
          ) : null}

          {error ? <Text className="text-sm text-red-500">{error}</Text> : null}

          <Button
            label={t("appointments.edit.save")}
            onPress={() => void onSave()}
            loading={update.isPending}
            disabled={!canSave || update.isPending}
          />
        </ScrollView>
      </View>
    </AppModal>
  );
}
