import { api } from "@/lib/api/client";
import type { ConsultLoadResponse } from "@/features/consult/consultPatient";

export interface ConsultationContext {
  id: string;
  facilityId?: string | null;
  doctorId?: string | null;
  patientId?: string | null;
  status?: string | null;
  prescriptionId?: string | null;
  consultationNumber?: string | null;
}

interface ConsultEnvelope {
  consultation?: ConsultationContext;
  patient?: ConsultLoadResponse["patient"];
}

/** Get-or-create the consultation for an appointment (preferred entry point). */
export async function openConsultForAppointment(
  appointmentId: string
): Promise<ConsultationContext> {
  const res = await api<ConsultEnvelope & Partial<ConsultationContext>>({
    path: `/api/appointment/${appointmentId}/consult`,
  });
  const consult = res.consultation ?? (res as ConsultationContext);
  if (!consult?.id) {
    throw new Error("Could not open the consultation for this appointment.");
  }
  return consult;
}

/**
 * Full consult load — patient header fields (patientId, dob, age, phone, name)
 * come from `response.patient`, not a separate details API.
 * Base URL: EXPO_PUBLIC_PRACTICE_URL via api client; Auth: Bearer JWT.
 */
export function getConsultation(id: string): Promise<ConsultLoadResponse> {
  return api({ path: `/api/consult/${id}` });
}

export type ReopenConsultationResponse = {
  ok: true;
  alreadyOpen: boolean;
  status: string;
  reopenedAt?: string;
  reopenCount?: number;
  reopenReason?: string | null;
};

/**
 * Unlock a COMPLETED consultation. Reason must be ≥ 3 whitespace-separated
 * words (enforced client + server). Idempotent if already not COMPLETED.
 */
export function reopenConsultation(
  id: string,
  reason: string
): Promise<ReopenConsultationResponse> {
  return api({
    path: `/api/consult/${id}/reopen`,
    method: "POST",
    body: { reason: reason.trim() },
  });
}

/** Walk-in / triple-id path — also returns `patient` for the header. */
export function createConsultation(body: {
  patientId: string;
  doctorId: string;
  facilityId: string;
}): Promise<ConsultLoadResponse> {
  return api({
    path: "/api/consult/create",
    method: "POST",
    body,
  });
}

/**
 * Doctor signals front desk they are ready for the next patient.
 * Does not select/open a consultation — notify only (POST /api/consult/ready-for-next).
 */
export function readyForNextPatient(facilityId: string): Promise<{
  success: boolean;
}> {
  return api({
    path: "/api/consult/ready-for-next",
    method: "POST",
    body: { facilityId },
  });
}
