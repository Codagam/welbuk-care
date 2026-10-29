import { api } from "@/lib/api/client";
import type {
  AppointmentSearchParams,
  AppointmentSearchResult,
} from "@/features/appointments/types";

/**
 * Practice DataTable list endpoint.
 * POST /api/facility/appointment-search (alias: /api/facility/appointments/search)
 */
export function searchAppointments(
  params: AppointmentSearchParams,
  signal?: AbortSignal
): Promise<AppointmentSearchResult> {
  return api<AppointmentSearchResult>({
    path: "/api/facility/appointment-search",
    method: "POST",
    body: params,
    signal,
  });
}

export interface FacilityAppointment {
  id?: string;
  status?: string;
  appointmentDate?: string;
  startTime?: string;
  endTime?: string;
  followUpSourceConsultationId?: string | null;
  isFollowUp?: boolean;
  awaitingFollowUpSlot?: boolean;
  updatedAt?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export async function listFacilityAppointments(params: {
  facilityId: string;
  patientId: string;
  followUpSourceConsultationId?: string;
  page?: number;
  pageSize?: number;
}): Promise<FacilityAppointment[]> {
  const res = await api<{ appointments?: FacilityAppointment[] }>({
    path: "/api/facility/appointments",
    query: {
      facilityId: params.facilityId,
      patientId: params.patientId,
      followUpSourceConsultationId: params.followUpSourceConsultationId,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
    },
  });
  return res.appointments ?? [];
}

/** Date-only plan-of-care follow-up (TENTATIVE, awaiting slot). */
export function createFacilityAppointment(body: Record<string, unknown>): Promise<{
  appointment?: FacilityAppointment;
  id?: string;
}> {
  return api({
    path: "/api/facility/appointments",
    method: "POST",
    body,
  });
}

export function updateFacilityAppointment(
  body: Record<string, unknown>
): Promise<{ appointment?: FacilityAppointment; id?: string }> {
  return api({
    path: "/api/facility/appointments",
    method: "PUT",
    body,
  });
}

/**
 * Soft-delete — cannot delete COMPLETED. Requires `appointment.delete`.
 * `facilityId` must be in the query: the server checks the permission against
 * it, and without one the check has no facility to look in.
 */
export function deleteFacilityAppointment(params: {
  id: string;
  facilityId: string;
  reason?: string;
}): Promise<{ message?: string }> {
  return api({
    path: "/api/facility/appointments",
    method: "DELETE",
    query: { id: params.id, facilityId: params.facilityId },
    body: params.reason ? { reason: params.reason } : undefined,
  });
}

/**
 * Cancel keeps the row (status CANCELLED) and records `cancelReason` separately
 * from `reason`, which stays the reason for the visit. Requires `appointment.update`.
 */
export function cancelFacilityAppointment(params: {
  id: string;
  cancelReason: string;
}): Promise<{ appointment?: FacilityAppointment; id?: string }> {
  return updateFacilityAppointment({
    id: params.id,
    status: "CANCELLED",
    cancelReason: params.cancelReason,
  });
}

/**
 * Gateway refund of an online-paid visit (Razorpay / RQ). The server caps the
 * amount at what was collected. Requires `billing` write.
 * @see practice/Welbuk_/app/api/payment/refund/route.ts
 */
export function refundAppointmentPayment(params: {
  appointmentId: string;
  paymentId: string;
  paymentMethod: string;
  amount: number;
  reason: string;
}): Promise<unknown> {
  return api({
    path: "/api/payment/refund",
    method: "POST",
    body: {
      paymentMethod: params.paymentMethod,
      flowType: "APPOINTMENT",
      paymentId: params.paymentId,
      amount: params.amount,
      reason: params.reason,
      flowRef: { appointmentId: params.appointmentId },
    },
  });
}

/** Resolves a bill's id from its number. Requires `billing` read. */
export function getInvoiceByNumber(params: {
  facilityId: string;
  invoiceNumber: string;
}): Promise<{ invoice?: { id?: string } }> {
  return api({
    path: `/api/billing/invoices/${encodeURIComponent(params.invoiceNumber)}`,
    query: { facilityId: params.facilityId },
  });
}

export interface BillingRefund {
  id: string;
  /** "APPROVED" when within the facility's auto-approve limit, else "PENDING_APPROVAL". */
  status?: string;
}

/**
 * Raises a cash refund of a visit fee on the bill (`Refund` + `RefundLine`).
 * `visitFeeRupees` is for a booking fee, which has no invoice line of its own;
 * the server resolves and caps the held amount. Requires `billing` write.
 * @see practice/Welbuk_/app/api/billing/refunds/route.ts
 */
export function createCashVisitFeeRefund(params: {
  facilityId: string;
  invoiceId: string;
  visitFeeRupees: number;
  reasonNote: string;
}): Promise<{ refund?: BillingRefund }> {
  return api({
    path: "/api/billing/refunds",
    method: "POST",
    body: {
      facilityId: params.facilityId,
      invoiceId: params.invoiceId,
      method: "CASH",
      reasonCode: "CONSULT_FEE",
      reasonNote: params.reasonNote,
      visitFeeRupees: params.visitFeeRupees,
    },
  });
}

/** Pays out an approved refund (negative receipt + credit note). */
export function disburseRefund(params: {
  facilityId: string;
  refundId: string;
}): Promise<unknown> {
  return api({
    path: `/api/billing/refunds/${encodeURIComponent(params.refundId)}/transition`,
    method: "POST",
    body: { facilityId: params.facilityId, action: "DISBURSE" },
  });
}

export interface DoctorDaySlot {
  startTime: string;
  endTime: string;
  /** Server-formatted span in the facility's timezone, e.g. "10:00 AM - 10:20 AM". */
  label?: string;
  /** Booked or held by someone else. */
  disabled?: boolean;
  past?: boolean;
  afterHours?: boolean;
}

/**
 * The doctor's real slot grid for one day: operating hours, slot length,
 * breaks, booked appointments and active holds, resolved on the server.
 * `excludeAppointmentId` stops the appointment being moved from showing as
 * booked by itself. Requires `appointment.read`.
 */
export function getDoctorDaySlots(
  params: {
    facilityId: string;
    doctorId: string;
    date: string;
    excludeAppointmentId?: string;
  },
  signal?: AbortSignal
): Promise<DoctorDaySlot[]> {
  return api<{ slots?: DoctorDaySlot[] }>({
    path: "/api/facility/appointments/availability",
    query: {
      facilityId: params.facilityId,
      doctorId: params.doctorId,
      date: params.date,
      excludeAppointmentId: params.excludeAppointmentId,
    },
    signal,
  }).then((res) => res.slots ?? []);
}

/** Desk check-in: SCHEDULED → WAITING. Requires `appointment.update`. */
export function checkInAppointment(
  appointmentId: string
): Promise<{ appointment?: FacilityAppointment; id?: string }> {
  return updateFacilityAppointment({ id: appointmentId, status: "WAITING" });
}

/** Late arrival — server picks next slot. Requires `appointment.update`. */
export function lateArrivalAppointment(body: {
  appointmentId: string;
  facilityId: string;
}): Promise<{ appointment?: FacilityAppointment; error?: string }> {
  return api({
    path: "/api/facility/appointments/late-arrival",
    method: "POST",
    body,
  });
}

/** Fire-and-forget fee sync after follow-up create (Practice web does the same). */
export function syncAppointmentFee(body: {
  appointmentId: string;
  facilityId?: string;
}): Promise<unknown> {
  return api({
    path: "/api/billing/sync-appointment-fee",
    method: "POST",
    body,
  });
}
