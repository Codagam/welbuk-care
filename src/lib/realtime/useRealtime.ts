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
  formatIpdPageAlarm,
  formatRealtimeToast,
  isEventRelevantToViewer,
  isIpdPagePayload,
  queriesToInvalidate,
  unwrapRealtimePayload,
} from "./events";
import { playPageChime } from "./pageChime";
import { createRealtime } from "./socket";
import { useRealtimeToastStore } from "./toastStore";

const SEEN_KEYS_MAX = 80;

function envelopeIdempotencyKey(
  raw: Record<string, unknown> | undefined
): string {
  if (!raw || typeof raw !== "object") return "";
  const top = raw.idempotencyKey;
  if (typeof top === "string" && top.trim()) return top.trim();
  const inner = raw.payload;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    const nested = (inner as Record<string, unknown>).idempotencyKey;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }
  return "";
}

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
  const showAlarm = useRealtimeToastStore((s) => s.showAlarm);

  const isDoctorLogin = isDoctorHome(user);
  const userId = user?.id ?? null;
  const userName = userDisplayName(user) || null;

  useEffect(() => {
    if (!facilityId) return;

    const seenKeys: string[] = [];

    const socket = createRealtime(facilityId, (event, raw) => {
      const payload = unwrapRealtimePayload(raw);
      const idempotencyKey = envelopeIdempotencyKey(raw);

      if (idempotencyKey) {
        if (seenKeys.includes(idempotencyKey)) return;
        seenKeys.push(idempotencyKey);
        if (seenKeys.length > SEEN_KEYS_MAX) seenKeys.shift();
      }

      // Tray unread badge stays live for all facility WS traffic (API still
      // scopes rows via doctorScope). Do this before doctor-only toast filtering.
      void qc.invalidateQueries({
        queryKey: notificationsQueryKey(facilityId, isDoctorLogin),
      });

      if (
        event === "PATIENT_CALL_RAISED" &&
        isIpdPagePayload(payload)
      ) {
        const alarm = formatIpdPageAlarm(payload);
        if (alarm) {
          showAlarm(alarm);
          playPageChime();
        }
        return;
      }

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
      if (toast) {
        showToast(idempotencyKey ? { ...toast, id: idempotencyKey } : toast);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [
    facilityId,
    qc,
    showToast,
    showAlarm,
    isDoctorLogin,
    doctorId,
    userId,
    userName,
  ]);
}

