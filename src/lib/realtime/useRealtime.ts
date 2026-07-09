import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useFacilityId } from "@/lib/auth/store";
import { createRealtime } from "./socket";

/**
 * Live query invalidation. Subscribes to the facility's realtime stream and
 * refetches the affected TanStack queries so the queue and care inbox update
 * without a manual pull-to-refresh. Mounted once in the authenticated shell.
 */
export function useRealtime() {
  const facilityId = useFacilityId();
  const qc = useQueryClient();

  useEffect(() => {
    if (!facilityId) return;
    const socket = createRealtime(facilityId, (event) => {
      if (event.startsWith("PATIENT_CALL")) {
        qc.invalidateQueries({ queryKey: ["calls"] });
      } else if (event === "PATIENT_ASSIGNED") {
        qc.invalidateQueries({ queryKey: ["assignments"] });
      } else if (
        event.startsWith("APPOINTMENT") ||
        event.startsWith("CHECK_IN") ||
        event.startsWith("PATIENT_WALKED") ||
        event.startsWith("PATIENT_ONBOARD") ||
        event.startsWith("PATIENT_QR")
      ) {
        qc.invalidateQueries({ queryKey: ["queue"] });
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [facilityId, qc]);
}
