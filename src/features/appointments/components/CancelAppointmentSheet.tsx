import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { AppModal, Button } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { useFacilityId } from "@/lib/auth/store";
import { fullName } from "@/features/patients/utils";
import type { Appointment } from "../types";
import {
  formatAppointmentDate,
  formatDoctorNameForDisplay,
  formatTime12h,
} from "../lib/appointmentGates";
import {
  useCancelAppointment,
  type CancelRefund,
} from "../hooks/useAppointmentActions";

function formatRupees(n: number): string {
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function SummaryField({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View className="w-1/2 pb-3 pr-2">
      <Text className="text-xs text-neutral-500">{label}</Text>
      <Text
        className={`text-sm font-semibold ${
          accent ? "text-brand" : "text-neutral-900"
        }`}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "brand" | "neutral" | "error";
  children: string;
}) {
  const box =
    tone === "brand"
      ? "border-brand/20 bg-brand/10"
      : tone === "error"
        ? "border-red-200 bg-red-50"
        : "border-neutral-200 bg-neutral-50";
  const text =
    tone === "brand"
      ? "text-brand"
      : tone === "error"
        ? "text-red-700"
        : "text-neutral-700";
  const iconColor =
    tone === "brand" ? "#FD006A" : tone === "error" ? "#b91c1c" : "#525252";
  return (
    <View className={`flex-row gap-2 rounded-xl border p-3 ${box}`}>
      <Ionicons name="alert-circle-outline" size={18} color={iconColor} />
      <Text className={`flex-1 text-sm ${text}`}>{children}</Text>
    </View>
  );
}

/**
 * Cancel = status CANCELLED with a required `cancelReason` (the visit's own
 * `reason` is left untouched), plus the refund Practice's cancel dialog does:
 *  - online payment → gateway refund of an editable amount, before the cancel
 *  - cash payment   → if staff tick that the fee was handed back, a real
 *                     refund is raised on the bill after the cancel
 * @see practice/Welbuk_/components/appointments/cancel-appointment-dialog.tsx
 */
export function CancelAppointmentSheet({
  appointment,
  onClose,
}: {
  appointment: Appointment;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const cancel = useCancelAppointment();
  const storeFacilityId = useFacilityId();

  /**
   * What the patient actually paid: the stored whole-rupee collect amount when
   * present, else the raw fee — refunding `fee` would leave rounding paise
   * stuck and disagree with the collected total.
   */
  const paidAmountRupees = (() => {
    const collected = Number(appointment.amountPaidRupees);
    if (Number.isFinite(collected) && collected > 0) return collected;
    const fee = Number(appointment.fee);
    return Number.isFinite(fee) && fee > 0 ? fee : 0;
  })();

  const [reason, setReason] = useState("");
  const [refundAmount, setRefundAmount] = useState(
    paidAmountRupees > 0 ? String(paidAmountRupees) : "0"
  );
  /** Cash only: staff confirm the fee was handed back. */
  const [feeRefunded, setFeeRefunded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPayment =
    !!appointment.paymentId && appointment.paymentStatus === "completed";
  const alreadyRefunded = !!appointment.refundId;
  const paymentMethod = (appointment.paymentMethod ?? "").toUpperCase().trim();
  const isCashPayment = paymentMethod === "CASH";
  const canAutoRefund = hasPayment && !alreadyRefunded && !isCashPayment;
  const canCashRefund = hasPayment && !alreadyRefunded && isCashPayment;
  const trimmed = reason.trim();
  const facilityId =
    appointment.facility?.id ?? appointment.facilityId ?? storeFacilityId;

  const patientName = appointment.patient ? fullName(appointment.patient) : "—";
  const start = formatTime12h(appointment.startTime);
  const end = formatTime12h(appointment.endTime);
  const fee = Number(appointment.fee);
  const amountPaid = Number(appointment.amountPaidRupees);
  const showAmountPaid =
    /^(completed|paid|captured|success)$/i.test(
      String(appointment.paymentStatus ?? "").trim()
    ) &&
    Number.isFinite(amountPaid) &&
    amountPaid > 0;

  const onConfirm = async () => {
    setError(null);
    if (!trimmed) {
      setError(t("appointments.cancelSheet.reasonRequired"));
      return;
    }

    let refund: CancelRefund = { kind: "none" };
    if (canAutoRefund) {
      const parsed = parseFloat(refundAmount);
      const amount = Number.isFinite(parsed) ? parsed : paidAmountRupees;
      if (!Number.isFinite(amount) || amount <= 0) {
        setError(t("appointments.cancelSheet.invalidRefundAmount"));
        return;
      }
      refund = {
        kind: "gateway",
        paymentId: appointment.paymentId!,
        paymentMethod:
          paymentMethod === "RQ" ? "RAZORPAY" : paymentMethod || "RAZORPAY",
        amount,
      };
    } else if (canCashRefund && feeRefunded) {
      // Checked before the cancel, so a visit is never cancelled only to fail
      // a check that needs no network.
      if (!facilityId) {
        setError(t("appointments.cancelSheet.missingFacility"));
        return;
      }
      if (!appointment.invoiceNumber) {
        setError(t("appointments.cancelSheet.noBill"));
        return;
      }
      if (!(paidAmountRupees > 0)) {
        setError(t("appointments.cancelSheet.nothingCollected"));
        return;
      }
      refund = {
        kind: "cash",
        facilityId,
        invoiceNumber: appointment.invoiceNumber,
        amount: paidAmountRupees,
      };
    }

    try {
      const result = await cancel.mutateAsync({
        id: appointment.id,
        cancelReason: trimmed,
        refund,
      });
      if (result.cashRefundError) {
        // The visit IS cancelled; close and say what is left to do.
        Alert.alert(
          t("appointments.cancelSheet.cashRefundFailedTitle"),
          t("appointments.cancelSheet.cashRefundFailed", {
            detail: result.cashRefundError,
          })
        );
      }
      onClose();
    } catch (e) {
      setError(describeError(e));
    }
  };

  const busy = cancel.isPending;

  return (
    <AppModal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 items-center justify-center bg-black/40 px-4"
      >
        <View className="max-h-[90%] w-full max-w-[520px] rounded-2xl bg-white">
          <ScrollView
            contentContainerStyle={{ padding: 24, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="gap-1">
              <Text className="text-lg font-semibold text-neutral-900">
                {t("appointments.cancelSheet.title")}
              </Text>
              <Text className="text-sm text-neutral-600">
                {t("appointments.cancelSheet.confirmQuestion")}
              </Text>
            </View>

            <View className="flex-row flex-wrap rounded-xl border border-neutral-200 bg-neutral-50 px-4 pt-3">
              <SummaryField
                label={t("appointments.cancelSheet.patient")}
                value={patientName}
                accent
              />
              <SummaryField
                label={t("appointments.cancelSheet.doctor")}
                value={
                  appointment.doctor?.name
                    ? formatDoctorNameForDisplay(appointment.doctor.name)
                    : "—"
                }
              />
              <SummaryField
                label={t("appointments.cancelSheet.date")}
                value={formatAppointmentDate(
                  appointment.appointmentDate ?? appointment.startTime
                ) || "—"}
              />
              <SummaryField
                label={t("appointments.cancelSheet.time")}
                value={start ? (end ? `${start} – ${end}` : start) : "—"}
              />
              <SummaryField
                label={t("appointments.cancelSheet.visitFee")}
                value={
                  appointment.fee != null && Number.isFinite(fee)
                    ? formatRupees(fee)
                    : t("appointments.cancelSheet.notSet")
                }
              />
              {showAmountPaid ? (
                <SummaryField
                  label={t("appointments.cancelSheet.amountPaid")}
                  value={formatRupees(amountPaid)}
                />
              ) : null}
            </View>

            {canAutoRefund ? (
              <View className="gap-2">
                {paidAmountRupees > 0 ? (
                  <Text className="text-sm text-neutral-500">
                    {t("appointments.cancelSheet.paidAmount", {
                      amount: formatRupees(paidAmountRupees),
                    })}
                  </Text>
                ) : null}
                <Text className="text-sm font-semibold text-neutral-900">
                  {t("appointments.cancelSheet.refundAmount")}
                </Text>
                <TextInput
                  value={refundAmount}
                  onChangeText={setRefundAmount}
                  keyboardType="decimal-pad"
                  editable={!busy}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base text-neutral-900"
                />
                <Text className="text-sm text-neutral-500">
                  {t("appointments.cancelSheet.autoRefundNote")}
                </Text>
              </View>
            ) : null}

            {canCashRefund ? (
              <View className="gap-3">
                <Notice tone="brand">
                  {t("appointments.cancelSheet.cashNotice")}
                </Notice>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: feeRefunded, disabled: busy }}
                  disabled={busy}
                  onPress={() => setFeeRefunded((v) => !v)}
                  className="flex-row items-center gap-2"
                  hitSlop={6}
                >
                  <Ionicons
                    name={feeRefunded ? "checkbox" : "square-outline"}
                    size={22}
                    color={feeRefunded ? "#FD006A" : "#a3a3a3"}
                  />
                  <Text className="flex-1 text-sm text-neutral-900">
                    {t("appointments.cancelSheet.cashCheckbox", {
                      amount: formatRupees(paidAmountRupees),
                    })}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {alreadyRefunded ? (
              <Notice tone="neutral">
                {t("appointments.cancelSheet.alreadyRefunded")}
              </Notice>
            ) : null}

            {!hasPayment ? (
              <Notice tone="neutral">
                {t("appointments.cancelSheet.noPayment")}
              </Notice>
            ) : null}

            <View className="gap-2">
              <Text className="text-sm font-semibold text-neutral-900">
                {t("appointments.cancelSheet.reason")}{" "}
                <Text className="text-red-600">*</Text>
              </Text>
              <TextInput
                value={reason}
                onChangeText={(v) => {
                  setReason(v);
                  if (error) setError(null);
                }}
                editable={!busy}
                placeholder={t("appointments.cancelSheet.reasonPlaceholder")}
                placeholderTextColor="#a3a3a3"
                multiline
                numberOfLines={3}
                maxLength={500}
                textAlignVertical="top"
                className="min-h-[72px] rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base text-neutral-900"
              />
              {!trimmed ? (
                <Text className="text-xs text-red-600">
                  {t("appointments.cancelSheet.reasonRequired")}
                </Text>
              ) : null}
            </View>

            {error ? <Notice tone="error">{error}</Notice> : null}

            <View className="flex-row justify-end gap-3 pt-2">
              <Button
                label={t("appointments.cancelSheet.dismiss")}
                variant="outline"
                onPress={onClose}
                disabled={busy}
              />
              <Button
                label={t("appointments.cancelSheet.confirm")}
                onPress={() => void onConfirm()}
                loading={busy}
                disabled={!trimmed || busy}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </AppModal>
  );
}
