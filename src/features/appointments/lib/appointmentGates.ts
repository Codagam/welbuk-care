/**
 * Port of Practice AppointmentList row action gates.
 * @see practice/Welbuk_/components/appointments/list.tsx
 */

import type { Appointment } from "../types";
import { resolveOverdueState } from "./appointmentLifecycle";
import { localCalendarYmd } from "./buildSearchParams";
import {
  isWaitlistSeries,
  isWalkInAppointmentType,
  tokenSeriesOrDefault,
} from "./tokenSeries";

export function normalizeStatusToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

const PRE_ARRIVAL_STATUSES = new Set([
  "TENTATIVE",
  "PENDING_PAYMENT",
  "SCHEDULED",
  "CONFIRMED",
]);

function isPreArrivalStatus(status?: string | null): boolean {
  return PRE_ARRIVAL_STATUSES.has(normalizeStatusToken(status));
}

/**
 * Pre-arrival visit past its slot + grace — treat as NO_SHOW for desk actions.
 * EMERGENCY is never auto no-show.
 */
export function isAutoNoShowCandidate(
  entry: {
    status?: string | null;
    startTime?: string | null;
    tokenSeries?: string | null;
  },
  now: Date = new Date()
): boolean {
  if (entry.tokenSeries === "EMERGENCY") return false;
  if (!isPreArrivalStatus(entry.status)) return false;
  return resolveOverdueState(entry, now).overdue;
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
    s === "WAITING" ||
    s === "RESCHEDULE" ||
    s === "TENTATIVE"
  );
}

/** Walk-in / emergency — patient is already at the desk; skip Check-in. */
export function isWaitlistVisit(
  appointment: Pick<Appointment, "appointmentType" | "tokenSeries">
): boolean {
  if (isWalkInAppointmentType(appointment.appointmentType)) return true;
  return isWaitlistSeries(tokenSeriesOrDefault(appointment.tokenSeries));
}

/** Stored or auto-derived NO_SHOW — Check-in is replaced by Fit in next slot. */
export function isTreatAsNoShow(
  appointment: Pick<Appointment, "status" | "startTime" | "tokenSeries">
): boolean {
  if (appointment.tokenSeries === "EMERGENCY") return false;
  const status = normalizeStatusToken(appointment.status);
  if (status === "NO_SHOW") return true;
  return isAutoNoShowCandidate({
    status,
    startTime: appointment.startTime ?? null,
    tokenSeries: appointment.tokenSeries ?? null,
  });
}

/**
 * Desk Check-in CTA — booked PRIOR visit today, status SCHEDULED only.
 * Walk-in / emergency / CONFIRMED / WAITING never get Check-in.
 */
export function shouldShowCheckIn(appointment: Appointment): boolean {
  if (isFollowUpAwaitingTimeSlot(appointment)) return false;
  if (isTreatAsNoShow(appointment)) return false;
  if (!isAppointmentOnToday(appointment)) return false;
  if (normalizeStatusToken(appointment.status) !== "SCHEDULED") return false;
  if (isWaitlistVisit(appointment)) return false;
  if (!appointment.appointmentDate && !appointment.startTime) return false;
  return true;
}

/**
 * Open appointment / consult from the list (vitals recorded inside consult).
 * Booked SCHEDULED must Check-in first; walk-ins and post-arrival statuses may open.
 */
export function canOpenAppointmentFromList(
  appointment: Appointment
): boolean {
  const followUpFeeDueAfterSlot = isFollowUpFeeDueAfterSlotSet(appointment);
  if (followUpFeeDueAfterSlot) return false;
  if (isFollowUpAwaitingTimeSlot(appointment)) return false;
  if (isTreatAsNoShow(appointment)) return false;
  if (!isAppointmentOnToday(appointment)) return false;

  const appointmentStatus = normalizeStatusToken(appointment.status);
  if (
    appointmentStatus === "WAITING" ||
    appointmentStatus === "IN_PROGRESS" ||
    appointmentStatus === "COMPLETED"
  ) {
    return true;
  }

  if (!isPreConsultVitalStatus(appointment.status)) return false;
  if (!appointment.appointmentDate && !appointment.startTime) return false;
  if (isAppointmentInFuture(appointment)) return false;

  // Booked PRIOR still on SCHEDULED must use Check-in before opening.
  if (appointmentStatus === "SCHEDULED" && !isWaitlistVisit(appointment)) {
    return false;
  }

  return true;
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
