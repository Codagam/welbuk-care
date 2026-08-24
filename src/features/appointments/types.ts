/**
 * Appointment row shape aligned with Practice appointment-search response.
 * Extends the slim queue type with fields the full list needs.
 */

export interface AppointmentPatient {
  id: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  /** Numeric/public patient id for display */
  patientId?: number | string | null;
  abhaNumber?: string | null;
}

export interface AppointmentDoctor {
  id: string;
  name?: string | null;
  specialization?: string | null;
  doctorId?: number | string | null;
}

export interface AppointmentFacility {
  id: string;
  name?: string | null;
  facilityId?: number | string | null;
}

export interface Appointment {
  id: string;
  status: string;
  startTime?: string | null;
  endTime?: string | null;
  appointmentDate?: string | null;
  reason?: string | null;
  notes?: string | null;
  appointmentType?: string | null;
  doctorId?: string | null;
  patientId?: string | null;
  facilityId?: string | null;
  fee?: number | null;
  paymentId?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  refundId?: string | null;
  refundStatus?: string | null;
  refundAmount?: number | null;
  rescheduleCount?: number | null;
  isFollowUp?: boolean | null;
  awaitingFollowUpSlot?: boolean | null;
  followUpSourceConsultationId?: string | null;
  tentativeCreatedAt?: string | null;
  dropsAt?: string | null;
  tokenNumber?: number | null;
  tokenSeries?: "PRIOR" | "WALK_IN" | "EMERGENCY" | null;
  doctor?: AppointmentDoctor | null;
  patient?: AppointmentPatient | null;
  facility?: AppointmentFacility | null;
}

export interface AppointmentSearchFilters {
  status?: string;
  doctor?: string;
  doctorName?: string;
  patient?: string;
  patientName?: string;
  reason?: string;
}

export interface AppointmentSearchParams {
  facilityId?: string;
  doctorId?: string;
  patientId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  filters?: AppointmentSearchFilters;
  followUpOnly?: boolean | "true" | 1;
  paymentFailureTentativeOnly?: boolean | "true" | 1;
  hideTentativeFromList?: boolean | "true" | 1;
}

export interface AppointmentSearchResult {
  data: Appointment[];
  totalCount: number;
  currentPage: number;
  truncated?: boolean;
}

/** Column / UI filters owned by the list screen. */
export interface AppointmentListFilters {
  /** Date as YYYY-MM-DD, or "" when cleared / all-dates mode */
  date: string;
  patient: string;
  doctor: string;
  reason: string;
  status: string;
  /** True after user taps “Clear filters” (today + future window). */
  filtersCleared: boolean;
}

export const APPOINTMENT_STATUS_OPTIONS = [
  "TENTATIVE",
  "PENDING_PAYMENT",
  "SCHEDULED",
  "CONFIRMED",
  "WAITING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "RESCHEDULE",
  "DROPS",
] as const;

export type AppointmentStatusOption =
  (typeof APPOINTMENT_STATUS_OPTIONS)[number];
