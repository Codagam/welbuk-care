import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { reopenConsultation } from "@/lib/api/endpoints/consult";

import {
  countReasonWords,
  invalidateConsultWriteQueries,
  MIN_REOPEN_WORDS,
} from "./consultLock";

/**
 * POST /api/consult/:id/reopen — single-flight so a double tap does not
 * increment reopenCount twice.
 */
export function useReopenConsult(consultationId: string) {
  const qc = useQueryClient();
  const inFlight = useRef(false);

  return useMutation({
    mutationFn: async (reason: string) => {
      const trimmed = reason.trim();
      if (countReasonWords(trimmed) < MIN_REOPEN_WORDS) {
        throw new Error(
          "Say why this consultation is being reopened — at least a few words."
        );
      }
      if (inFlight.current) {
        throw new Error("Reopen already in progress.");
      }
      inFlight.current = true;
      try {
        return await reopenConsultation(consultationId, trimmed);
      } finally {
        inFlight.current = false;
      }
    },
    onSuccess: () => invalidateConsultWriteQueries(qc, consultationId),
  });
}
