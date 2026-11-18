/** Plan-of-care types — mirror Practice PlanOfCare / prescription payloads. */

export type FoodTiming = "BF" | "AF";

export interface PlanPrescription {
  id: string;
  name: string;
  dosePattern: string;
  foodTiming: FoodTiming | string;
  /** Legacy course in DAYS. A value + unit line carries both ("90", 3 + MONTHS). */
  duration: string;
  durationValue?: number | null;
  durationUnit?: string | null;
  doseNote?: string | null;
  regimenId?: string | null;
  regimenVersion?: number | null;
  qtyPrescribed?: number | null;
  drugId?: string;
  isAttachment?: boolean;
  // On this device only: never sent to the server, and absent on a reloaded line.
  dosageForm?: string | null;
  /** Filled without the doctor typing it; flagged for checking on a child. */
  autoFilled?: boolean;
  /** Where the row's values came from, shown under the medicine. */
  fillSource?: "regimen" | "history" | "new" | null;
  historyDate?: string | null;
}

export interface TemplateMedication {
  name: string;
  dosePattern: string;
  foodTiming: string;
  duration: string;
}

export interface AttachedRxImage {
  id: string;
  url: string;
  /** Local file URI pending upload */
  localUri?: string;
  fileName?: string;
  mimeType?: string;
}

export interface AllergyRecordLike {
  name: string;
  reaction?: string | null;
  notes?: string | null;
  allergenClass?: string | null;
  severity?: string | null;
}

export interface AllergyWarning {
  drug: string;
  reaction: string;
  allergenName: string;
  reason: "name" | "class" | "penicillin_family";
  chartReaction?: string | null;
  chartAllergenClass?: string | null;
  severity?: string | null;
}
