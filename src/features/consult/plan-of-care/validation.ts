/** Client-side mirror of Practice validatePrescriptionItem (message only). */

import type { PrescriptionItemInput } from "@/features/consult/types";

import {
  checkDosePattern,
  normalizeDosePattern,
  normalizeDurationUnit,
} from "./sig";
import type { PlanPrescription } from "./types";

export type ValidateRxInput = {
  name: string;
  dosePattern: string;
  foodTiming: string;
  duration: string | number;
  durationValue?: number | null;
  durationUnit?: string | null;
  doseNote?: string | null;
  qtyPrescribed?: number;
};

const MAX_NOTE = 500;
const MAX_DURATION_VALUE = 999;

/** Practice lib/prescription/line-sig.ts: value + unit, else legacy days. */
function checkCourse(item: ValidateRxInput): string | null {
  const { duration, durationValue, durationUnit } = item;
  const unit = normalizeDurationUnit(durationUnit);
  const hasValue = durationValue !== undefined && durationValue !== null;
  if (hasValue || unit) {
    const value = Number(durationValue);
    if (
      !unit ||
      !Number.isInteger(value) ||
      value < 1 ||
      value > MAX_DURATION_VALUE
    ) {
      return "Duration must be a whole number from 1 to 999 with a unit (days, weeks or months)";
    }
    return null;
  }
  const legacy = String(duration ?? "").trim();
  if (!legacy || Number.isNaN(Number(legacy)) || Number(legacy) <= 0) {
    return "Duration must be a positive number";
  }
  return null;
}

export function validatePrescriptionItem(
  item: ValidateRxInput
): string | null {
  const { name, dosePattern, foodTiming, doseNote, qtyPrescribed } = item;
  if (!name || name.trim() === "") {
    return "Medicine name is required";
  }
  const doseError = checkDosePattern(name.trim(), dosePattern);
  if (doseError) return doseError;
  const validFoodTimings = ["BF", "AF"];
  if (!foodTiming || !validFoodTimings.includes(foodTiming.trim())) {
    return "Food timing must be one of: BF, AF";
  }
  const courseError = checkCourse(item);
  if (courseError) return courseError;
  if ((doseNote ?? "").trim().length > MAX_NOTE) {
    return `Note must be ${MAX_NOTE} characters or fewer`;
  }
  if (
    qtyPrescribed !== undefined &&
    (!Number.isInteger(qtyPrescribed) || qtyPrescribed <= 0)
  ) {
    return "qtyPrescribed must be a positive integer";
  }
  return null;
}

/**
 * The fields of one line as the server takes them (Practice
 * lib/prescription/line-payload.ts). Complete REPLACES every line of the consult,
 * so a field left out here is erased from the record, not merely unchanged.
 */
export function toLinePayload(p: PlanPrescription): PrescriptionItemInput {
  const drugId = p.drugId?.trim();
  const doseNote = p.doseNote?.trim();
  return {
    name: p.name.trim(),
    dosePattern: normalizeDosePattern(p.dosePattern),
    foodTiming: String(p.foodTiming),
    duration: String(p.duration),
    ...(drugId ? { drugId } : {}),
    ...(p.durationValue != null && p.durationUnit
      ? { durationValue: p.durationValue, durationUnit: p.durationUnit }
      : {}),
    ...(doseNote ? { doseNote } : {}),
    ...(p.regimenId
      ? { regimenId: p.regimenId, regimenVersion: p.regimenVersion ?? null }
      : {}),
    ...(p.qtyPrescribed != null && p.qtyPrescribed > 0
      ? { qtyPrescribed: p.qtyPrescribed }
      : {}),
  };
}
