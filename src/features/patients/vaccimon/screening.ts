// Copied verbatim from Practice lib/pedlib/screening.ts — keep in step; Care never changes Practice.
/**
 * Screening catalogue — hearing, vision, development. Model: `ScreeningResult`.
 * Design: docs/MOTHER_AND_CHILD_PLAN.md §1–§2.
 *
 * Results describe what was observed and never diagnose (PEDIATRICS_PLAN §9.3):
 * "Refer" means "send for a full test", not "deaf". Each test lists the ages it
 * is usually done at so the well-child section can offer the relevant ones first;
 * every test stays available at any age, because a clinician decides, not a
 * table.
 */

export type ScreeningResultType = "pass_refer" | "normal_abnormal" | "achieved" | "acuity";

export type ScreeningTest = {
  key: string;
  label: string;
  group: "Hearing" | "Vision" | "Development";
  resultType: ScreeningResultType;
  /** Done per ear / per eye. */
  perSide: boolean;
  /** Ages (in days) the test is usually offered at — a hint, never a gate. */
  usualAgeDays: [number, number];
  /** Shown under the test in the form. */
  hint?: string;
};

export const SCREENING_TESTS: readonly ScreeningTest[] = [
  { key: "NEWBORN_HEARING_OAE", label: "Newborn hearing (OAE)", group: "Hearing", resultType: "pass_refer", perSide: true, usualAgeDays: [0, 90], hint: "Otoacoustic emissions, before discharge or by 1 month." },
  { key: "HEARING_BERA", label: "Hearing (BERA / ABR)", group: "Hearing", resultType: "pass_refer", perSide: true, usualAgeDays: [0, 365 * 18], hint: "After an OAE refer, or for at-risk babies." },
  { key: "HEARING_SCREEN", label: "Hearing screen", group: "Hearing", resultType: "pass_refer", perSide: true, usualAgeDays: [365 * 3, 365 * 120], hint: "Pure-tone or play audiometry." },
  { key: "OTOSCOPY", label: "Ear examination", group: "Hearing", resultType: "normal_abnormal", perSide: true, usualAgeDays: [0, 365 * 120] },
  { key: "RED_REFLEX", label: "Red reflex", group: "Vision", resultType: "normal_abnormal", perSide: true, usualAgeDays: [0, 365 * 2], hint: "At birth, 6 weeks and every visit in infancy." },
  { key: "EYE_ALIGNMENT", label: "Eye alignment (squint)", group: "Vision", resultType: "normal_abnormal", perSide: false, usualAgeDays: [90, 365 * 18] },
  { key: "VISUAL_ACUITY", label: "Visual acuity", group: "Vision", resultType: "acuity", perSide: true, usualAgeDays: [365 * 3, 365 * 120], hint: "Snellen or picture chart, e.g. 6/6." },
  { key: "DEVELOPMENT", label: "Development milestones", group: "Development", resultType: "achieved", perSide: false, usualAgeDays: [0, 365 * 6], hint: "Motor, language, social for the child's age." },
] as const;

const TEST_BY_KEY = new Map(SCREENING_TESTS.map((t) => [t.key, t]));
export function screeningTest(key: string): ScreeningTest | undefined {
  return TEST_BY_KEY.get(key);
}

/** The allowed results for a result type, in the order the form shows them. */
export const RESULT_OPTIONS: Record<ScreeningResultType, readonly string[]> = {
  pass_refer: ["Pass", "Refer"],
  normal_abnormal: ["Normal", "Abnormal"],
  achieved: ["Achieved", "Partly achieved", "Not achieved"],
  acuity: ["Normal", "Reduced"],
};

export const SIDES = ["LEFT", "RIGHT", "BOTH"] as const;
export type Side = (typeof SIDES)[number];

/** Results a screen should draw attention to — still a description, never an action. */
export function isAttentionResult(result: string): boolean {
  return ["Refer", "Abnormal", "Not achieved", "Reduced", "Partly achieved"].includes(result);
}

/** Tests usually done at this age first, the rest after, catalogue order within each. */
export function testsForAge(ageDays: number | null): { usual: ScreeningTest[]; other: ScreeningTest[] } {
  if (ageDays === null) return { usual: [...SCREENING_TESTS], other: [] };
  const usual = SCREENING_TESTS.filter((t) => ageDays >= t.usualAgeDays[0] && ageDays <= t.usualAgeDays[1]);
  const other = SCREENING_TESTS.filter((t) => !usual.includes(t));
  return { usual, other };
}

export type ScreeningInput = {
  testKey?: unknown;
  side?: unknown;
  result?: unknown;
  value?: unknown;
  notes?: unknown;
  testedOn?: unknown;
};

export function normalizeScreening(
  input: ScreeningInput,
  now: Date = new Date(),
):
  | { ok: true; value: { testKey: string; side: Side | null; result: string; value: string | null; notes: string | null; testedOn: Date } }
  | { ok: false; error: string } {
  const test = screeningTest(String(input.testKey ?? ""));
  if (!test) return { ok: false, error: "Unknown screening test." };
  const result = String(input.result ?? "").trim();
  if (!RESULT_OPTIONS[test.resultType].includes(result)) {
    return { ok: false, error: `Choose a result: ${RESULT_OPTIONS[test.resultType].join(" / ")}.` };
  }
  let side: Side | null = null;
  if (test.perSide) {
    const s = String(input.side ?? "").trim().toUpperCase();
    if (!(SIDES as readonly string[]).includes(s)) return { ok: false, error: "Choose left, right or both." };
    side = s as Side;
  }
  const value = typeof input.value === "string" && input.value.trim() ? input.value.trim().slice(0, 20) : null;
  if (test.resultType === "acuity" && !value) return { ok: false, error: "Enter the acuity, e.g. 6/6." };
  const notes = typeof input.notes === "string" && input.notes.trim() ? input.notes.trim().slice(0, 300) : null;

  let testedOn = now;
  if (typeof input.testedOn === "string" && input.testedOn.trim()) {
    const d = new Date(input.testedOn);
    if (Number.isNaN(d.getTime())) return { ok: false, error: "Invalid date." };
    if (d.getTime() > now.getTime() + 60_000) return { ok: false, error: "The date cannot be in the future." };
    testedOn = d;
  }
  return { ok: true, value: { testKey: test.key, side, result, value, notes, testedOn } };
}

const SIDE_LABEL: Record<string, string> = { LEFT: "left", RIGHT: "right", BOTH: "both" };

/** "Pass (both)", "6/9 right · Reduced" — one result as a line of text. */
export function describeScreening(r: { result: string; side: string | null; value: string | null }): string {
  const side = r.side ? SIDE_LABEL[r.side] ?? r.side.toLowerCase() : null;
  if (r.value) return `${r.value}${side ? ` ${side}` : ""} · ${r.result}`;
  return side ? `${r.result} (${side})` : r.result;
}

/**
 * The latest result per test in a group, as one line for a certificate:
 * "Newborn hearing (OAE): Pass (both), 06 Nov 2026". Newest first in → newest kept.
 */
export function summarizeGroup(
  rows: Array<{ testKey: string; result: string; side: string | null; value: string | null; testedOn: Date | string }>,
  group: ScreeningTest["group"],
  formatDate: (d: Date) => string,
): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const r of rows) {
    const test = screeningTest(r.testKey);
    if (!test || test.group !== group) continue;
    const key = `${r.testKey}:${r.side ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(`${test.label}: ${describeScreening(r)}, ${formatDate(new Date(r.testedOn))}`);
  }
  return parts.join("; ");
}
