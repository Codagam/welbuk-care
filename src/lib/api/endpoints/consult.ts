import { api } from "@/lib/api/client";

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
  patient?: { id: string; firstName: string; lastName?: string | null };
}

/** Get-or-create the consultation for an appointment (preferred entry point). */
export async function openConsultForAppointment(
  appointmentId: string
): Promise<ConsultationContext> {
  const res = await api<ConsultEnvelope & Partial<ConsultationContext>>({
    path: `/api/appointment/${appointmentId}/consult`,
  });
  // The endpoint may return { consultation: {...} } or a flat consultation.
  const consult = res.consultation ?? (res as ConsultationContext);
  if (!consult?.id) {
    throw new Error("Could not open the consultation for this appointment.");
  }
  return consult;
}

/** Fetch a full consultation by id (includes inline vitals + context). */
export function getConsultation(id: string): Promise<ConsultEnvelope & ConsultationContext> {
  return api({ path: `/api/consult/${id}` });
}
