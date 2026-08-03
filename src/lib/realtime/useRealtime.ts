import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { notificationsQueryKey } from "@/features/notifications/hooks";
import { isDoctorHome, userDisplayName } from "@/lib/auth/roles";
import {
  useAuthUser,
  useDoctorId,
  useFacilityId,
} from "@/lib/auth/store";
import {
  formatRealtimeToast,
  isEventRelevantToViewer,
  queriesToInvalidate,
  unwrapRealtimePayload,
} from "./events";
import { createRealtime } from "./socket";
import { useRealtimeToastStore } from "./toastStore";

/**
 * Live facility WebSocket: toast + TanStack invalidation.
 * Doctor logins only surface/react to their own clinical + targeted care events.
 * Mounted once in the authenticated shell — no push required while app is open.
 */
export function useRealtime() {
  const facilityId = useFacilityId();
  const user = useAuthUser();
  const doctorId = useDoctorId();
  const qc = useQueryClient();
  const showToast = useRealtimeToastStore((s) => s.show);

  const isDoctorLogin = isDoctorHome(user);
  const userId = user?.id ?? null;
  const userName = userDisplayName(user) || null;

  useEffect(() => {
    if (!facilityId) return;

    const socket = createRealtime(facilityId, (event, raw) => {
      const payload = unwrapRealtimePayload(raw);

      // Tray unread badge stays live for all facility WS traffic (API still
      // scopes rows via doctorScope). Do this before doctor-only toast filtering.
      void qc.invalidateQueries({
        queryKey: notificationsQueryKey(facilityId, isDoctorLogin),
      });

      if (
        !isEventRelevantToViewer({
          event,
          payload,
          isDoctorLogin,
          doctorId,
          userId,
          userName,
        })
      ) {
        return;
      }

      for (const key of queriesToInvalidate(event)) {
        void qc.invalidateQueries({ queryKey: key });
      }

      // Vitals also refresh open consult vitals when consultationId present
      const consultationId =
        typeof payload.consultationId === "string"
          ? payload.consultationId.trim()
          : "";
      if (event === "APPOINTMENT_VITALS_RECORDED" && consultationId) {
        void qc.invalidateQueries({ queryKey: ["vitals", consultationId] });
      }
      if (event === "PRESCRIPTION_ISSUED" && consultationId) {
        void qc.invalidateQueries({
          queryKey: ["prescriptions", consultationId],
        });
        void qc.invalidateQueries({ queryKey: ["summary", consultationId] });
      }

      const toast = formatRealtimeToast(event, payload);
      if (toast) showToast(toast);
    });

    return () => {
      socket.disconnect();
    };
  }, [
    facilityId,
    qc,
    showToast,
    isDoctorLogin,
    doctorId,
    userId,
    userName,
  ]);
}

