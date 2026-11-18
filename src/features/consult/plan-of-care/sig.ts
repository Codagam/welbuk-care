/**
 * The prescription "sig" (dose grid and course length). Ported from Practice
 * lib/prescription/sig.ts and lib/consult/is-syrup-dosage-form.ts; keep the
 * rules identical, because the server applies the same ones at Complete.
 *
 * Grid doses are whole numbers or ¼ ½ ¾, never decimals: a tablet is split, and
 * "0.5" read as "5" is a tenfold overdose. A decimal is allowed only for a
 * liquid in ml ("2.5 ml"), with a leading zero and no trailing zero.
 *
 * Pure, with no imports, so it can be checked against Practice's own functions.
 */

const DOSE_FRACTIONS = { "¼": 0.25, "½": 0.5, "¾": 0.75 } as const;
type DoseFraction = keyof typeof DOSE_FRACTIONS;

const SLOT_RE = /^(\d+)?([¼½¾])?$/;

/** Quick-pick values for one dose slot, in the order the picker shows them. */
export const DOSE_SLOT_PICKS = ["0", "¼", "½", "¾", "1", "1½", "2", "3"] as const;

export const DECIMAL_DOSE_MESSAGE =
  "Write ½ or 1/2, not 0.5 — a decimal point can be misread as a tenfold dose";

function containsDecimalDose(text: string | null | undefined): boolean {
  return /\d?\.\d/.test(String(text ?? ""));
}

/** Value of one stored slot ("0", "2", "½", "1½"), or null when it is not one. */
export function parseDoseSlot(slot: string | null | undefined): number | null {
  const t = String(slot ?? "").trim();
  if (!t) return null;
  const m = t.match(SLOT_RE);
  if (!m) return null;
  const whole = m[1] ? parseInt(m[1], 10) : 0;
  const frac = m[2] ? DOSE_FRACTIONS[m[2] as DoseFraction] : 0;
  return whole + frac;
}

/**
 * Normalise what was typed into one slot: "1/2" → "½", "1 1/2" → "1½", "01" → "1".
 * A decimal is refused with a reason, never converted.
 */
export function normalizeDoseSlotInput(
  raw: string
): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (!t) return { ok: true, value: "" };
  if (containsDecimalDose(t) || t.includes(".")) {
    return { ok: false, error: DECIMAL_DOSE_MESSAGE };
  }
  const typed: Record<string, DoseFraction> = {
    "1/4": "¼",
    "1/2": "½",
    "3/4": "¾",
  };
  const m = t.match(/^(\d+)?\s*(1\/4|1\/2|3\/4|[¼½¾])?$/);
  if (!m || (!m[1] && !m[2])) {
    return { ok: false, error: "Use a whole number, or ¼ ½ ¾ (e.g. 1½)" };
  }
  const whole = m[1] ? String(parseInt(m[1], 10)) : "";
  const frac = m[2] ? (typed[m[2]] ?? (m[2] as DoseFraction)) : "";
  if (frac && whole === "0") return { ok: true, value: frac };
  return { ok: true, value: `${whole}${frac}` };
}

/**
 * Normalise a whole grid: "1/2-0-1 1/2" → "½-0-1½". Anything that is not three
 * clean slots comes back unchanged, so free text ("5 ml twice daily") and
 * refused decimals ("0.5-0-0.5") reach the validator as they were typed.
 *
 * Practice's table enters one slot at a time and never sees this form. Care has
 * one text box, and left alone the server accepts "1/2-0-1/2" as free text, so
 * pharmacy cannot work out a quantity from it.
 */
export function normalizeDosePattern(pattern: string): string {
  const t = pattern.trim();
  const parts = t.split("-");
  if (parts.length !== 3) return t;
  const slots: string[] = [];
  for (const part of parts) {
    const slot = normalizeDoseSlotInput(part);
    if (!slot.ok || !slot.value) return t;
    slots.push(slot.value);
  }
  return slots.join("-");
}

/** "1½-0-1" → [1.5, 0, 1]; null for anything that is not a three-slot grid. */
export function parseDoseGrid(
  pattern: string | null | undefined
): [number, number, number] | null {
  const parts = String(pattern ?? "")
    .trim()
    .split("-");
  if (parts.length !== 3) return null;
  const nums = parts.map(parseDoseSlot);
  if (nums.some((n) => n == null)) return null;
  return nums as [number, number, number];
}

export function isDoseGrid(pattern: string | null | undefined): boolean {
  return parseDoseGrid(pattern) != null;
}

/** A grid with no dose in any period ("0-0-0"): well-formed, prescribes nothing. */
export function isAllZeroDoseGrid(pattern: string | null | undefined): boolean {
  const grid = parseDoseGrid(pattern);
  return !!grid && grid.every((n) => n === 0);
}

/**
 * Neither a grid nor clearly free text: a bare number ("2"), a half-typed grid
 * ("1-0", "1-½"). Guessing which it meant decides how many units pharmacy bills.
 */
export function isAmbiguousDosePattern(
  pattern: string | null | undefined
): boolean {
  const t = String(pattern ?? "").trim();
  if (!t) return false;
  if (parseDoseSlot(t) != null) return true;
  const parts = t.split("-");
  return parts.length === 2 && parts.every((p) => parseDoseSlot(p) != null);
}

/** Why a decimal in a dose is unsafe, or null when it is acceptable. */
export function unsafeDecimalReason(text: string): string | null {
  if (!containsDecimalDose(text)) return null;
  if (/(^|[^\d])\.\d/.test(text)) {
    return "write a leading zero (0.5, not .5) — a bare decimal point is read as a tenfold dose";
  }
  if (/\d\.\d*0(?!\d)/.test(text)) {
    return "drop the trailing zero (5, not 5.0) — it is read as a tenfold dose";
  }
  const decimals = text.match(/\d+\.\d+\s*[a-zA-Z]*/g) ?? [];
  if (decimals.some((d) => !/\d\s*ml\b/i.test(d))) {
    return `decimals are allowed only for liquids in ml (e.g. 2.5 ml). For tablets, ${DECIMAL_DOSE_MESSAGE.charAt(0).toLowerCase()}${DECIMAL_DOSE_MESSAGE.slice(1)}`;
  }
  return null;
}

/** The dose rule the server applies: an error message, or null when acceptable. */
export function checkDosePattern(
  name: string,
  pattern: string | null | undefined
): string | null {
  const t = String(pattern ?? "").trim();
  if (!t) return "Dose pattern is required";
  const decimalError = unsafeDecimalReason(t);
  if (decimalError) {
    return `Dose "${t}" for ${name}: ${decimalError}`;
  }
  if (isDoseGrid(t)) {
    return isAllZeroDoseGrid(t)
      ? `Dose pattern "${t}" for ${name} has no dose. At least one dose must be more than 0 (e.g., 1-0-0).`
      : null;
  }
  if (isAmbiguousDosePattern(t)) {
    return `Dose pattern "${t}" for ${name} must be in format (e.g., 1-0-1 or ½-0-½) for tablets, or text like 'As Needed' for syrups and creams`;
  }
  return null;
}

// ── Course length ─────────────────────────────────────────────────────────

export type DurationUnit = "DAYS" | "WEEKS" | "MONTHS";

/** For arithmetic only. A month is a flat 30, as on the server. */
const DAYS_PER_UNIT: Record<DurationUnit, number> = {
  DAYS: 1,
  WEEKS: 7,
  MONTHS: 30,
};

export const DURATION_UNITS: readonly DurationUnit[] = [
  "DAYS",
  "WEEKS",
  "MONTHS",
];

export function normalizeDurationUnit(raw: unknown): DurationUnit | null {
  const t = String(raw ?? "")
    .trim()
    .toUpperCase();
  return t === "DAYS" || t === "WEEKS" || t === "MONTHS" ? t : null;
}

export type CourseFields = {
  /** Legacy column: a number of DAYS. Read only when value + unit are absent. */
  duration?: string | number | null;
  durationValue?: number | null;
  durationUnit?: string | null;
};

/** Length of the course in days, or null when none was given. */
export function courseDays(fields: CourseFields): number | null {
  const unit = normalizeDurationUnit(fields.durationUnit);
  const value = fields.durationValue;
  if (unit && typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value * DAYS_PER_UNIT[unit];
  }
  const s = String(fields.duration ?? "").trim();
  const m = s.match(/^(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (/month/i.test(s)) return n * DAYS_PER_UNIT.MONTHS;
  if (/week/i.test(s)) return n * DAYS_PER_UNIT.WEEKS;
  return n;
}

/** "3 months" / "1 week" / legacy "5 days". Empty string when unknown. */
export function formatDuration(fields: CourseFields): string {
  const unit = normalizeDurationUnit(fields.durationUnit);
  const value = fields.durationValue;
  if (unit && typeof value === "number" && value > 0) {
    const word = unit === "DAYS" ? "day" : unit === "WEEKS" ? "week" : "month";
    return `${value} ${word}${value === 1 ? "" : "s"}`;
  }
  const days = courseDays(fields);
  return days == null ? "" : `${days} day${days === 1 ? "" : "s"}`;
}

// ── Dosage forms ──────────────────────────────────────────────────────────

export function isSyrupDosageForm(
  dosageForm: string | null | undefined
): boolean {
  if (!dosageForm) return false;
  const lowerForm = dosageForm.toLowerCase();
  return (
    lowerForm === "syrup" || lowerForm === "suspension" || lowerForm === "drops"
  );
}

/**
 * Applied to the skin, sold by the tube. A "1-1-1" sig on these is not a piece
 * count: pharmacy derives quantity as per-day × days, so 1-1-1 for 3 days bills
 * NINE tubes.
 */
const TOPICAL_DOSAGE_FORMS = new Set(["cream", "ointment", "gel", "lotion"]);

export function isTopicalDosageForm(
  dosageForm: string | null | undefined
): boolean {
  if (!dosageForm) return false;
  return TOPICAL_DOSAGE_FORMS.has(dosageForm.trim().toLowerCase());
}

/** Forms whose dose is free text ("As Needed", "5ml") rather than the 1-0-1 grid. */
export function usesFreeTextDosePattern(
  dosageForm: string | null | undefined
): boolean {
  return isSyrupDosageForm(dosageForm) || isTopicalDosageForm(dosageForm);
}
