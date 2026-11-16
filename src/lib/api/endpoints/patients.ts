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
  // Practice accepts display patientId (Int) or Mongo id via patientId / id.
  const res = await api<{
    patient: Patient;
    removedFromFacility?: boolean;
    identityLock?: Patient["identityLock"];
  }>({
    path: "/api/patient/crud",
    query: { patientId: id, facilityId },
  });
  // Both sit beside `patient` in the response; keep them on the record.
  return {
    ...res.patient,
    removedFromFacility: res.removedFromFacility === true,
    identityLock: res.identityLock ?? null,
  };
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

/** One record sharing a mobile, as `POST /api/patient/search` returns it. */
export interface SameMobileMatch {
  id: string;
  patientId?: number | string | null;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  dob?: string | null;
  isPhoneVerified?: boolean | null;
  abhaNumber?: string | null;
  primaryPatientId?: string | null;
  relationshipToPrimary?: string | null;
  parentOrGuardianName?: string | null;
  /** External only: this facility had them and removed them. */
  previouslyAtFacility?: boolean;
  previousMrdNumber?: string | null;
}

/**
 * Who already uses this mobile — Practice web's same-mobile lookup.
 * `local` = records this facility can see; `external` = phone-matched records
 * at other Welbuk facilities (onboard them by OTP, never re-register).
 */
export async function searchPatientsByPhone(
  facilityId: string,
  phone: string,
  signal?: AbortSignal
): Promise<{ local: SameMobileMatch[]; external: SameMobileMatch[] }> {
  const res = await api<{
    patients?: SameMobileMatch[];
    externalPatients?: SameMobileMatch[];
  }>({
    path: "/api/patient/search",
    method: "POST",
    body: {
      page: 1,
      pageSize: 100,
      filters: { phone },
      facilityId,
      includeExternal: true,
    },
    signal,
  });
  return {
    local: Array.isArray(res.patients) ? res.patients : [],
    external: Array.isArray(res.externalPatients) ? res.externalPatients : [],
  };
}

/**
 * Contact consent + language, recorded after the patient exists
 * (`POST /api/patient/consent`, needs `patient.write`).
 */
export function recordPatientConsent(body: {
  patientId: string;
  facilityId: string;
  decisions: { channel: string; purpose: string; granted: boolean }[];
  preferredLanguage?: string;
}): Promise<unknown> {
  return api({
    path: "/api/patient/consent",
    method: "POST",
    body: { ...body, source: "desk" },
  });
}

/** Soft-unlink from facility — does not delete the patient row. */
export function unlinkPatient(body: {
  id: string;
  facilityId: string;
}): Promise<{ success: boolean; message: string }> {
  return api({ path: "/api/patient/crud", method: "DELETE", body });
}
