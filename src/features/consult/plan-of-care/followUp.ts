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

// ── The interval: "come back in N days / weeks / months" ─────────────────
// Ported from Practice lib/consult/follow-up-interval.ts.

export type FollowUpUnit = "DAY" | "WEEK" | "MONTH";

export const FOLLOW_UP_UNITS: readonly FollowUpUnit[] = ["DAY", "WEEK", "MONTH"];

export type FollowUpInterval = { count: number; unit: FollowUpUnit };

/** One rule, not one per unit: `12 MONTH` passes, `60 WEEK` does not. */
export const MAX_FOLLOW_UP_DAYS = 365;

const DAYS_PER_UNIT: Record<FollowUpUnit, number> = {
  DAY: 1,
  WEEK: 7,
  // Approximate, for the cap only. The date itself uses calendar arithmetic.
  MONTH: 31,
};

export const FOLLOW_UP_PRESETS: readonly FollowUpInterval[] = [
  { count: 3, unit: "DAY" },
  { count: 1, unit: "WEEK" },
  { count: 2, unit: "WEEK" },
  { count: 1, unit: "MONTH" },
  { count: 3, unit: "MONTH" },
  { count: 6, unit: "MONTH" },
];

export function parseFollowUpInterval(
  count: unknown,
  unit: unknown
): FollowUpInterval | null {
  if (unit !== "DAY" && unit !== "WEEK" && unit !== "MONTH") return null;
  const n = typeof count === "number" ? count : Number(count);
  if (!Number.isInteger(n) || n < 1) return null;
  if (n * DAYS_PER_UNIT[unit] > MAX_FOLLOW_UP_DAYS) return null;
  return { count: n, unit };
}

/**
 * Calendar arithmetic: one month from 31 Jan is 28 Feb, not 2 Mar, which is what
 * "come back in a month" means to everyone involved.
 */
export function addFollowUpInterval(
  from: Date,
  interval: FollowUpInterval
): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  switch (interval.unit) {
    case "DAY":
      d.setDate(d.getDate() + interval.count);
      break;
    case "WEEK":
      d.setDate(d.getDate() + interval.count * 7);
      break;
    case "MONTH":
      d.setMonth(d.getMonth() + interval.count);
      break;
  }
  return d;
}

export function toFollowUpYmd(d: Date): string {
  return toLocalYmd(d);
}

/** "3 days", "1 week", "6 months". */
export function describeFollowUpInterval(interval: FollowUpInterval): string {
  const noun = interval.unit.toLowerCase();
  return `${interval.count} ${noun}${interval.count === 1 ? "" : "s"}`;
}

/**
 * A date picked by hand, as a whole number of days from today, or null when it is
 * not after today. Sent as the interval, so the printed "Review after N days" and
 * the stored interval never disagree with the booked date.
 */
export function intervalFromYmd(
  ymd: string,
  from: Date = new Date()
): FollowUpInterval | null {
  if (!isFollowUpYmd(ymd)) return null;
  const [y, m, d] = ymd.trim().split("-").map((x) => parseInt(x, 10));
  const target = new Date(y!, m! - 1, d!);
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  // Rounded because a clock change makes one calendar day 23 or 25 hours.
  const days = Math.round((target.getTime() - start.getTime()) / 86400000);
  return parseFollowUpInterval(days, "DAY");
}

/** "05 Nov 2026" for the date read out to the patient. */
export function formatFollowUpDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function tomorrowYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalYmd(d);
}
