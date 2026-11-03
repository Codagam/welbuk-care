import type { OnboardLookupPatient } from "@/lib/api/endpoints/walk-in";

/**
 * Who the mobile number belongs to, from the desk's point of view:
 *  - facility: already a patient here — book directly.
 *  - network:  a Welbuk patient at another facility — OTP required to link.
 *  - new:      not in Welbuk (or a new family member) — OTP optional.
 */
export type WalkInPatientKind = "facility" | "network" | "new";

/** Selected lookup match, or `"new"` to register someone on this number. */
export type WalkInSelection = string | "new" | null;

/** Last 10 digits — mirrors Practice `normalizeIndianMobile10`. */
export function normalizeMobile10(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function isValidIndianMobile(mobile10: string): boolean {
  return /^[6-9]\d{9}$/.test(mobile10);
}

export function lookupPatientName(p: OnboardLookupPatient): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim() ||
    `Patient #${p.patientId}`;
}

export function kindForSelection(
  selection: WalkInSelection,
  matches: OnboardLookupPatient[]
): WalkInPatientKind | null {
  if (selection === "new") return "new";
  if (!selection) return null;
  const match = matches.find((m) => m.id === selection);
  if (!match) return null;
  return match.isLinkedToFacility ? "facility" : "network";
}

/** Overall label for the number, before the desk picks a person. */
export function kindForMatches(
  matches: OnboardLookupPatient[]
): WalkInPatientKind {
  if (matches.some((m) => m.isLinkedToFacility)) return "facility";
  if (matches.length > 0) return "network";
  return "new";
}

/**
 * Pre-select when there is exactly one sensible answer: a single facility
 * patient, a single network patient, or nobody (new). Families sharing a
 * number must be picked explicitly.
 */
export function defaultSelection(
  matches: OnboardLookupPatient[]
): WalkInSelection {
  if (matches.length === 0) return "new";
  const linked = matches.filter((m) => m.isLinkedToFacility);
  if (linked.length === 1) return linked[0]!.id;
  if (linked.length === 0 && matches.length === 1) return matches[0]!.id;
  return null;
}

/** "Ravi Kumar S" → { firstName: "Ravi", lastName: "Kumar S" }. */
export function splitFullName(full: string): {
  firstName: string;
  lastName: string;
} {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

export function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? age : null;
}
