import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { getConsultation } from "@/lib/api/endpoints/consult";
import {
  addPrescriptionLine,
  deletePrescriptionLine,
  finalizePrescription,
  getPatientHistory,
  getPrescriptions,
  getSummary,
  getVitals,
  saveSummary,
  saveVitals,
  searchDiagnosisCodes,
} from "@/lib/api/endpoints/consult-data";
import {
  createRecording,
  listRecordings,
} from "@/lib/api/endpoints/recording";
import { useFacilityId } from "@/lib/auth/store";
import type { ConsultSummary, Vitals } from "./types";

export function useConsultation(id: string) {
  return useQuery({
    queryKey: ["consultation", id],
    enabled: !!id,
    queryFn: () => getConsultation(id),
  });
}

// ---- Vitals -------------------------------------------------------------

export function useVitals(id: string) {
  return useQuery({
    queryKey: ["vitals", id],
    enabled: !!id,
    queryFn: () => getVitals(id),
  });
}

export function useSaveVitals(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vitals: Partial<Vitals>) => saveVitals(id, vitals),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vitals", id] }),
  });
}

// ---- SOAP summary -------------------------------------------------------

export function useSummary(id: string) {
  return useQuery({
    queryKey: ["summary", id],
    enabled: !!id,
    queryFn: () => getSummary(id),
  });
}

export function useSaveSummary(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (summary: Partial<ConsultSummary>) => saveSummary(id, summary),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["summary", id] }),
  });
}

export function useDiagnosisSearch(q: string) {
  return useQuery({
    queryKey: ["diagnosis-codes", q.trim()],
    enabled: q.trim().length >= 2,
    queryFn: ({ signal }) => searchDiagnosisCodes(q.trim(), signal),
    staleTime: 5 * 60_000,
  });
}

// ---- Prescriptions ------------------------------------------------------

export function usePrescriptions(id: string) {
  return useQuery({
    queryKey: ["prescriptions", id],
    enabled: !!id,
    queryFn: () => getPrescriptions(id),
  });
}

export function useAddPrescription(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      consultationId: string;
      appointmentId?: string;
      name: string;
      dosePattern: string;
      foodTiming: string;
      duration: string | number;
      qtyPrescribed?: number;
    }) => addPrescriptionLine(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prescriptions", id] }),
  });
}

export function useDeletePrescription(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lineId: string) => deletePrescriptionLine(lineId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prescriptions", id] }),
  });
}

export function useFinalizePrescription(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: finalizePrescription,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prescriptions", id] });
      qc.invalidateQueries({ queryKey: ["consultation", id] });
      qc.invalidateQueries({ queryKey: ["queue"] });
    },
  });
}

// ---- History ------------------------------------------------------------

export function usePatientHistory(
  patientId: string | undefined,
  consultationId: string
) {
  const facilityId = useFacilityId();
  return useQuery({
    queryKey: ["patient-history", patientId, facilityId, consultationId],
    enabled: !!patientId && !!facilityId,
    queryFn: () =>
      getPatientHistory({
        patientId: patientId!,
        facilityId: facilityId!,
        consultationId,
      }),
  });
}

// ---- Recordings ---------------------------------------------------------

export function useRecordings(
  patientId: string | undefined,
  consultationId: string
) {
  const facilityId = useFacilityId();
  return useQuery({
    queryKey: ["recordings", patientId, facilityId, consultationId],
    enabled: !!patientId && !!facilityId,
    queryFn: () =>
      listRecordings({
        patientId: patientId!,
        facilityId: facilityId!,
        consultationId,
      }),
  });
}

export function useCreateRecording(
  patientId: string | undefined,
  consultationId: string
) {
  const qc = useQueryClient();
  const facilityId = useFacilityId();
  return useMutation({
    mutationFn: createRecording,
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["recordings", patientId, facilityId, consultationId],
      }),
  });
}
