import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { refetchConsultIfCompletedLock } from "@/features/consult/consultLock";
import {
  addWellChildScreening,
  getWellChild,
  removeWellChildScreening,
  saveWellChildMeasurement,
  type MeasurementInput,
  type ScreeningInput,
} from "@/lib/api/endpoints/well-child";

export function wellChildKey(consultationId: string) {
  return ["consult-well-child", consultationId] as const;
}

/** Shared by the section and the consult screen (which shows the section once data exists). */
export function useWellChild(consultationId: string | null | undefined) {
  return useQuery({
    queryKey: wellChildKey(consultationId ?? ""),
    enabled: !!consultationId,
    queryFn: () => getWellChild(consultationId!),
  });
}

function useWellChildMutation<V>(
  consultationId: string,
  fn: (vars: V) => Promise<unknown>
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: wellChildKey(consultationId) });
      // Same rows the patient page's Vaccines & wellness card shows.
      void qc.invalidateQueries({ queryKey: ["vaccimon"] });
    },
    onError: (err) => refetchConsultIfCompletedLock(qc, consultationId, err),
  });
}

export function useSaveWellChildMeasurement(consultationId: string) {
  return useWellChildMutation(consultationId, (input: MeasurementInput) =>
    saveWellChildMeasurement(consultationId, input)
  );
}

export function useAddWellChildScreening(consultationId: string) {
  return useWellChildMutation(consultationId, (input: ScreeningInput) =>
    addWellChildScreening(consultationId, input)
  );
}

export function useRemoveWellChildScreening(consultationId: string) {
  return useWellChildMutation(
    consultationId,
    (vars: { screeningId: string; reason: string }) =>
      removeWellChildScreening(consultationId, vars.screeningId, vars.reason)
  );
}
