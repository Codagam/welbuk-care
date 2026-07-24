/**
 * Port of Practice AppointmentList row action gates.
 * @see practice/Welbuk_/components/appointments/list.tsx
 */

import type { Appointment } from "../types";
import { localCalendarYmd } from "./buildSearchParams";

export function normalizeStatusToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

export function appointmentPaymentStatusIsPaid(
  paymentStatus?: string | null
): boolean {
  const s = String(paymentStatus ?? "")
    .trim()
    .toLowerCase();
  return (
    s === "completed" ||
    s === "paid" ||
    s === "captured" ||
    s === "success" ||
    s === "authorized"
  );
}

export function utcIsoToLocalCalendarYmd(iso: string): string | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return localCalendarYmd(d);
}

export function appointmentLocalYmd(
  appointment: Pick<Appointment, "appointmentDate" | "startTime">
): string | null {
  const iso = appointment.startTime || appointment.appointmentDate;
  if (!iso) return null;
  return utcIsoToLocalCalendarYmd(iso);
}

export function isAppointmentOnToday(
  appointment: Pick<Appointment, "appointmentDate" | "startTime">
): boolean {
  const ymd = appointmentLocalYmd(appointment);
  return Boolean(ymd && ymd === localCalendarYmd());
}

export function isAppointmentInFuture(
  appointment: Pick<Appointment, "appointmentDate" | "startTime">
): boolean {
  const ymd = appointmentLocalYmd(appointment);
  return Boolean(ymd && ymd > localCalendarYmd());
}

export function isAppointmentFollowUp(appointment: Appointment): boolean {
  if (appointment?.isFollowUp === true) return true;
  const src = appointment?.followUpSourceConsultationId;
  return typeof src === "string" && /^[0-9a-fA-F]{24}$/.test(src.trim());
}

export function isFollowUpFeeUnpaid(appointment: Appointment): boolean {
  if (!isAppointmentFollowUp(appointment)) return false;
  const fee = Number(appointment.fee ?? 0);
  if (!Number.isFinite(fee) || fee <= 0) return false;
  return !appointmentPaymentStatusIsPaid(appointment.paymentStatus);
}

export function isFollowUpAwaitingTimeSlot(appointment: Appointment): boolean {
  if (!isAppointmentFollowUp(appointment)) return false;
  if (appointment.awaitingFollowUpSlot === false) return false;
  if (appointment.awaitingFollowUpSlot === true) return true;
  const s = normalizeStatusToken(appointment.status);
  if (s === "TENTATIVE" || s === "PENDING_PAYMENT") return true;
  return false;
}

export function isFollowUpFeeDueAfterSlotSet(appointment: Appointment): boolean {
  return (
    isFollowUpFeeUnpaid(appointment) && !isFollowUpAwaitingTimeSlot(appointment)
  );
}

export function isPreConsultVitalStatus(status: unknown): boolean {
  const s = normalizeStatusToken(status);
  return (
    s === "SCHEDULED" ||
    s === "CONFIRMED" ||
    s === "RESCHEDULE" ||
    s === "IN_PROGRESS" ||
    s === "NO_SHOW" ||
    s === "TENTATIVE"
  );
}

export function canOpenConsultFromMenu(appointment: Appointment): boolean {
  const appointmentStatus = normalizeStatusToken(appointment.status);
  const followUpFeeDueAfterSlot = isFollowUpFeeDueAfterSlotSet(appointment);
  return (
    (appointmentStatus === "WAITING" ||
      appointmentStatus === "IN_PROGRESS" ||
      appointmentStatus === "COMPLETED") &&
    !followUpFeeDueAfterSlot &&
    isAppointmentOnToday(appointment)
  );
}

/**
 * Primary row open action — web "Add Vital" (pre-vital, today) plus ⋮ "Open Consult".
 * @see practice/Welbuk_/components/appointments/list.tsx
 */
export function canOpenAppointmentFromList(
  appointment: Appointment
): boolean {
  const followUpFeeDueAfterSlot = isFollowUpFeeDueAfterSlotSet(appointment);
  if (followUpFeeDueAfterSlot) return false;
  if (isFollowUpAwaitingTimeSlot(appointment)) return false;
  if (!isAppointmentOnToday(appointment)) return false;

  const appointmentStatus = normalizeStatusToken(appointment.status);
  if (
    appointmentStatus === "WAITING" ||
    appointmentStatus === "IN_PROGRESS" ||
    appointmentStatus === "COMPLETED"
  ) {
    return true;
  }

  if (isPreConsultVitalStatus(appointment.status)) {
    if (!appointment.appointmentDate && !appointment.startTime) return false;
    if (isAppointmentInFuture(appointment)) return false;
    return true;
  }

  return false;
}

export function canDownloadAppointmentInvoice(
  appointment: Appointment
): boolean {
  const fee = Number(appointment.fee ?? 0);
  if (!Number.isFinite(fee) || fee <= 0) return false;
  return appointmentPaymentStatusIsPaid(appointment.paymentStatus);
}

export function formatDoctorNameForDisplay(name?: string | null): string {
  const n = (name ?? "").trim();
  if (!n) return "";
  if (/^dr\.?\s/i.test(n)) return n;
  return n;
}

export function formatEnumValue(status?: string | null): string {
  if (!status) return "";
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatTime12h(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatAppointmentDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
