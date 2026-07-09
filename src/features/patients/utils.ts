/** Gender + DOB helpers matching Practice's enum <-> display round-trip. */

export const GENDER_OPTIONS = ["Male", "Female", "Other"] as const;
export type GenderLabel = (typeof GENDER_OPTIONS)[number];

/** Display label ("Male") → API enum ("MALE"). */
export function mapGenderToApi(label?: string | null): string | undefined {
  if (!label) return undefined;
  const u = label.trim().toLowerCase();
  if (u.startsWith("m")) return "MALE";
  if (u.startsWith("f")) return "FEMALE";
  if (!u) return undefined;
  return "OTHER";
}

/** API enum ("MALE") → display label ("Male"). */
export function normalizeGender(value?: string | null): GenderLabel | "" {
  if (!value) return "";
  const u = value.trim().toUpperCase();
  if (u === "MALE" || u === "M") return "Male";
  if (u === "FEMALE" || u === "F") return "Female";
  if (u === "OTHER" || u === "O") return "Other";
  return "";
}

export function fullName(p: { firstName: string; lastName?: string | null }): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
}

export function initials(p: { firstName: string; lastName?: string | null }): string {
  const a = p.firstName?.[0] ?? "";
  const b = p.lastName?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

/** Parse an ISO/date string → "DD MMM YYYY", or "" if invalid. */
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDob(dob?: string | null): string {
  if (!dob) return "";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Whole years between dob and now; null if invalid. */
export function calcAge(dob?: string | null, now: Date = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 200 ? age : null;
}

/** Validate a YYYY-MM-DD string; returns an ISO date or null. */
export function parseDobInput(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (isNaN(d.getTime())) return null;
  if (d.getTime() > Date.now()) return null;
  return d.toISOString();
}

/** ISO → YYYY-MM-DD for a text input. */
export function dobToInput(dob?: string | null): string {
  if (!dob) return "";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
