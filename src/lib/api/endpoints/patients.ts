import { api } from "@/lib/api/client";
import type {
  Patient,
  PatientSearchParams,
  PatientSearchResult,
  PatientWriteInput,
} from "@/features/patients/types";

export function searchPatients(
  params: PatientSearchParams,
  signal?: AbortSignal
): Promise<PatientSearchResult> {
  return api<PatientSearchResult>({
    path: "/api/patient/search",
    method: "POST",
    body: params,
    signal,
  });
}

export async function getPatient(
  id: string,
  facilityId: string
): Promise<Patient> {
  const res = await api<{ patient: Patient }>({
    path: "/api/patient/crud",
    query: { id, facilityId },
  });
  return res.patient;
}

export function createPatient(
  body: PatientWriteInput
): Promise<{ message: string; patientId: number; patient: Patient; warning?: string }> {
  return api({ path: "/api/patient/crud", method: "POST", body });
}

export function updatePatient(
  body: PatientWriteInput
): Promise<{ message: string; patient: Patient }> {
  return api({ path: "/api/patient/crud", method: "PUT", body });
}
