import type { AllergyRecordLike, AllergyWarning } from "./types";

export function formatAllergyReaction(a: AllergyRecordLike): string {
  const r = a.reaction?.trim() || a.notes?.trim();
  if (r) return r;
  if (a.severity?.trim()) return a.severity;
  return "Allergy on file";
}

function nameMatchesAllergen(
  drugName: string,
  a: AllergyRecordLike,
  genericHint?: string | null
): boolean {
  const n = a.name.toLowerCase().trim();
  if (!n) return false;
  const med = `${drugName} ${genericHint ?? ""}`.toLowerCase().trim();
  return med.includes(n) || n.includes(med);
}

function penicillinFamilyHeuristic(
  a: AllergyRecordLike,
  drugName: string,
  genericHint?: string | null
): boolean {
  const n = a.name.toLowerCase();
  if (!n.includes("penicillin")) return false;
  const blob = `${drugName} ${genericHint ?? ""}`.toLowerCase();
  return (
    /moxicillin|ampicillin|penicillin|arbenicillin|icarcillin|piperacillin|zlocillin|cloxacillin|fluclox|ticarcillin/.test(
      blob
    ) ||
    (blob.includes("cillin") && !blob.includes("ceph"))
  );
}

function classMatches(
  a: AllergyRecordLike,
  prescribedDrugClass?: string | null
): boolean {
  if (!a.allergenClass?.trim() || !prescribedDrugClass?.trim()) return false;
  return (
    a.allergenClass.trim().toLowerCase() ===
    prescribedDrugClass.trim().toLowerCase()
  );
}

export type MedLine = {
  drugName: string;
  drugClass?: string | null;
  genericName?: string | null;
};

export function matchMedicationToAllergies(
  line: MedLine,
  allergies: AllergyRecordLike[]
): AllergyWarning[] {
  if (!allergies.length) return [];
  const out: AllergyWarning[] = [];
  const drugName = line.drugName?.trim() ?? "";
  if (!drugName) return [];
  for (const a of allergies) {
    if (!a.name?.trim()) continue;
    let reason: AllergyWarning["reason"] | null = null;
    if (classMatches(a, line.drugClass)) reason = "class";
    else if (nameMatchesAllergen(drugName, a, line.genericName))
      reason = "name";
    else if (penicillinFamilyHeuristic(a, drugName, line.genericName))
      reason = "penicillin_family";
    if (reason) {
      const sev = a.severity != null ? String(a.severity) : null;
      out.push({
        drug: drugName,
        reaction: formatAllergyReaction(a),
        allergenName: a.name.trim(),
        reason,
        chartReaction: a.reaction?.trim() || null,
        chartAllergenClass: a.allergenClass?.trim() || null,
        severity: sev?.trim() ? sev.trim() : null,
      });
    }
  }
  return out;
}

export function matchPrescriptionLinesToAllergies(
  lines: MedLine[],
  allergies: AllergyRecordLike[]
): { warnings: AllergyWarning[] } {
  const all: AllergyWarning[] = [];
  for (const line of lines) {
    all.push(...matchMedicationToAllergies(line, allergies));
  }
  return { warnings: all };
}

export function formatAllergyMatchSummaryLine(w: AllergyWarning): string {
  const matchText =
    w.reason === "class"
      ? (() => {
          const cls = w.chartAllergenClass?.trim();
          return cls ? `class match — ${cls}` : "class match";
        })()
      : w.reason === "name"
        ? "name match"
        : "penicillin family";
  return `${w.allergenName} ↔ ${w.drug} (${matchText})`;
}

/** The detail under each match: reaction, class when not already in the title, severity. */
export function allergyWarningSubtitleParts(
  w: AllergyWarning
): { label: string; value: string }[] {
  const parts: { label: string; value: string }[] = [];
  if (w.chartReaction?.trim()) {
    parts.push({ label: "Reaction", value: w.chartReaction.trim() });
  }
  if (w.chartAllergenClass?.trim() && w.reason !== "class") {
    parts.push({ label: "Class", value: w.chartAllergenClass.trim() });
  }
  if (w.severity?.trim()) {
    parts.push({ label: "Severity", value: w.severity.trim() });
  }
  return parts;
}
