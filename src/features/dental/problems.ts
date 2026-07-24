/** Static fallback when GET /api/consult/diagnosis-types returns empty. */
export const PROBLEM_TYPES = [
  { value: "caries", label: "Caries/Decay" },
  { value: "missing", label: "Missing" },
  { value: "fracture", label: "Fracture" },
  { value: "gingivitis", label: "Gingivitis" },
  { value: "periodontitis", label: "Periodontitis" },
  { value: "erosion", label: "Erosion" },
  { value: "abscess", label: "Abscess" },
  { value: "sensitivity", label: "Sensitivity" },
  { value: "bruxism", label: "Bruxism" },
  { value: "discoloration", label: "Discoloration" },
  { value: "hypoplasia", label: "Hypoplasia" },
  { value: "abrasion", label: "Abrasion" },
  { value: "abfraction", label: "Abfraction" },
  { value: "hyperemia", label: "Hyperemia" },
  { value: "avulsion", label: "Avulsion" },
  { value: "luxation", label: "Luxation" },
  { value: "enamel_infraction", label: "Enamel Infraction" },
  { value: "root_fracture", label: "Root Fracture" },
  { value: "resorption", label: "Resorption" },
  { value: "filling", label: "Filling" },
  { value: "crown", label: "Crown" },
  { value: "rct", label: "RCT" },
] as const;

export function getProblemLabel(value: string): string {
  const found = PROBLEM_TYPES.find((t) => t.value === value);
  if (found) return found.label;
  const s = value.trim();
  if (!s) return s;
  return s.replace(/_/g, " ");
}

export function formatConditionLabel(
  problem: string,
  getLabel?: (v: string) => string
): string {
  return getLabel?.(problem) ?? getProblemLabel(problem);
}
