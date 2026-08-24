import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { getConsultation } from "@/lib/api/endpoints/consult";
import { getPatientHistory } from "@/lib/api/endpoints/consult-data";
import { useFacilityId } from "@/lib/auth/store";
import type { ConsultLock, ConsultPatient } from "./consultPatient";
import { isConsultLocked } from "./consultLock";
import {
  mapPatientHeaderProps,
  mergeConsultPatient,
  type PatientHeaderProps,
} from "./patientHeader";

type HistoryEnvelope = {
  patient?: ConsultPatient | null;
};

/**
 * Lock state from the shared GET /api/consult/:id cache.
 * Lock UI from `consultation.status === "COMPLETED"` only — after a reopen,
 * `lock.completedAt` may still be set.
 */
export function useConsultLock(consultationId: string | undefined) {
  const consultQ = useQuery({
    queryKey: ["consultation", consultationId],
    enabled: !!consultationId,
    queryFn: () => getConsultation(consultationId!),
  });
  const status = consultQ.data?.consultation?.status ?? null;
  const lock: ConsultLock | null = consultQ.data?.lock ?? null;
  return {
    status,
    lock,
    isLocked: isConsultLocked(status),
    refetch: consultQ.refetch,
  };
}

/**
 * Loads header patient from GET /api/consult/:id (primary),
 * then optionally refreshes demographics from patient-history (non-blocking).
 * Mirrors Practice onSetPatient(consultData.patient).
 */
export function useConsultPatientHeader(consultationId: string | undefined) {
  const facilityId = useFacilityId();
  const [patient, setPatient] = useState<ConsultPatient | null>(null);

  const consultQ = useQuery({
    queryKey: ["consultation", consultationId],
    enabled: !!consultationId,
    queryFn: () => getConsultation(consultationId!),
  });

  // Primary: setPatient from consult load (same as web onSetPatient)
  useEffect(() => {
    if (consultQ.data?.patient) {
      setPatient(consultQ.data.patient);
    }
  }, [consultQ.data?.patient]);

  const mongoPatientId =
    consultQ.data?.patient?.id ??
    consultQ.data?.consultation?.patientId ??
    consultQ.data?.patientId ??
    undefined;

  // Secondary: patient-history — must not block header
  const historyQ = useQuery({
    queryKey: [
      "patient-history-header",
      mongoPatientId,
      facilityId,
      consultationId,
    ],
    enabled: !!mongoPatientId && !!facilityId && !!consultationId && !!patient,
    queryFn: () =>
      getPatientHistory({
        patientId: mongoPatientId!,
        facilityId: facilityId!,
        consultationId,
      }) as Promise<HistoryEnvelope>,
  });

  useEffect(() => {
    const histPatient = historyQ.data?.patient;
    if (!histPatient) return;
    setPatient((prev) => mergeConsultPatient(prev, histPatient));
  }, [historyQ.data?.patient]);

  const header = useMemo(
    () => mapPatientHeaderProps(patient),
    [patient]
  );

  const status = consultQ.data?.consultation?.status ?? null;
  const lock: ConsultLock | null = consultQ.data?.lock ?? null;

  return {
    patient,
    header: header as PatientHeaderProps | null,
    /** True while primary consult GET is loading and we have no patient yet */
    isLoading: consultQ.isLoading && !patient,
    isError: consultQ.isError && !patient,
    error: consultQ.error,
    consultation: consultQ.data?.consultation ?? null,
    appointment: consultQ.data?.appointment ?? null,
    doctor: consultQ.data?.doctor ?? null,
    doctorId:
      consultQ.data?.doctor?.id ??
      consultQ.data?.consultation?.doctorId ??
      consultQ.data?.doctorId ??
      null,
    status,
    lock,
    isLocked: isConsultLocked(status),
    reload: consultQ.refetch,
  };
}
