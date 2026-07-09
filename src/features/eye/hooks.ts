import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getEye, saveEyeRefraction } from "@/lib/api/endpoints/eye";
import type { EyeRefraction } from "./types";

export function useEye(consultationId: string) {
  return useQuery({
    queryKey: ["eye", consultationId],
    enabled: !!consultationId,
    queryFn: () => getEye(consultationId),
  });
}

export function useSaveEye(consultationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { appointmentId: string; refraction: EyeRefraction }) =>
      saveEyeRefraction(input.appointmentId, input.refraction),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eye", consultationId] }),
  });
}
