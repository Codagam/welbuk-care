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
