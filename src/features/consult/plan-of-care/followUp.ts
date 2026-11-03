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

/** Print "Next visit": `YYYY-MM-DD` → `dd-mm-yyyy`; legacy interval strings → "In 3 days". */
export function formatFollowUpForPrint(
  value: string | null | undefined
): string {
  if (value == null || value.trim() === "") return "As advised";
  const t = value.trim();
  if (isFollowUpYmd(t)) {
    const [y, m, d] = t.split("-");
    if (y && m && d) return `${d}-${m}-${y}`;
  }
  const booked = t.match(/^follow-up\s+visit\s*:\s*(.+)$/i);
  if (booked?.[1]?.trim()) {
    // The server's line: the date, then " · "-separated detail.
    return booked[1].split(" · ")[0]!.trim();
  }
  const num = parseInt(t, 10);
  if (Number.isNaN(num)) return "As advised";
  const v = t.toLowerCase();
  let unit = "";
  if (v.includes("day")) unit = "day";
  else if (v.includes("week")) unit = "week";
  else if (v.includes("month")) unit = "month";
  else return "As advised";
  return `In ${num} ${num === 1 ? unit : `${unit}s`}`;
}

/** What prints under the date: "Review after 3 days · Clinic will confirm the time". */
export function followUpPrintDetail(value: string | null | undefined): string {
  const booked = String(value ?? "")
    .trim()
    .match(/^follow-up\s+visit\s*:\s*(.+)$/i);
  if (!booked?.[1]) return "";
  return booked[1].split(" · ").slice(1).join(" · ").trim();
}

export function tomorrowYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalYmd(d);
}
