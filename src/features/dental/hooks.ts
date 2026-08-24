/**
 * Legacy React Query helpers — prefer `useDentalDiagnosis` / DentalConsultProvider.
 * Kept for any callers that only need a raw GET.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { refetchConsultIfCompletedLock } from "@/features/consult/consultLock";
import {
  getDental,
  patchDentalPlan,
  putDentalFull,
} from "@/lib/api/endpoints/dental";
import type { DentalTreatmentPlanRow, TeethStates } from "./types";
import {
  deriveTeethStates,
  entriesToPostBody,
  treatmentOrderFromEntries,
} from "./utils";

export function useDental(consultationId: string) {
  return useQuery({
    queryKey: ["dental", consultationId],
    enabled: !!consultationId,
    queryFn: () => getDental(consultationId),
  });
}

export function useSaveDentalExam(consultationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      teethStates: TeethStates;
      treatmentEntries?: unknown[];
      treatmentOrder?: string[];
      treatmentPlanItems?: DentalTreatmentPlanRow[];
    }) =>
      putDentalFull({
        consultationId,
        teethStates: payload.teethStates,
        treatmentOrder: payload.treatmentOrder ?? Object.keys(payload.teethStates),
        treatmentEntries: payload.treatmentEntries ?? [],
        treatmentPlanItems: payload.treatmentPlanItems ?? [],
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["dental", consultationId] }),
    onError: (err) => refetchConsultIfCompletedLock(qc, consultationId, err),
  });
}

export function useSaveDentalPlan(consultationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: DentalTreatmentPlanRow[]) =>
      patchDentalPlan(consultationId, items),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["dental", consultationId] }),
    onError: (err) => refetchConsultIfCompletedLock(qc, consultationId, err),
  });
}

export { deriveTeethStates, entriesToPostBody, treatmentOrderFromEntries };
export { useDentalDiagnosis } from "./useDentalDiagnosis";
