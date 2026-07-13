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
