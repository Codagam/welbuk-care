import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { getConsultation } from "@/lib/api/endpoints/consult";
import {
  addPrescriptionLine,
  deletePatientLabReport,
  deletePrescriptionLine,
  finalizePrescription,
  getConversation,
  getPatientHistory,
  getPrescriptions,
  getSummary,
  getVitals,
  patchReportAttachmentUrls,
  saveSummary,
  saveVitals,
  searchDiagnosisCodes,
} from "@/lib/api/endpoints/consult-data";
import {
  listPatientDocuments,
  uploadPatientDocument,
} from "@/lib/api/endpoints/documents";
import {
  createRecording,
  listRecordings,
} from "@/lib/api/endpoints/recording";
import { getSiteConfigEnabled } from "@/lib/api/endpoints/site-config";
import { useFacilityId } from "@/lib/auth/store";
import type { ConsultSummary, Vitals } from "./types";
import { refetchConsultIfCompletedLock } from "./consultLock";

export function useConsultation(id: string) {
  return useQuery({
    queryKey: ["consultation", id],
    enabled: !!id,
    queryFn: () => getConsultation(id),
  });
}

export { useConsultPatientHeader, useConsultLock } from "./useConsultPatientHeader";

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vitals", id] });
      // Backend moves appointment SCHEDULED → WAITING after vitals save.
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["queue"] });
    },
    onError: (err) => refetchConsultIfCompletedLock(qc, id, err),
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
    onError: (err) => refetchConsultIfCompletedLock(qc, id, err),
  });
}

/** Load ICD-10 codes when the field is open; empty `q` returns the default list. */
export function useDiagnosisSearch(q: string, open = false) {
  return useQuery({
    queryKey: ["diagnosis-codes", q.trim()],
    enabled: open,
    queryFn: ({ signal }) => searchDiagnosisCodes(q.trim(), signal),
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
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
    onError: (err) => refetchConsultIfCompletedLock(qc, id, err),
  });
}

export function useDeletePrescription(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lineId: string) => deletePrescriptionLine(lineId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prescriptions", id] }),
    onError: (err) => refetchConsultIfCompletedLock(qc, id, err),
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
    onError: (err) => refetchConsultIfCompletedLock(qc, id, err),
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

export function useInvalidatePatientHistory(
  patientId: string | undefined,
  consultationId: string
) {
  const qc = useQueryClient();
  const facilityId = useFacilityId();
  return () =>
    qc.invalidateQueries({
      queryKey: ["patient-history", patientId, facilityId, consultationId],
    });
}

// ---- Site config --------------------------------------------------------

/** Public `ai_enable` flag; defaults to false when missing or on error. */
export function useAiEnable() {
  return useQuery({
    queryKey: ["site-config", "ai_enable"],
    queryFn: () => getSiteConfigEnabled("ai_enable"),
    staleTime: 5 * 60 * 1000,
  });
}

// ---- Conversation -------------------------------------------------------

export function useConversation(consultationId: string) {
  return useQuery({
    queryKey: ["conversation", consultationId],
    enabled: !!consultationId,
    queryFn: () => getConversation(consultationId),
  });
}

export function useDeleteLabReport(
  patientId: string | undefined,
  consultationId: string
) {
  const qc = useQueryClient();
  const facilityId = useFacilityId();
  return useMutation({
    mutationFn: (body: {
      id?: string;
      fileUrl?: string;
      patientId?: string;
      consultationId?: string;
    }) =>
      deletePatientLabReport({
        facilityId: facilityId ?? undefined,
        ...body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["patient-history", patientId, facilityId, consultationId],
      });
      qc.invalidateQueries({ queryKey: ["summary", consultationId] });
    },
    onError: (err) => refetchConsultIfCompletedLock(qc, consultationId, err),
  });
}

export function usePatchReportAttachments(
  consultationId: string,
  patientId?: string
) {
  const qc = useQueryClient();
  const facilityId = useFacilityId();
  return useMutation({
    mutationFn: (attachmentUrls: string[]) =>
      patchReportAttachmentUrls(consultationId, attachmentUrls),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["summary", consultationId] });
      if (patientId && facilityId) {
        qc.invalidateQueries({
          queryKey: ["patient-history", patientId, facilityId, consultationId],
        });
      }
    },
    onError: (err) => refetchConsultIfCompletedLock(qc, consultationId, err),
  });
}

// ---- Patient documents --------------------------------------------------

export function usePatientDocuments(patientId: string | undefined) {
  return useQuery({
    queryKey: ["patient-documents", patientId],
    enabled: !!patientId,
    queryFn: () => listPatientDocuments(patientId!, { page: 1, pageSize: 20 }),
  });
}

export function useUploadPatientDocument(patientId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: {
      uri: string;
      fileName: string;
      mimeType: string;
    }) => {
      if (!patientId) throw new Error("patientId is required");
      return uploadPatientDocument({ ...file, patientId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient-documents", patientId] });
    },
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
