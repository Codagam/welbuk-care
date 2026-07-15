import { api } from "@/lib/api/client";
import type {
  AppointmentSearchParams,
  AppointmentSearchResult,
} from "@/features/queue/types";

/**
 * The consult/queue DataTable endpoint. Sending a date range + facility returns
 * that day's queue, sorted by status priority (IN_PROGRESS > WAITING > … ).
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
