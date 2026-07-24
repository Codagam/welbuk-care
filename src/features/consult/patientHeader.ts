import type { ConsultPatient } from "./consultPatient";

/** Practice `calculateAge` — UTC year-diff from DOB. */
export function calculateAge(dob: Date | string | null | undefined): number {
  if (!dob) return 0;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return 0;
  const diff = Date.now() - birth.getTime();
  if (diff < 0) return 0;
  return new Date(diff).getUTCFullYear() - 1970;
}

/** DOB as DD/MM/YYYY (Practice formatPatientDateShort / en-GB). */
export function formatDobShort(dob?: string | Date | null): string {
  if (!dob) return "";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function consultPatientDisplayName(p?: ConsultPatient | null): string {
  if (!p) return "";
  if (p.name?.trim()) return p.name.trim();
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
}

/**
 * Practice page.tsx `patientProps` mapping for the pink header.
 * Age: dob ? calculateAge(dob) : (age ?? 0)
 */
export type PatientHeaderProps = {
  name: string;
  patientId: number | string | null;
  phone: string;
  dob: string | Date | null;
  dobFormatted: string;
  age: number;
};

export function mapPatientHeaderProps(
  patient?: ConsultPatient | null
): PatientHeaderProps | null {
  if (!patient) return null;

  const name = consultPatientDisplayName(patient);
  const patientId =
    patient.patientId != null && String(patient.patientId).trim() !== ""
      ? patient.patientId
      : null;
  const phone = (patient.phone ?? patient.phoneNumber ?? "").trim();
  const dob = patient.dob ?? null;
  const age = dob ? calculateAge(dob) : (patient.age ?? 0);

  return {
    name: name || "Patient",
    patientId,
    phone,
    dob,
    dobFormatted: formatDobShort(dob),
    age,
  };
}

/** Merge history patient onto consult patient without dropping primary fields. */
export function mergeConsultPatient(
  primary: ConsultPatient | null | undefined,
  secondary: ConsultPatient | null | undefined
): ConsultPatient | null {
  if (!primary && !secondary) return null;
  if (!primary) return secondary ?? null;
  if (!secondary) return primary;
  return {
    ...primary,
    ...secondary,
    // Prefer non-empty primary demographics for first paint stability
    id: primary.id || secondary.id,
    patientId: primary.patientId ?? secondary.patientId,
    name: primary.name?.trim() || secondary.name,
    dob: primary.dob ?? secondary.dob,
    age: primary.age ?? secondary.age,
    phone: primary.phone?.trim() || secondary.phone,
    phoneNumber: primary.phoneNumber?.trim() || secondary.phoneNumber,
    email: primary.email ?? secondary.email,
  };
}
