import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { syncAppointmentFee } from "@/lib/api/endpoints/appointments";
import { getFacilityDoctors } from "@/lib/api/endpoints/dental";
import { createPatient } from "@/lib/api/endpoints/patients";
import {
  connectNetworkPatient,
  createWalkInAppointment,
  getDoctorConsultationFee,
  lookupPatientsByPhone,
  type WalkInAppointment,
} from "@/lib/api/endpoints/walk-in";
import { useFacilityId } from "@/lib/auth/store";
import { isValidIndianMobile, splitFullName, type WalkInPatientKind } from "./lib";

/** Same key as the dental provider picker so the list is shared in cache. */
export function useFacilityDoctors() {
  const facilityId = useFacilityId();
  return useQuery({
    queryKey: ["facility-doctors", facilityId],
    enabled: !!facilityId,
    staleTime: 5 * 60_000,
    queryFn: () => getFacilityDoctors(facilityId!),
  });
}

/** Phone-first lookup; runs once the number is a valid 10-digit mobile. */
export function usePhoneLookup(mobile10: string) {
  const facilityId = useFacilityId();
  return useQuery({
    queryKey: ["walk-in-lookup", facilityId, mobile10],
    enabled: !!facilityId && isValidIndianMobile(mobile10),
    staleTime: 0,
    gcTime: 60_000,
    retry: false,
    queryFn: ({ signal }) =>
      lookupPatientsByPhone({ facilityId: facilityId!, phone: mobile10 }, signal),
  });
}

/** Seconds left before "Resend OTP" re-enables. */
export function useCountdown(until: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);
  if (!until) return 0;
  return Math.max(0, Math.ceil((until - now) / 1000));
}

export interface WalkInPatientInput {
  kind: WalkInPatientKind;
  mobile10: string;
  /** Existing patient (facility / network). */
  patientId?: string;
  /** New patient full name. */
  fullName?: string;
  phoneToken?: string | null;
}

/**
 * Make sure the patient exists and is linked here, returning the Mongo id.
 * Facility → as-is. Network → onboard connect (records consent + link).
 * New → POST /api/patient/crud with consent; verified flag only after OTP.
 */
export async function ensureWalkInPatient(
  facilityId: string,
  input: WalkInPatientInput
): Promise<string> {
  if (input.kind === "facility") return input.patientId!;
  if (input.kind === "network") {
    await connectNetworkPatient({
      facilityId,
      patientId: input.patientId!,
      phone: input.mobile10,
      phoneToken: input.phoneToken,
    });
    return input.patientId!;
  }
  const { firstName, lastName } = splitFullName(input.fullName ?? "");
  const res = await createPatient({
    facilityId,
    firstName,
    lastName: lastName || undefined,
    mobile: input.mobile10,
    isPhoneVerified: Boolean(input.phoneToken),
    consentGiven: true,
  });
  return res.patient.id;
}

export function useBookWalkIn() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  return async function book(params: {
    patientId: string;
    doctorId: string;
    slotDurationMinutes?: number;
    reason: string;
  }): Promise<WalkInAppointment | undefined> {
    if (!facilityId) throw new Error("Select a facility first.");
    // Fee is informational for billing — never block a walk-in on it.
    const fee = await getDoctorConsultationFee(params.doctorId, facilityId).catch(
      () => null
    );
    const res = await createWalkInAppointment({
      facilityId,
      doctorId: params.doctorId,
      patientId: params.patientId,
      reason: params.reason,
      fee,
      slotDurationMinutes: params.slotDurationMinutes,
    });
    const appointment = res.appointment;
    if (appointment?.id) {
      void syncAppointmentFee({ appointmentId: appointment.id, facilityId }).catch(
        () => undefined
      );
    }
    void queryClient.invalidateQueries({ queryKey: ["appointments"] });
    return appointment;
  };
}
