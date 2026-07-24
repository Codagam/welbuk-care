/** Plan-of-care types — mirror Practice PlanOfCare / prescription payloads. */

export type FoodTiming = "BF" | "AF";

export interface PlanPrescription {
  id: string;
  name: string;
  dosePattern: string;
  foodTiming: FoodTiming | string;
  duration: string;
  drugId?: string;
  isAttachment?: boolean;
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
