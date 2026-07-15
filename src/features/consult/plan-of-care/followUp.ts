/**
 * Plan-of-care follow-up helpers — ported from Practice
 * lib/consult/plan-follow-up-appointment.ts
 */

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isFollowUpYmd(s: string): boolean {
  return YMD.test(s.trim());
}

export function isFollowUpToday(value: string): boolean {
  const t = value.trim();
  return isFollowUpYmd(t) && t === toLocalYmd(new Date());
}

export function followUpTextForPdf(followUp: string): string {
  const t = followUp.trim();
  if (isFollowUpYmd(t)) {
    const d = new Date(`${t}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return `Follow-up visit: ${d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })}`;
    }
  }
  return t;
}

export function isBookedFollowUpSummaryLine(
  value: string | null | undefined
): boolean {
  if (value == null || String(value).trim() === "") return false;
  const t = String(value).trim();
  if (isFollowUpYmd(t)) return true;
  return /^follow-up\s+visit\s*:/i.test(t);
}

export function tomorrowYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalYmd(d);
}
