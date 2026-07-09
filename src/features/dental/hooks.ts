import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getDental,
  saveDentalExam,
  saveDentalPlan,
} from "@/lib/api/endpoints/dental";
import type { TeethStates, TreatmentPlanItem } from "./types";

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
    }) => saveDentalExam(consultationId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dental", consultationId] }),
  });
}

export function useSaveDentalPlan(consultationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: TreatmentPlanItem[]) =>
      saveDentalPlan(consultationId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dental", consultationId] }),
  });
}
