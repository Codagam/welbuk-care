/**
 * Which planner a consult shows. Ported from Practice lib/consult/specialties.ts;
 * keep the rules identical, so a consult shows the same chart on both.
 *
 * THE DOCTOR WINS. A consult belongs to a doctor, and a multi-specialty clinic cannot
 * answer this with one facility value: it would hand the dentist or the dermatologist
 * the wrong chart. The clinic's value is only for a doctor with no specialty recorded.
 *
 * Pure, so it can be checked against Practice's own function.
 */

export type SpecialtyId = "dental" | "eye" | "derm" | "general";

export interface SpecialtyDef {
  id: SpecialtyId;
  /** Exact `consultationType` values (lower-cased) that select this specialty. */
  aliases: string[];
  /** Prefixes also accepted, for free-typed values like "Ophthalmology Clinic". */
  prefixes: string[];
  chartKind: "dental" | "eye" | "derm" | null;
  /** Free-text specialty labels, as on `Doctor.specialization`. */
  labels: string[];
}

const SPECIALTIES: Record<SpecialtyId, SpecialtyDef> = {
  dental: {
    id: "dental",
    aliases: ["dental", "dentist", "dentistry"],
    prefixes: ["dental", "dentist"],
    chartKind: "dental",
    labels: ["Dentistry", "Dental", "Oral & Maxillofacial Surgery"],
  },
  eye: {
    id: "eye",
    aliases: ["eye", "ophthalmology", "optometry", "ophthal"],
    prefixes: ["ophthal", "optom"],
    chartKind: "eye",
    labels: ["Ophthalmology", "Optometry", "Eye"],
  },
  derm: {
    id: "derm",
    aliases: ["derm", "derma", "dermatology", "skin"],
    prefixes: ["dermat"],
    chartKind: "derm",
    labels: ["Dermatology", "Derm", "Dermatology & Venereology"],
  },
  general: {
    id: "general",
    aliases: [
      "general",
      "gp",
      "opd",
      "general practice",
      "general medicine",
      "general physician",
      "",
    ],
    prefixes: [],
    chartKind: null,
    labels: ["General Medicine", "General Practice", "General Physician"],
  },
};

const ORDERED = [
  SPECIALTIES.dental,
  SPECIALTIES.eye,
  SPECIALTIES.derm,
] as const;

/** A `consultationType` value. Unknown values are a plain consult, never an error. */
export function resolveSpecialty(raw: string | null | undefined): SpecialtyDef {
  const n = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!n) return SPECIALTIES.general;
  for (const s of ORDERED) {
    if (s.aliases.includes(n)) return s;
  }
  // Only after every exact alias, so a value naming one is never taken by a prefix.
  for (const s of ORDERED) {
    if (s.prefixes.some((p) => n.startsWith(p))) return s;
  }
  return SPECIALTIES.general;
}

function labelMatches(
  specialization: string | null | undefined,
  spec: SpecialtyDef
): boolean {
  if (spec.id === "general") return true;
  const n = String(specialization ?? "")
    .trim()
    .toLowerCase();
  if (!n) return false;
  // Deliberately loose: this is free text ("Ophthalmology (Retina)").
  return spec.labels.some((c) => {
    const t = c.toLowerCase();
    return n === t || n.includes(t) || t.includes(n);
  });
}

/** A label like "Oral & Maxillofacial Surgery". Cardiology or ENT is a plain consult. */
export function resolveSpecialtyFromLabel(
  label: string | null | undefined
): SpecialtyDef {
  const n = String(label ?? "")
    .trim()
    .toLowerCase();
  if (!n) return SPECIALTIES.general;
  for (const s of ORDERED) {
    if (labelMatches(n, s)) return s;
  }
  return resolveSpecialty(n);
}

export interface ConsultSpecialtyInput {
  doctorSpecialization?: string | null;
  doctorSpecializations?: string[] | null;
  /** Specialties the clinic enabled. Empty means no limit: the doctor decides. */
  facilityConsultationTypes?: string[] | null;
  facilityConsultationType?: string | null;
}

/**
 * 1. The doctor's specialty, when it gives a planner the clinic allows
 * 2. The doctor has a specialty but none gives an allowed planner → general
 * 3. No specialty recorded on the doctor → the clinic's default
 * 4. general
 *
 * Step 2 is why a General Medicine doctor at a dental clinic gets no dental chart:
 * "no planner" and "not set" are different answers.
 */
export function resolveConsultSpecialty(
  input: ConsultSpecialtyInput
): SpecialtyDef {
  const enabled = (input.facilityConsultationTypes ?? [])
    .map((t) => resolveSpecialty(t).id)
    .filter((id) => id !== "general");

  const doctorLabels = [
    input.doctorSpecialization,
    ...(input.doctorSpecializations ?? []),
  ].filter((l): l is string => Boolean(l && l.trim()));

  for (const label of doctorLabels) {
    const fromDoctor = resolveSpecialtyFromLabel(label);
    if (!fromDoctor.chartKind) continue;
    if (enabled.length === 0 || enabled.some((id) => id === fromDoctor.id)) {
      return fromDoctor;
    }
  }

  if (doctorLabels.length > 0) return SPECIALTIES.general;

  const fromFacility = resolveSpecialty(input.facilityConsultationType);
  if (fromFacility.chartKind) return fromFacility;

  return SPECIALTIES.general;
}
