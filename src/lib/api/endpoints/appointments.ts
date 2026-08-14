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

/** Soft-delete — cannot delete COMPLETED. */
export function deleteFacilityAppointment(id: string): Promise<{ message?: string }> {
  return api({
    path: "/api/facility/appointments",
    method: "DELETE",
    query: { id },
  });
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
