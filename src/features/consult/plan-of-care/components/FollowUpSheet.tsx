import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { Button, DateField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import {
  createFacilityAppointment,
  listFacilityAppointments,
  syncAppointmentFee,
  updateFacilityAppointment,
} from "@/lib/api/endpoints/appointments";
import {
  followUpTextForPdf,
  isBookedFollowUpSummaryLine,
  tomorrowYmd,
} from "../followUp";

export function FollowUpSheet({
  open,
  onClose,
  facilityId,
  consultationId,
  patientId,
  doctorId,
  patientLine,
  doctorLine,
  followUpSummaryLine,
  onBooked,
}: {
  open: boolean;
  onClose: () => void;
  facilityId: string;
  consultationId: string;
  patientId: string;
  doctorId: string;
  patientLine?: string;
  doctorLine?: string;
  followUpSummaryLine?: string | null;
  onBooked: (summaryLine: string) => void | Promise<void>;
}) {
  const [ymd, setYmd] = useState(tomorrowYmd());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const canBook =
    facilityId.trim().length > 0 &&
    /^[0-9a-fA-F]{24}$/.test(consultationId.trim()) &&
    /^[0-9a-fA-F]{24}$/.test(patientId.trim()) &&
    /^[0-9a-fA-F]{24}$/.test(doctorId.trim());

  useEffect(() => {
    if (!open) return;
    setError(null);
    setYmd(tomorrowYmd());
    setEditingId(null);

    if (!canBook || !isBookedFollowUpSummaryLine(followUpSummaryLine)) return;

    let cancelled = false;
    (async () => {
      try {
        const rows = await listFacilityAppointments({
          facilityId,
          patientId,
          followUpSourceConsultationId: consultationId,
        });
        if (cancelled) return;
        const eligible = rows
          .filter((a) => {
            const src = String(a.followUpSourceConsultationId ?? "").trim();
            if (src !== consultationId.trim()) return false;
            const status = String(a.status ?? "").toUpperCase();
            return status !== "CANCELLED" && status !== "NO_SHOW";
          })
          .sort((a, b) => {
            const ta = new Date(
              String(a.updatedAt ?? a.createdAt ?? 0)
            ).getTime();
            const tb = new Date(
              String(b.updatedAt ?? b.createdAt ?? 0)
            ).getTime();
            return tb - ta;
          });
        const latest = eligible[0];
        if (latest?.id) {
          setEditingId(String(latest.id));
          const ad = latest.appointmentDate
            ? new Date(String(latest.appointmentDate))
            : null;
          if (ad && !Number.isNaN(ad.getTime())) {
            const y = ad.getFullYear();
            const m = String(ad.getMonth() + 1).padStart(2, "0");
            const d = String(ad.getDate()).padStart(2, "0");
            setYmd(`${y}-${m}-${d}`);
          }
        }
      } catch {
        // Ignore — user can still create
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    canBook,
    facilityId,
    patientId,
    consultationId,
    followUpSummaryLine,
  ]);

  const onSave = async () => {
    setError(null);
    if (!canBook) {
      setError("Need facility, patient, and doctor to schedule a follow-up.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      setError("Pick a valid follow-up date.");
      return;
    }

    setSaving(true);
    try {
      const appointmentDateObj = new Date(ymd);
      appointmentDateObj.setHours(9, 0, 0, 0);
      const end = new Date(appointmentDateObj.getTime() + 30 * 60 * 1000);

      const body: Record<string, unknown> = {
        facilityId,
        doctorId,
        patientId,
        appointmentDate: appointmentDateObj.toISOString(),
        startTime: appointmentDateObj.toISOString(),
        endTime: end.toISOString(),
        status: "TENTATIVE",
        reason: "Follow-up visit",
        isFollowUp: true,
        followUpSourceConsultationId: consultationId,
        awaitingFollowUpSlot: true,
        fee: null,
        questionnaireData: {
          step1: { symptoms: ["Follow-up"], problemStart: "As advised" },
        },
      };

      let apptId: string | undefined;
      if (editingId) {
        const res = await updateFacilityAppointment({
          ...body,
          id: editingId,
        });
        apptId = res.appointment?.id ?? res.id ?? editingId;
      } else {
        const res = await createFacilityAppointment(body);
        apptId = res.appointment?.id ?? res.id;
        if (apptId) {
          void syncAppointmentFee({ appointmentId: apptId, facilityId }).catch(
            () => undefined
          );
        }
      }

      const line = followUpTextForPdf(ymd);
      await onBooked(line);
      onClose();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white px-5 pt-4">
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-brand">
            {editingId ? "Edit follow-up" : "Book follow-up"}
          </Text>
          <Pressable onPress={onClose} className="p-2">
            <Text className="text-brand">Close</Text>
          </Pressable>
        </View>

        {patientLine ? (
          <Text className="mb-1 text-sm text-neutral-600">
            Patient: {patientLine}
          </Text>
        ) : null}
        {doctorLine ? (
          <Text className="mb-4 text-sm text-neutral-600">
            Doctor: {doctorLine}
          </Text>
        ) : null}

        <DateField
          label="Follow-up date"
          value={ymd}
          onChange={setYmd}
          minimumDate={tomorrowYmd()}
        />

        {error ? (
          <Text className="mt-3 text-sm text-red-500">{error}</Text>
        ) : null}

        <View className="mt-6">
          <Button
            label={editingId ? "Update follow-up" : "Book follow-up"}
            onPress={onSave}
            loading={saving}
            disabled={!canBook}
          />
        </View>
      </View>
    </Modal>
  );
}
