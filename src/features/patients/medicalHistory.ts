/**
 * Display model for the patient-page Medical history card and the header's
 * insurance line. Ported from Practice
 * (`components/patient/details/sections/MedicalHistoryCard.tsx` and the
 * `insuranceSummary` memo in `components/patient/details/home.tsx`).
 *
 * The questionnaire has been stored in two shapes: the current one
 * (`medicalHistory.pastConditions` / `surgeries` / `hospitalizations` /
 * `insurance`, `CurrentMedications`, `allergies` as `{selectedValue,
 * inputValue}` fields) and an older flat one (`step1Data`, `step2Data`,
 * `step3Data`, or flat keys on `medicalHistory` / `lifestyle`). A summary that
 * only reads the new shape tells staff an older patient has no history at all.
 */

type Rec = Record<string, unknown>;

const asRec = (v: unknown): Rec | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null;

const str = (v: unknown): string =>
  v == null ? "" : Array.isArray(v) ? v.filter(Boolean).join(", ") : String(v);

export function isYes(v: unknown): boolean {
  if (v === true) return true;
  const t = str(v).trim().toLowerCase();
  return t === "yes" || t === "true" || t === "1";
}

/** Tri-state answer: null when the question was never answered. */
export function yesNo(v: unknown): "Yes" | "No" | null {
  if (v == null || str(v).trim() === "") return null;
  return isYes(v) ? "Yes" : "No";
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2021-03" → "March 2021"; anything else → "". */
export function formatMonthYear(value: string): string {
  if (!value || value.length !== 7) return "";
  const [year, month] = value.split("-");
  if (!year || !month) return "";
  const i = parseInt(month, 10) - 1;
  return `${i >= 0 && i < 12 ? MONTHS[i] : month} ${year}`;
}

export type ConditionItem = { name: string; since: string | null };

export type PastHistoryView = {
  conditions: ConditionItem[];
  hasSurgeries: unknown;
  surgeryDetails: string;
  hasHospitalizations: unknown;
  hospitalizationDetails: string;
};

export type MedsAllergiesView = {
  takingMedicines: unknown;
  medicines: string[];
  allergicToMedicines: unknown;
  medicineAllergies: string;
  hasFoodAllergies: unknown;
  foodAllergies: string;
};

export type MedicalHistoryView = {
  past: PastHistoryView | null;
  medsAllergies: MedsAllergiesView | null;
};

function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => str(x).trim()).filter(Boolean);
  const s = str(v).trim();
  return s ? s.split(",").map((x) => x.trim()).filter(Boolean) : [];
}

function pastHistory(q: Rec): PastHistoryView | null {
  const mh = asRec(q.medicalHistory);
  const isNewShape =
    !!mh &&
    (mh.pastConditions != null ||
      mh.surgeries != null ||
      mh.hospitalizations != null);

  if (isNewShape && mh) {
    if (mh.skipped) return null;
    const pc = asRec(mh.pastConditions);
    const dates = asRec(pc?.conditionDates) ?? {};
    const conditions: ConditionItem[] = (
      Array.isArray(pc?.selectedValue) ? (pc!.selectedValue as unknown[]) : []
    )
      .map((c) => str(c).trim())
      .filter(Boolean)
      .map((name) => ({
        name,
        since:
          typeof dates[name] === "string"
            ? formatMonthYear(dates[name] as string) || null
            : null,
      }));
    const other = str(pc?.inputValue).trim();
    if (other) {
      const otherDate = str(pc?.otherConditionDate);
      conditions.push({ name: other, since: formatMonthYear(otherDate) || null });
    }
    const surgeries = asRec(mh.surgeries);
    const hosp = asRec(mh.hospitalizations);
    return {
      conditions,
      hasSurgeries: surgeries?.selectedValue ?? "",
      surgeryDetails: str(surgeries?.inputValue).trim(),
      hasHospitalizations: hosp?.selectedValue ?? "",
      hospitalizationDetails: str(hosp?.inputValue).trim(),
    };
  }

  // Older flat shape.
  const legacy = mh ?? asRec(q.step1Data);
  if (!legacy || legacy.skipped) return null;
  const dates = asRec(legacy.conditionDates) ?? {};
  const conditions: ConditionItem[] = toList(legacy.conditions).map((name) => ({
    name,
    since:
      typeof dates[name] === "string"
        ? formatMonthYear(dates[name] as string) || null
        : null,
  }));
  const other = str(legacy.otherCondition).trim();
  if (other) {
    conditions.push({
      name: other,
      since: formatMonthYear(str(legacy.otherConditionDate)) || null,
    });
  }
  return {
    conditions,
    hasSurgeries: legacy.hasSurgeries ?? "",
    surgeryDetails: str(legacy.surgeryDetails).trim(),
    hasHospitalizations: legacy.hasHospitalizations ?? "",
    hospitalizationDetails: str(legacy.hospitalizationDetails).trim(),
  };
}

function medsAllergies(q: Rec): MedsAllergiesView | null {
  const meds = asRec(q.CurrentMedications);
  const allg = asRec(q.allergies);
  const step2 = asRec(q.step2Data);

  if (meds || allg) {
    const medications = asRec(meds?.medications);
    const ma = asRec(allg?.medicineAllergies);
    const fa = asRec(allg?.foodAllergies);
    if (medications || ma || fa || asRec(meds?.["herbal&ayurvedic"])) {
      const medList = toList(medications?.inputValue);
      return {
        takingMedicines:
          medications?.selectedValue ?? step2?.takingMedicines ?? "",
        medicines: medList.length ? medList : toList(step2?.medicines),
        allergicToMedicines:
          ma?.selectedValue ?? step2?.allergicToMedicines ?? "",
        medicineAllergies: str(
          ma?.inputValue ?? step2?.medicineAllergies
        ).trim(),
        hasFoodAllergies: fa?.selectedValue ?? "",
        foodAllergies: str(fa?.inputValue).trim(),
      };
    }
    return {
      takingMedicines: meds?.takingMedicines ?? step2?.takingMedicines ?? "",
      medicines: toList(meds?.medicines ?? step2?.medicines),
      allergicToMedicines:
        allg?.allergicToMedicines ?? step2?.allergicToMedicines ?? "",
      medicineAllergies: str(
        allg?.medicineAllergies ?? step2?.medicineAllergies
      ).trim(),
      hasFoodAllergies: "",
      foodAllergies: "",
    };
  }

  if (!step2 || step2.skipped) return null;
  return {
    takingMedicines: step2.takingMedicines ?? "",
    medicines: toList(step2.medicines),
    allergicToMedicines: step2.allergicToMedicines ?? "",
    medicineAllergies: str(step2.medicineAllergies).trim(),
    hasFoodAllergies: "",
    foodAllergies: "",
  };
}

export function buildMedicalHistoryView(
  questionnaire: unknown
): MedicalHistoryView | null {
  const q = asRec(questionnaire);
  if (!q) return null;
  const past = pastHistory(q);
  const ma = medsAllergies(q);
  if (!past && !ma) return null;
  return { past, medsAllergies: ma };
}

export type InsuranceSummary = {
  insuranceName: string;
  typeLabel: string;
  validTill: string;
  /** Storage URL (or data URI) of the uploaded card, when one exists. */
  documentUrl: string;
  documentName: string;
};

/** Practice's `insuranceSummary`: null unless the patient has insurance. */
export function buildInsuranceSummary(
  questionnaire: unknown
): InsuranceSummary | null {
  const q = asRec(questionnaire);
  if (!q) return null;
  const mh = asRec(q.medicalHistory);
  const isNewShape = !!mh && ("pastConditions" in mh || "insurance" in mh);

  let s: Rec | null;
  if (isNewShape && asRec(mh?.insurance)) {
    const ins = asRec(mh!.insurance)!;
    const doc = asRec(ins.document);
    const typeStr = str(ins.type);
    const lower = typeStr.toLowerCase();
    s = {
      hasHealthInsurance: ins.hasInsurance ?? "",
      insuranceType: lower.includes("government")
        ? "government"
        : lower.includes("private")
          ? "private"
          : "other",
      insuranceTypeLabel: typeStr || undefined,
      insuranceName: ins.insuranceName ?? "",
      insuranceValidTill: ins.validTill ?? "",
      insuranceDocument: doc?.uri ?? doc?.name ?? "",
      insuranceDocumentName: doc?.name ?? "",
    };
  } else {
    s = asRec(q.lifestyle) ?? asRec(q.step3Data);
  }
  if (!s) return null;

  const hasInsurance =
    isYes(s.hasHealthInsurance) ||
    isYes(s.hasInsurance) ||
    str(s.insuranceName).trim().length > 0;
  if (!hasInsurance) return null;

  const slug = str(s.insuranceType).trim().toLowerCase();
  const other = str(s.otherInsuranceType).trim();
  const labelFromSlug =
    slug === "government"
      ? "Government Insurance"
      : slug === "private"
        ? "Private Insurance"
        : slug === "other"
          ? other || "Other"
          : str(s.insuranceType).trim();

  return {
    insuranceName: str(s.insuranceName).trim(),
    typeLabel: str(s.insuranceTypeLabel).trim() || labelFromSlug,
    validTill: str(s.insuranceValidTill ?? s.validTill).trim(),
    documentUrl: str(s.insuranceDocument).trim(),
    documentName: str(s.insuranceDocumentName).trim(),
  };
}
