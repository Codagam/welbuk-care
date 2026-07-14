import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { getConsultation } from "@/lib/api/endpoints/consult";
import { getPatientHistory } from "@/lib/api/endpoints/consult-data";
import { useFacilityId } from "@/lib/auth/store";
import type { ConsultPatient } from "./consultPatient";
import {
  mapPatientHeaderProps,
  mergeConsultPatient,
  type PatientHeaderProps,
} from "./patientHeader";

type HistoryEnvelope = {
  patient?: ConsultPatient | null;
};

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
    reload: consultQ.refetch,
  };
}
