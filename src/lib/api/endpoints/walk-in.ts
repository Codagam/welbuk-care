/**
 * Front-desk walk-in booking — Practice onboarding + OTP + appointment APIs.
 *
 * - POST /api/patient/onboard/lookup      phone → existing patients (+ facility link flag)
 * - POST /api/otp/send                    issue OTP → { sessionId }
 * - POST /api/patient/onboard/verify-phone  { sessionId, otp, phone } → { phoneToken }
 * - POST /api/patient/onboard (connect)   link a Welbuk network patient to this facility
 * - GET  /api/doctor/availability         doctor consultation fee for the walk-in
 */
import { api } from "@/lib/api/client";
import type { Patient } from "@/features/patients/types";
import type { FacilityAppointment } from "./appointments";

export interface OnboardLookupPatient {
  /** Mongo id. */
  id: string;
  /** Display patient number. */
  patientId: number;
  firstName: string;
  lastName: string;
  gender: string | null;
  dob: string | null;
  phone: string | null;
  relationshipToPrimary: string | null;
  primaryPatientId: string | null;
  /** Active FacilityPatient link at the queried facility. */
  isLinkedToFacility: boolean;
}

/** Staff session: `patient.create` on the facility; no phone token required. */
export async function lookupPatientsByPhone(
  body: { facilityId: string; phone: string; phoneToken?: string | null },
  signal?: AbortSignal
): Promise<OnboardLookupPatient[]> {
  const res = await api<{ patients?: OnboardLookupPatient[] }>({
    path: "/api/patient/onboard/lookup",
    method: "POST",
    body,
    signal,
  });
  return Array.isArray(res.patients) ? res.patients : [];
}

export function sendPhoneOtp(phone: string): Promise<{ sessionId: string }> {
  return api({ path: "/api/otp/send", method: "POST", body: { phone } });
}

export function verifyPhoneOtp(body: {
  sessionId: string;
  otp: string;
  phone: string;
}): Promise<{ success: boolean; phoneToken: string }> {
  return api({
    path: "/api/patient/onboard/verify-phone",
    method: "POST",
    body,
  });
}

/** Link an existing (other-facility) patient here and record consent. */
export function connectNetworkPatient(body: {
  facilityId: string;
  patientId: string;
  phone: string;
  phoneToken?: string | null;
}): Promise<{ message: string; patient: Patient | null }> {
  return api({
    path: "/api/patient/onboard",
    method: "POST",
    body: { ...body, mode: "connect", consentGiven: true },
  });
}

/** Doctor's consultation fee at the facility (falls back to facility fee server-side). */
export async function getDoctorConsultationFee(
  doctorId: string,
  facilityId: string
): Promise<number | null> {
  const res = await api<{ consultationFee?: number | null }>({
    path: "/api/doctor/availability",
    query: { doctorId, facilityId },
  });
  const fee = Number(res.consultationFee);
  return Number.isFinite(fee) && fee > 0 ? fee : null;
}

export interface WalkInAppointment extends FacilityAppointment {
  tokenNumber?: number | null;
  tokenSeries?: string | null;
}

/**
 * Walk-in create — mirrors Practice `appointment-form` walk-in submit:
 * arrival clock as start, server slots it and assigns the W-token.
 */
export function createWalkInAppointment(params: {
  facilityId: string;
  doctorId: string;
  patientId: string;
  reason: string;
  fee: number | null;
  slotDurationMinutes?: number;
}): Promise<{ appointment?: WalkInAppointment }> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const appointmentDate = new Date(`${y}-${m}-${d}`);
  const start = new Date(appointmentDate);
  start.setHours(now.getHours(), now.getMinutes(), 0, 0);
  const end = new Date(appointmentDate);
  end.setHours(
    now.getHours(),
    now.getMinutes() + (params.slotDurationMinutes ?? 30),
    0,
    0
  );

  const fee = params.fee != null && params.fee > 0 ? params.fee : 0;

  return api({
    path: "/api/facility/appointments",
    method: "POST",
    body: {
      facilityId: params.facilityId,
      doctorId: params.doctorId,
      patientId: params.patientId,
      appointmentType: "Walk-in",
      appointmentDate: appointmentDate.toISOString(),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      status: "SCHEDULED",
      reason: params.reason,
      fee,
      // Fee is collected at billing — same as the web desk's "skip payment".
      ...(fee > 0 ? { paymentStatus: "unpaid" } : {}),
      questionnaireData: {
        step1: { symptoms: ["Walk-in"], problemStart: "Today" },
      },
    },
  });
}
