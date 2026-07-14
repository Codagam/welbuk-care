/** FDI (ISO 3950) permanent dentition, laid out as an odontogram. */
export const UPPER_TEETH = [
  "18", "17", "16", "15", "14", "13", "12", "11",
  "21", "22", "23", "24", "25", "26", "27", "28",
];

export const LOWER_TEETH = [
  "48", "47", "46", "45", "44", "43", "42", "41",
  "31", "32", "33", "34", "35", "36", "37", "38",
];

/** All permanent FDI ids — same order as Practice ALL_FDI_IDS. */
export const ALL_FDI_IDS = [...UPPER_TEETH, ...LOWER_TEETH];

export function newPlanItemId(seed: number): string {
  return `care-${Date.now().toString(36)}-${seed}`;
}
