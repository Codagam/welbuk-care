import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createPatient,
  getPatient,
  searchPatients,
  unlinkPatient,
  updatePatient,
} from "@/lib/api/endpoints/patients";
import {
  getPatientQuestionnaire,
  savePatientQuestionnaire,
} from "@/lib/api/endpoints/questionnaire";
import { listPatientLabReports } from "@/lib/api/endpoints/lab-reports";
import { listFacilityAppointments } from "@/lib/api/endpoints/appointments";
import { listReferrals } from "@/lib/api/endpoints/referral";
import { useFacilityId } from "@/lib/auth/store";
import type {
  PatientSearchResult,
  PatientWriteInput,
  QuestionnaireStepPayload,
} from "./types";

const PAGE_SIZE = 20;

/** Infinite, DB-paginated patient search scoped to the active facility. */
export function usePatientSearch(search: string) {
  const facilityId = useFacilityId();
  return useInfiniteQuery({
    queryKey: ["patients", facilityId, search.trim()],
    enabled: !!facilityId,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      searchPatients(
        {
          facilityId: facilityId!,
          search: search.trim() || undefined,
          page: pageParam,
          pageSize: PAGE_SIZE,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
        signal
      ),
    getNextPageParam: (last: PatientSearchResult) =>
      last.currentPage < last.totalPages ? last.currentPage + 1 : undefined,
  });
}

/** `id` may be display patientId (Int string) or Mongo ObjectId. */
export function usePatient(id: string | undefined) {
  const facilityId = useFacilityId();
  return useQuery({
    queryKey: ["patient", id, facilityId],
    enabled: !!id && !!facilityId,
    queryFn: () => getPatient(id!, facilityId!),
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PatientWriteInput) => createPatient(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

export function useUpdatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PatientWriteInput) => updatePatient(body),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      if (variables.id) {
        qc.invalidateQueries({ queryKey: ["patient", variables.id] });
      }
    },
  });
}

export function useUnlinkPatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: unlinkPatient,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patient"] });
    },
  });
}

export function usePatientQuestionnaire(patientId: string | undefined) {
  const facilityId = useFacilityId();
  return useQuery({
    queryKey: ["patient-questionnaire", patientId, facilityId],
    enabled: !!patientId && !!facilityId,
    queryFn: () => getPatientQuestionnaire(patientId!, facilityId!),
  });
}

export function useSavePatientQuestionnaire(patientId: string | undefined) {
  const qc = useQueryClient();
  const facilityId = useFacilityId();
  return useMutation({
    mutationFn: (input: {
      stepNumber: 1 | 2 | 3;
      stepData: QuestionnaireStepPayload;
      completed?: boolean;
    }) => {
      if (!patientId) throw new Error("patientId is required");
      if (!facilityId) throw new Error("facilityId is required");
      return savePatientQuestionnaire({
        patientId,
        stepNumber: input.stepNumber,
        stepData: input.stepData,
        completed: input.completed,
        facilityId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["patient-questionnaire", patientId, facilityId],
      });
    },
  });
}

export function usePatientLabReports(mongoPatientId: string | undefined) {
  const facilityId = useFacilityId();
  return useQuery({
    queryKey: ["patient-lab-reports", mongoPatientId, facilityId],
    enabled: !!mongoPatientId,
    queryFn: () =>
      listPatientLabReports({
        patientId: mongoPatientId!,
        facilityId: facilityId ?? undefined,
      }),
  });
}

export function usePatientAppointments(mongoPatientId: string | undefined) {
  const facilityId = useFacilityId();
  return useQuery({
    queryKey: ["patient-appointments", mongoPatientId, facilityId],
    enabled: !!mongoPatientId && !!facilityId,
    queryFn: () =>
      listFacilityAppointments({
        facilityId: facilityId!,
        patientId: mongoPatientId!,
        page: 1,
        pageSize: 100,
      }),
  });
}

export function usePatientReferrals(
  mongoPatientId: string | undefined,
  mode: "incoming" | "outgoing" = "outgoing"
) {
  const facilityId = useFacilityId();
  return useQuery({
    queryKey: ["patient-referrals", mongoPatientId, facilityId, mode],
    enabled: !!mongoPatientId && !!facilityId,
    queryFn: () =>
      listReferrals({
        facilityId: facilityId!,
        patientId: mongoPatientId!,
        mode,
      }),
  });
}
