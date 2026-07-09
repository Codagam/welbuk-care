export interface AppointmentPatient {
  id: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  abhaNumber?: string | null;
}

export interface AppointmentDoctor {
  id: string;
  name?: string | null;
}

export interface Appointment {
  id: string;
  status: string;
  startTime?: string | null;
  appointmentDate?: string | null;
  reason?: string | null;
  appointmentType?: string | null;
  doctorId?: string | null;
  patientId?: string | null;
  doctor?: AppointmentDoctor | null;
  patient?: AppointmentPatient | null;
}

export interface AppointmentSearchParams {
  facilityId: string;
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
}

export interface AppointmentSearchResult {
  data: Appointment[];
  totalCount: number;
  currentPage: number;
  truncated?: boolean;
}
