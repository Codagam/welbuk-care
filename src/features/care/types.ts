export interface Assignment {
  id: string;
  facilityId: string;
  patientId: string;
  patientName?: string | null;
  staffUserId: string;
  scope: string;
  status: string;
  role?: string | null;
  appointmentId?: string | null;
  startedAt: string;
}

export interface PatientCall {
  id: string;
  facilityId: string;
  patientId: string;
  patientName?: string | null;
  type: string;
  priority: string;
  note?: string | null;
  status: string;
  assignedToUserId?: string | null;
  createdAt: string;
  acknowledgedAt?: string | null;
}

export const CALL_TYPES = ["VITALS", "ASSISTANCE", "PAIN", "REVIEW", "OTHER"] as const;
export const CALL_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
