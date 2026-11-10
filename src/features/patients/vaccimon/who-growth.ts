// Copied verbatim from Practice lib/pedlib/who-growth.ts — keep in step; Care never changes Practice.
/**
 * WHO Child Growth Standards, birth to 5 years: where a child's measurement sits
 * against children of the same sex and age.
 *
 * Pure functions over the generated LMS tables (who-growth-tables.ts). The maths
 * is WHO's own (anthro package / 2006 technical report):
 *
 *   z = ((y / M)^L − 1) / (L · S)        (L ≠ 0)
 *   z = ln(y / M) / S                    (L = 0)
 *
 * with WHO's "restricted" tail for weight-for-age beyond ±3 SD, where the LMS
 * curve would otherwise stretch the tail and understate how far out a child is.
 * Length and head circumference have L = 1, so they are plain normal z-scores.
 *
 * Out of scope on purpose: anything past 60 months (the 2007 school-age reference
 * is a different dataset with no head circumference), and weight-for-length.
 */
import {
  WHO_HEAD_FOR_AGE,
  WHO_LENGTH_FOR_AGE,
  WHO_WEIGHT_FOR_AGE,
  type LmsRow,
  type SexTables,
} from "./who-growth-tables";

export type GrowthIndicator = "weight" | "length" | "head";
export type GrowthSex = "male" | "female";

export const DAYS_PER_MONTH = 30.4375;
export const WHO_MAX_AGE_DAYS = 1856; // 60 months
export const WHO_MAX_AGE_MONTHS = 60;

/** The day WHO switches from recumbent length to standing height. */
const HEIGHT_FROM_DAY = 731;
/** Standing height reads ~0.7 cm shorter than lying length (WHO). */
const LENGTH_HEIGHT_OFFSET_CM = 0.7;

const TABLES: Record<GrowthIndicator, SexTables> = {
  weight: WHO_WEIGHT_FOR_AGE,
  length: WHO_LENGTH_FOR_AGE,
  head: WHO_HEAD_FOR_AGE,
};

/** WHO's printed centile set, with the z each sits at. */
export const WHO_CENTILES = [
  { key: "p3", centile: 3, z: -1.8807936 },
  { key: "p15", centile: 15, z: -1.0364334 },
  { key: "p50", centile: 50, z: 0 },
  { key: "p85", centile: 85, z: 1.0364334 },
  { key: "p97", centile: 97, z: 1.8807936 },
] as const;

/** Patient.gender → the sex the WHO tables are split by; null when it cannot be told. */
export function growthSexFromGender(gender: string | null | undefined): GrowthSex | null {
  const g = (gender ?? "").trim().toUpperCase();
  if (g === "MALE" || g === "M") return "male";
  if (g === "FEMALE" || g === "F") return "female";
  return null;
}

export function ageInDays(dob: string | Date, on: string | Date): number {
  const ms = new Date(on).getTime() - new Date(dob).getTime();
  return Math.floor(ms / 86_400_000);
}

/** L, M, S at an age, linearly interpolated between table rows. Null outside 0–60 months. */
export function lmsAt(indicator: GrowthIndicator, sex: GrowthSex, days: number): LmsRow | null {
  if (!Number.isFinite(days) || days < 0 || days > WHO_MAX_AGE_DAYS) return null;
  const rows = TABLES[indicator][sex];
  // Length switches to height on day 731; never interpolate across that step.
  const hi = rows.findIndex((r) => r[0] >= days);
  if (hi === -1) return null;
  if (rows[hi][0] === days || hi === 0) return rows[hi];
  const lo = rows[hi - 1];
  const up = rows[hi];
  if (indicator === "length" && lo[0] < HEIGHT_FROM_DAY && up[0] >= HEIGHT_FROM_DAY) {
    return days < HEIGHT_FROM_DAY ? lo : up;
  }
  const t = (days - lo[0]) / (up[0] - lo[0]);
  const mix = (a: number, b: number) => a + (b - a) * t;
  return [days, mix(lo[1], up[1]), mix(lo[2], up[2]), mix(lo[3], up[3])];
}

/** The measurement at a given z for these parameters. */
export function valueAtZ([, L, M, S]: LmsRow, z: number): number {
  return L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
}

function rawZ(y: number, [, L, M, S]: LmsRow): number {
  return L === 0 ? Math.log(y / M) / S : (Math.pow(y / M, L) - 1) / (L * S);
}

export function zScoreFor(indicator: GrowthIndicator, y: number, lms: LmsRow): number {
  const z = rawZ(y, lms);
  if (indicator !== "weight" || Math.abs(z) <= 3) return z;
  // WHO restricted tail: beyond ±3 SD, measure in units of the 2–3 SD gap.
  if (z > 3) {
    const sd3 = valueAtZ(lms, 3);
    return 3 + (y - sd3) / (sd3 - valueAtZ(lms, 2));
  }
  const sd3 = valueAtZ(lms, -3);
  return -3 + (y - sd3) / (valueAtZ(lms, -2) - sd3);
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26; error < 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/**
 * The value the WHO table expects for a length/height measurement: WHO tables are
 * lying length before 24 months and standing height after, so a measurement
 * taken the other way is shifted by 0.7 cm. Unknown position is taken as-is.
 */
export function comparableLength(cm: number, days: number, position: string | null | undefined): number {
  if (position === "standing" && days < HEIGHT_FROM_DAY) return cm + LENGTH_HEIGHT_OFFSET_CM;
  if (position === "recumbent" && days >= HEIGHT_FROM_DAY) return cm - LENGTH_HEIGHT_OFFSET_CM;
  return cm;
}

export type GrowthFlag = "ok" | "watch" | "alert";

export type GrowthAssessment = {
  z: number;
  centile: number;
  flag: GrowthFlag;
  /** Short, plain wording for the badge. */
  label: string;
};

/** WHO cut-offs, worded for a clinician, not a parent. */
function classify(indicator: GrowthIndicator, z: number): { flag: GrowthFlag; label: string } {
  if (indicator === "weight") {
    if (z < -3) return { flag: "alert", label: "Severely underweight" };
    if (z < -2) return { flag: "watch", label: "Underweight" };
    if (z > 2) return { flag: "watch", label: "Above +2 SD" };
  } else if (indicator === "length") {
    if (z < -3) return { flag: "alert", label: "Severely stunted" };
    if (z < -2) return { flag: "watch", label: "Stunted" };
    if (z > 3) return { flag: "watch", label: "Above +3 SD" };
  } else {
    if (z < -3) return { flag: "alert", label: "Below −3 SD" };
    if (z < -2) return { flag: "watch", label: "Small head (< −2 SD)" };
    if (z > 3) return { flag: "alert", label: "Above +3 SD" };
    if (z > 2) return { flag: "watch", label: "Large head (> +2 SD)" };
  }
  return { flag: "ok", label: "Within normal range" };
}

/**
 * Where one measurement sits. Null when the age is outside 0–60 months or the
 * value is not a positive number.
 */
export function assessGrowth(input: {
  indicator: GrowthIndicator;
  sex: GrowthSex;
  days: number;
  value: number;
  lengthPosition?: string | null;
}): GrowthAssessment | null {
  const { indicator, sex, days } = input;
  if (!(input.value > 0)) return null;
  const lms = lmsAt(indicator, sex, days);
  if (!lms) return null;
  const y = indicator === "length" ? comparableLength(input.value, days, input.lengthPosition) : input.value;
  const z = zScoreFor(indicator, y, lms);
  if (!Number.isFinite(z)) return null;
  return { z, centile: normalCdf(z) * 100, ...classify(indicator, z) };
}

/** "42nd", "3rd", "<0.1st", ">99.9th". */
export function formatCentile(centile: number): string {
  if (centile < 0.1) return "<0.1st";
  if (centile > 99.9) return ">99.9th";
  const n = centile < 1 || centile > 99 ? Math.round(centile * 10) / 10 : Math.round(centile);
  const whole = Math.floor(n);
  if (n !== whole) return `${n}th`;
  const mod100 = whole % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13 ? "th" : whole % 10 === 1 ? "st" : whole % 10 === 2 ? "nd" : whole % 10 === 3 ? "rd" : "th";
  return `${whole}${suffix}`;
}

export function formatZ(z: number): string {
  const r = Math.round(z * 10) / 10;
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(1)} SD`;
}

export type ReferencePoint = {
  /** Age in months. */
  x: number;
  p3: number;
  p15: number;
  p50: number;
  p85: number;
  p97: number;
};

/** The centile curves from birth to `maxMonths`, one point per table row. */
export function referenceCurves(indicator: GrowthIndicator, sex: GrowthSex, maxMonths: number): ReferencePoint[] {
  const maxDays = Math.min(WHO_MAX_AGE_DAYS, Math.round(maxMonths * DAYS_PER_MONTH));
  return TABLES[indicator][sex]
    .filter((r) => r[0] <= maxDays)
    .map((r) => {
      const point = { x: Math.round((r[0] / DAYS_PER_MONTH) * 1000) / 1000 } as ReferencePoint;
      for (const c of WHO_CENTILES) point[c.key] = Math.round(valueAtZ(r, c.z) * 100) / 100;
      return point;
    });
}
