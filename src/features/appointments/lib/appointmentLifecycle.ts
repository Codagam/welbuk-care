/**
 * Overdue display — derived on read, never stored as NO_SHOW.
 * @see practice/Welbuk_/lib/appointments/appointment-lifecycle.ts
 */

export const OVERDUE_AFTER_MINUTES = 15;

function normalizeStatus(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

export type OverdueState = {
  overdue: boolean;
  lateMinutes: number;
  waitingTooLong: boolean;
};

const SETTLED = new Set([
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "DROPS",
  "IN_PROGRESS",
]);

export function resolveOverdueState(
  entry: {
    status?: string | null;
    startTime?: string | null;
  },
  now: Date = new Date()
): OverdueState {
  const none: OverdueState = {
    overdue: false,
    lateMinutes: 0,
    waitingTooLong: false,
  };

  const status = normalizeStatus(entry.status);
  if (!status || SETTLED.has(status)) return none;

  const start = entry.startTime ? new Date(entry.startTime) : null;
  if (!start || Number.isNaN(start.getTime())) return none;

  const lateMs = now.getTime() - start.getTime();
  if (lateMs < OVERDUE_AFTER_MINUTES * 60 * 1000) return none;

  const lateMinutes = Math.floor(lateMs / 60000);
  return {
    overdue: true,
    lateMinutes,
    waitingTooLong: status === "WAITING",
  };
}

export function formatLateness(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
