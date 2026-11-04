/**
 * Referral types, tests and rules. Ported from Practice lib/referral/referral-constants.ts
 * and components/referral/referral-form-dialog.tsx. Pure, so it can be checked outside
 * the app.
 */

export const REFERRAL_TYPES = ["Lab", "Scan", "X-Ray", "Specialist"] as const;
export type ReferralType = (typeof REFERRAL_TYPES)[number];

export const PRIORITIES = [
  { value: "routine", label: "Routine" },
  { value: "urgent", label: "Urgent" },
  { value: "stat", label: "Stat" },
] as const;

export const TESTS_BY_TYPE: Record<ReferralType, string[]> = {
  Lab: [
    "Complete Blood Count (CBC)",
    "Basic/Comprehensive Metabolic Panel",
    "Lipid Panel",
    "Thyroid Function (TSH/T3/T4)",
    "HbA1c",
    "Liver/Renal Function",
    "Urine Analysis",
    "Blood Culture",
    "ESR/CRP",
    "PT/INR",
    "Serum Electrolytes",
    "Fasting Blood Sugar",
    "HIV Screening",
    "Hepatitis B/C Panel",
    "Vitamin D/B12",
    "Iron Studies",
    "Tumor Markers",
  ],
  Scan: [
    "Ultrasound (Abdomen, Pelvis, Thyroid)",
    "CT (Brain, Chest, Abdomen & Pelvis, Spine)",
    "MRI (Brain, Spine, Knee/Shoulder, Abdomen)",
    "PET Scan",
    "DEXA Scan",
    "Echocardiogram",
    "2D Echo with Doppler",
    "Doppler (Carotid, Peripheral)",
  ],
  "X-Ray": [
    "Chest X-Ray (PA/AP)",
    "Skull",
    "Cervical/Thoracic/Lumbar Spine",
    "Pelvis",
    "Hip",
    "Knee",
    "Ankle/Foot",
    "Wrist/Hand",
    "Shoulder",
    "Elbow",
    "Abdomen (Erect)",
    "KUB",
  ],
  Specialist: [
    "Cardiology",
    "Orthopedics",
    "Neurology",
    "Dermatology",
    "Ophthalmology",
    "ENT",
    "Gastroenterology",
    "Psychiatry",
    "Pulmonology",
    "Endocrinology",
    "Urology",
    "Gynecology & Obstetrics",
    "Oncology",
    "Nephrology",
    "Rheumatology",
    "Hematology",
    "Infectious Disease",
    "Plastic Surgery",
    "Vascular Surgery",
    "General Surgery",
  ],
};

/** Removing a type takes its tests with it, so none is sent under a type no longer chosen. */
export function testsStillAllowed(
  selected: string[],
  types: ReferralType[]
): string[] {
  const allowed = new Set(types.flatMap((t) => TESTS_BY_TYPE[t] ?? []));
  return selected.filter((t) => allowed.has(t));
}

/** The chosen types' tests, by type, narrowed by the search. Empty groups are left out. */
export function testGroups(
  types: ReferralType[],
  query: string
): { type: ReferralType; tests: string[] }[] {
  const q = query.trim().toLowerCase();
  return types
    .map((type) => ({
      type,
      tests: (TESTS_BY_TYPE[type] ?? []).filter(
        (t) => !q || `${type} ${t}`.toLowerCase().includes(q)
      ),
    }))
    .filter((g) => g.tests.length > 0);
}

export type ReferralFormValues = {
  patientName: string;
  doctorName: string;
  fromFacilityId: string;
  types: ReferralType[];
  tests: string[];
  toFacilityId: string;
  toDoctorId: string;
};

/** What stops the referral being issued, in the order Practice checks it. */
export function referralFormError(v: ReferralFormValues): string | null {
  if (!v.patientName.trim()) return "Patient name is required.";
  if (v.types.length === 0) {
    return "Select at least one referral type (e.g. Lab, X-Ray).";
  }
  if (v.tests.length === 0) return "Select at least one test or service.";
  if (!v.toFacilityId) return "Refer to facility is required.";
  if (v.types.includes("Specialist") && !v.toDoctorId.trim()) {
    return "Select the receiving doctor at the referred facility.";
  }
  if (!v.doctorName.trim()) return "Referring doctor name is required.";
  if (!v.fromFacilityId) return "Current facility is required.";
  return null;
}
