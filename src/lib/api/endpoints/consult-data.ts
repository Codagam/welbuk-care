import { api } from "@/lib/api/client";
import type {
  ConsultSummary,
  DiagnosisCode,
  PatientHistory,
  Prescription,
  PrescriptionItemInput,
  Vitals,
} from "@/features/consult/types";

// ---- Vitals -------------------------------------------------------------

export async function getVitals(consultationId: string): Promise<Vitals> {
  const res = await api<{ vitals: Vitals }>({
    path: `/api/consult/${consultationId}/vitals`,
  });
  return res.vitals ?? {};
}

export function saveVitals(
  consultationId: string,
  vitals: Partial<Vitals>
): Promise<{ vitals: Vitals }> {
  return api({
    path: `/api/consult/${consultationId}/vitals`,
    method: "PATCH",
    body: vitals,
  });
}

// ---- SOAP summary -------------------------------------------------------

export function getSummary(consultationId: string): Promise<ConsultSummary> {
  return api({ path: "/api/consult/summary", query: { consultationId } });
}

export function saveSummary(
  consultationId: string,
  summary: Partial<ConsultSummary>
): Promise<ConsultSummary> {
  return api({
    path: "/api/consult/summary",
    method: "POST",
    body: { consultationId, ...summary },
  });
}

// ---- ICD-10 diagnosis search -------------------------------------------

export async function searchDiagnosisCodes(
  q: string,
  signal?: AbortSignal
): Promise<DiagnosisCode[]> {
  const res = await api<{ codes: DiagnosisCode[] }>({
    path: "/api/consult/diagnosis-codes",
    query: { q, limit: 20 },
    signal,
  });
  return res.codes ?? [];
}

// ---- Prescriptions ------------------------------------------------------

export async function getPrescriptions(
  consultationId: string
): Promise<{ prescriptions: Prescription[]; prescriptionAttachmentUrls: string[] }> {
  const res = await api<{
    prescriptions?: Prescription[];
    prescriptionAttachmentUrls?: string[];
  }>({ path: "/api/consult/prescription", query: { consultationId } });
  return {
    prescriptions: res.prescriptions ?? [],
    prescriptionAttachmentUrls: res.prescriptionAttachmentUrls ?? [],
  };
}

export function addPrescriptionLine(body: {
  consultationId: string;
  appointmentId?: string;
  name: string;
  dosePattern: string;
  foodTiming: string;
  duration: string | number;
  qtyPrescribed?: number;
}): Promise<unknown> {
  return api({ path: "/api/consult/prescription", method: "POST", body });
}

export function deletePrescriptionLine(id: string): Promise<unknown> {
  return api({ path: "/api/consult/prescription", method: "DELETE", query: { id } });
}

export function finalizePrescription(body: {
  consultationId: string;
  appointmentId?: string;
  patientId?: string;
  prescriptions: PrescriptionItemInput[];
  attachmentUrls?: string[];
}): Promise<{ consultationNumber?: string; prescriptions?: Prescription[] }> {
  return api({
    path: "/api/consult/prescription/finalize",
    method: "POST",
    body,
  });
}

// ---- Patient history ----------------------------------------------------

export function getPatientHistory(params: {
  patientId: string;
  facilityId: string;
  consultationId?: string;
}): Promise<PatientHistory> {
  return api({ path: "/api/consult/patient-history", query: params });
}
