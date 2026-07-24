/** Client-side mirror of Practice validatePrescriptionItem (message only). */

export type ValidateRxInput = {
  name: string;
  dosePattern: string;
  foodTiming: string;
  duration: string;
  qtyPrescribed?: number;
};

export function validatePrescriptionItem(
  item: ValidateRxInput
): string | null {
  const { name, dosePattern, foodTiming, duration, qtyPrescribed } = item;
  if (!name || name.trim() === "") {
    return "Medicine name is required";
  }
  if (!dosePattern || dosePattern.trim() === "") {
    return "Dose pattern is required";
  }
  const trimmedDosePattern = dosePattern.trim();
  const isTabletFormat = /^\d+-\d+-\d+$/.test(trimmedDosePattern);
  const isSyrupFormat =
    trimmedDosePattern.toLowerCase().includes("ml") ||
    trimmedDosePattern === "As Needed" ||
    trimmedDosePattern.toLowerCase().includes("as needed");
  if (!isTabletFormat && !isSyrupFormat) {
    if (
      /^\d+-\d+$/.test(trimmedDosePattern) ||
      /^\d+$/.test(trimmedDosePattern)
    ) {
      return "Dose pattern must be in format (e.g., 1-0-1) for tablets, or text like 'As Needed' for syrups";
    }
  }
  const validFoodTimings = ["BF", "AF"];
  if (!foodTiming || !validFoodTimings.includes(foodTiming.trim())) {
    return "Food timing must be one of: BF, AF";
  }
  if (!duration || isNaN(Number(duration)) || Number(duration) <= 0) {
    return "Duration must be a positive number";
  }
  if (
    qtyPrescribed !== undefined &&
    (!Number.isInteger(qtyPrescribed) || qtyPrescribed <= 0)
  ) {
    return "qtyPrescribed must be a positive integer";
  }
  return null;
}

export function isSyrupDosageForm(
  dosageForm: string | null | undefined
): boolean {
  if (!dosageForm) return false;
  const lowerForm = dosageForm.toLowerCase();
  return (
    lowerForm === "syrup" ||
    lowerForm === "suspension" ||
    lowerForm === "drops"
  );
}

export function dosePatternAfterCatalogDrugPick(
  prevDose: string,
  drugDosageForm: string | null | undefined
): string {
  let dosePattern = prevDose || "";
  if (isSyrupDosageForm(drugDosageForm)) {
    if (!dosePattern || /^\d+-\d+-\d+$/.test(dosePattern)) {
      dosePattern = "As Needed";
    }
  } else if (dosePattern && !/^\d+-\d+-\d+$/.test(dosePattern)) {
    dosePattern = "";
  }
  return dosePattern;
}
