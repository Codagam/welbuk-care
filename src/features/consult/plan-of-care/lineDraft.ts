/**
 * The rules of one prescription row. Ported from Practice
 * components/consult/prescription/regimen/line-draft.ts; keep them identical so a
 * row behaves the same on the tablet and on the web.
 */
import {
  checkDosePattern,
  courseDays,
  formatDuration,
  isDoseGrid,
  normalizeDurationUnit,
  usesFreeTextDosePattern,
  type DurationUnit,
} from "./sig";
import type { PlanPrescription } from "./types";

export type LineDraft = {
  dosePattern: string;
  foodTiming: "AF" | "BF";
  durationValue: number | null;
  durationUnit: DurationUnit | null;
  doseNote: string;
};

/** A regimen as the API returns it (Practice lib/prescription/regimen.ts). */
export type RegimenView = {
  id: string;
  drugId: string;
  drugName: string;
  dosePattern: string;
  doseNote: string | null;
  foodTiming: "AF" | "BF";
  durationValue: number;
  durationUnit: DurationUnit;
  durationLabel: string;
  currentVersion: number;
  lastUsedAt: string | null;
  useCount: number;
  updatedAt: string;
};

export type LastUsed = {
  dosePattern: string | null;
  foodTiming: string | null;
  durationValue: number | null;
  durationUnit: string | null;
  duration: string | null;
  prescribedAt: string;
};

export const FOOD_LABEL: Record<string, string> = {
  AF: "After food",
  BF: "Before food",
};

export const EMPTY_DRAFT: LineDraft = {
  dosePattern: "",
  foodTiming: "AF",
  durationValue: null,
  durationUnit: null,
  doseNote: "",
};

/** True when the dose is free text (liquid, cream, "As Needed") rather than a grid. */
export function isTextDose(
  pattern: string,
  dosageForm?: string | null
): boolean {
  if (pattern.trim()) return !isDoseGrid(pattern);
  return usesFreeTextDosePattern(dosageForm);
}

/** "1½-0-1 · After food · 3 months" */
export function describeSig(d: {
  dosePattern: string;
  foodTiming: string;
  durationValue?: number | null;
  durationUnit?: string | null;
  duration?: string | null;
}): string {
  const course = formatDuration({
    durationValue: d.durationValue ?? null,
    durationUnit: d.durationUnit ?? null,
    duration: d.duration ?? null,
  });
  return [d.dosePattern, FOOD_LABEL[d.foodTiming] ?? d.foodTiming, course]
    .filter(Boolean)
    .join(" · ");
}

export function draftFromRegimen(r: RegimenView): LineDraft {
  return {
    dosePattern: r.dosePattern,
    foodTiming: r.foodTiming,
    durationValue: r.durationValue,
    durationUnit: r.durationUnit,
    doseNote: r.doseNote ?? "",
  };
}

/** A line's sig as a draft. Older lines carry only legacy days. */
export function draftFromLine(p: PlanPrescription): LineDraft {
  const unit = normalizeDurationUnit(p.durationUnit);
  const legacyDays = courseDays({ duration: p.duration });
  return {
    dosePattern: p.dosePattern,
    foodTiming: p.foodTiming === "BF" ? "BF" : "AF",
    durationValue: unit && p.durationValue ? p.durationValue : legacyDays,
    durationUnit: unit && p.durationValue ? unit : legacyDays ? "DAYS" : null,
    doseNote: p.doseNote ?? "",
  };
}

/** Write a draft onto a line, keeping `duration` (days) in step with value + unit. */
export function applyDraft(
  p: PlanPrescription,
  d: LineDraft
): PlanPrescription {
  const days =
    d.durationValue && d.durationUnit
      ? courseDays({
          durationValue: d.durationValue,
          durationUnit: d.durationUnit,
        })
      : null;
  return {
    ...p,
    dosePattern: d.dosePattern.trim(),
    foodTiming: d.foodTiming,
    durationValue: d.durationValue,
    durationUnit: d.durationUnit,
    duration: days != null ? String(days) : p.duration,
    doseNote: d.doseNote.trim() || null,
  };
}

/** Does this line still say what the regimen says? */
export function lineMatchesRegimen(
  p: PlanPrescription,
  r: RegimenView
): boolean {
  const d = draftFromLine(p);
  return (
    d.dosePattern === r.dosePattern &&
    d.foodTiming === r.foodTiming &&
    d.durationValue === r.durationValue &&
    d.durationUnit === r.durationUnit &&
    // Trimmed because the server trims what it saves: otherwise "x " would read as
    // changed straight after being saved as "x", and "Update regimen" would come back.
    (d.doseNote.trim() || null) === (r.doseNote || null)
  );
}

/**
 * Key for "is this already on the prescription?". Lines from a template or an old
 * draft carry a NAME and no catalogue id, so an id check alone lets one in twice.
 */
export function medicineNameKey(name: string | null | undefined): string {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * What the row's regimen checkbox offers:
 * - "none": no checkbox (not the consult's doctor, or not a catalogue medicine)
 * - "matches": the row says exactly what the regimen says
 * - "update": a regimen exists and the row differs (off by default)
 * - "new": no regimen yet (on by default)
 */
export type RegimenStatus = "none" | "matches" | "update" | "new";

export function regimenStatus(
  p: PlanPrescription,
  regimen: RegimenView | undefined,
  canSave: boolean
): RegimenStatus {
  if (!canSave || !p.drugId) return "none";
  if (!regimen) return "new";
  return lineMatchesRegimen(p, regimen) ? "matches" : "update";
}

export type RowErrors = { dose?: string; duration?: string; qty?: string };

/** What stops a row from being a complete prescription line. Empty = fine. */
export function rowErrors(p: PlanPrescription): RowErrors {
  const out: RowErrors = {};
  const doseError = checkDosePattern(p.name, p.dosePattern);
  if (doseError) {
    out.dose = doseError.replace(/^Dose( pattern)? "[^"]*" for [^:]+:\s*/, "");
  }
  if (
    !courseDays({
      duration: p.duration,
      durationValue: p.durationValue,
      durationUnit: p.durationUnit,
    })
  ) {
    out.duration = "Set a duration";
  }
  if (
    isTextDose(p.dosePattern, p.dosageForm) &&
    !(p.qtyPrescribed && p.qtyPrescribed > 0)
  ) {
    out.qty = "Enter quantity";
  }
  return out;
}

/** A past prescription's sig, or null when there is nothing usable to offer. */
export function draftFromLastUsed(l: LastUsed | undefined): LineDraft | null {
  if (!l) return null;
  // Only offer a dose that passes today's rules; an old decimal is dropped.
  const dose = l.dosePattern?.trim() ?? "";
  if (!dose || /\d\.\d/.test(dose)) return null;
  const unit = normalizeDurationUnit(l.durationUnit);
  const days = courseDays({ duration: l.duration });
  return {
    dosePattern: dose,
    foodTiming: l.foodTiming === "BF" ? "BF" : "AF",
    durationValue: unit && l.durationValue ? l.durationValue : days,
    durationUnit: unit && l.durationValue ? unit : days ? "DAYS" : null,
    // A note is about one patient, so it never carries over from another.
    doseNote: "",
  };
}

/** Brand plus strength, unless the brand already says it (Practice drug-display-name). */
export function drugDisplayName(
  brandName: string,
  strength?: string | null
): string {
  const base = (brandName ?? "").trim();
  const s = strength?.trim();
  if (!s || base.toLowerCase().includes(s.toLowerCase())) return base;
  return `${base} ${s}`;
}

/** Practice isDrugCatalogExpiryPrescribable: usable through its expiry day (UTC). */
export function isExpiryPrescribable(
  expiry: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (expiry == null) return true;
  const d = new Date(expiry);
  if (Number.isNaN(d.getTime())) return true;
  return d.toISOString().slice(0, 10) >= now.toISOString().slice(0, 10);
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
