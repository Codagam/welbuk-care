import type { QueryClient } from "@tanstack/react-query";

import { isConsultCompletedLock } from "@/lib/api/errors";

export const MIN_REOPEN_WORDS = 3;

export const CONSULT_LOCKED_MESSAGE =
  "This consultation is completed and locked. Reopen it to make changes.";

export const CONSULT_LOCKED_COMPLETE_REASON =
  "This consultation is completed. Reopen it to make changes.";

export function isConsultLocked(status?: string | null): boolean {
  return status === "COMPLETED";
}

export function countReasonWords(reason: string): number {
  return reason.trim().split(/\s+/).filter(Boolean).length;
}

export function formatConsultCompletedAt(
  value?: string | Date | null
): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CONSULT_WRITE_KEYS = [
  "consultation",
  "summary",
  "vitals",
  "prescriptions",
  "dental",
  "eye",
] as const;

/** After a successful reopen, refresh lock state and clinical editors. */
export function invalidateConsultWriteQueries(
  qc: QueryClient,
  consultationId: string
): Promise<void> {
  return Promise.all(
    CONSULT_WRITE_KEYS.map((key) =>
      qc.invalidateQueries({ queryKey: [key, consultationId] })
    )
  ).then(() => undefined);
}

/**
 * Stale-tab path: a 409 CONSULT_COMPLETED means another device completed this
 * chart. Refetch the consult so the lock banner appears instead of a crash.
 */
export function refetchConsultIfCompletedLock(
  qc: QueryClient,
  consultationId: string | undefined,
  err: unknown
): boolean {
  if (!consultationId || !isConsultCompletedLock(err)) return false;
  void qc.invalidateQueries({ queryKey: ["consultation", consultationId] });
  return true;
}
