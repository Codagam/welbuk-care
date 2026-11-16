/**
 * Questionnaire data model — a line-for-line port of Practice
 * `components/patient/questionnaire/questionnaire-sheet.tsx`: the same step
 * shapes, the same hydration (new shape first, legacy `stepNData` second) and
 * the same API payloads, so a record started on the web and finished on the
 * tablet (or the reverse) reads identically on both.
 */
import type { PatientQuestionnaire } from "../types";

export const STEP_TITLES = [
  "Past Medical History",
  "Medications & Allergies",
  "History & Insurance",
] as const;

export const STEP_DESCRIPTIONS = [
  "Tell us about any past or ongoing medical conditions",
  "This information helps prevent unsafe drug reactions",
  "Background information for care and billing",
] as const;

export const CONDITIONS = [
  "Diabetes",
  "High Blood Pressure",
  "Heart Disease",
  "Asthma",
  "Tuberculosis",
  "Thyroid Problems",
  "Kidney Disease",
  "Cancer",
  "Mental Health Issues",
] as const;

export const GOVERNMENT_INSURANCE_NAMES = [
  "CMCHIS (Chief Minister's Comprehensive Health Insurance Scheme)",
  "ESI (Employees' State Insurance)",
  "CGHS (Central Government Health Scheme)",
  "ECHS (Ex-Servicemen Contributory Health Scheme)",
  "Arogya Karnataka",
  "Ayushman Bharat - Pradhan Mantri Jan Arogya Yojana (PM-JAY)",
  "Other",
] as const;

export const PRIVATE_INSURANCE_NAMES = [
  "Bharati AXA General Insurance",
  "Bajaj Allianz General Insurance",
  "HDFC ERGO General Insurance",
  "ICICI Lombard General Insurance",
  "New India Assurance",
  "Oriental Insurance",
  "Reliance General Insurance",
  "Star Health and Allied Insurance",
  "United India Insurance",
  "Other",
] as const;

/** "yes" | "no" | "" — Practice keeps the radio value lower-case. */
export type YesNo = "yes" | "no" | "";

export interface Step1Data {
  conditions: string[];
  /** condition → "YYYY-MM" (optional "since"). */
  conditionDates: Record<string, string>;
  otherCondition: string;
  otherConditionDate: string;
  hasSurgeries: YesNo;
  surgeryDetails: string;
  hasHospitalizations: YesNo;
  hospitalizationDetails: string;
}

export interface Step2Data {
  takingMedicines: YesNo;
  medicines: string[];
  hasHerbalMedicines: YesNo;
  herbalMedicineDetails: string;
  allergicToMedicines: YesNo;
  medicineAllergies: string;
  hasFoodAllergies: YesNo;
  foodAllergies: string;
}

export interface Step3Data {
  hasHealthInsurance: YesNo;
  /** "government" | "private" | "other" | "" */
  insuranceType: string;
  otherInsuranceType: string;
  insuranceName: string;
  /** Stored URL of the uploaded document. */
  insuranceDocument: string;
  insuranceDocumentName: string;
  /** "YYYY-MM" */
  insuranceValidTill: string;
}

export const EMPTY_STEP1: Step1Data = {
  conditions: [],
  conditionDates: {},
  otherCondition: "",
  otherConditionDate: "",
  hasSurgeries: "",
  surgeryDetails: "",
  hasHospitalizations: "",
  hospitalizationDetails: "",
};

export const EMPTY_STEP2: Step2Data = {
  takingMedicines: "",
  medicines: [],
  hasHerbalMedicines: "",
  herbalMedicineDetails: "",
  allergicToMedicines: "",
  medicineAllergies: "",
  hasFoodAllergies: "",
  foodAllergies: "",
};

export const EMPTY_STEP3: Step3Data = {
  hasHealthInsurance: "",
  insuranceType: "",
  otherInsuranceType: "",
  insuranceName: "",
  insuranceDocument: "",
  insuranceDocumentName: "",
  insuranceValidTill: "",
};

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec | undefined =>
  v && typeof v === "object" ? (v as Rec) : undefined;
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const lowerYesNo = (v: unknown): YesNo =>
  v === "Yes" || v === "yes" ? "yes" : v === "No" || v === "no" ? "no" : "";

/** Legacy `{ month, year }` or "YYYY-MM" → "YYYY-MM". */
function monthYearOf(v: unknown): string {
  if (typeof v === "string") return v;
  const o = rec(v);
  if (o && o.month != null && o.year != null) {
    return `${o.year}-${String(o.month).padStart(2, "0")}`;
  }
  return "";
}

export function hydrate(q: PatientQuestionnaire | null | undefined): {
  step: 1 | 2 | 3;
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
} {
  if (!q) {
    return { step: 1, step1: EMPTY_STEP1, step2: EMPTY_STEP2, step3: EMPTY_STEP3 };
  }
  const raw = q as unknown as Rec;
  const mh = rec(q.medicalHistory);
  const allg = rec(q.allergies);
  const meds = rec(q.CurrentMedications);
  const legacy1 = rec(raw.step1Data);
  const legacy2 = rec(raw.step2Data);
  const legacy3 = rec(raw.step3Data);
  const isNewShape =
    !!mh &&
    (mh.pastConditions != null || mh.surgeries != null || mh.hospitalizations != null);

  // ── Step 1 ──
  let step1 = EMPTY_STEP1;
  if (isNewShape && mh && !mh.skipped) {
    const pc = rec(mh.pastConditions);
    const surg = rec(mh.surgeries);
    const hosp = rec(mh.hospitalizations);
    const dates: Record<string, string> = {};
    for (const [k, v] of Object.entries(rec(pc?.conditionDates) ?? {})) {
      if (typeof v === "string") dates[k] = v;
    }
    step1 = {
      conditions: Array.isArray(pc?.selectedValue)
        ? (pc!.selectedValue as unknown[]).map(String)
        : [],
      conditionDates: dates,
      otherCondition: str(pc?.inputValue),
      otherConditionDate: str(pc?.otherConditionDate),
      hasSurgeries: lowerYesNo(surg?.selectedValue),
      surgeryDetails: str(surg?.inputValue),
      hasHospitalizations: lowerYesNo(hosp?.selectedValue),
      hospitalizationDetails: str(hosp?.inputValue),
    };
  } else if (legacy1 && !legacy1.skipped) {
    const dates: Record<string, string> = {};
    for (const [k, v] of Object.entries(rec(legacy1.conditionDates) ?? {})) {
      const d = monthYearOf(v);
      if (d) dates[k] = d;
    }
    step1 = {
      conditions: Array.isArray(legacy1.conditions)
        ? (legacy1.conditions as unknown[]).map(String)
        : [],
      conditionDates: dates,
      otherCondition: str(legacy1.otherCondition),
      otherConditionDate: monthYearOf(legacy1.otherConditionDate),
      hasSurgeries: lowerYesNo(legacy1.hasSurgeries),
      surgeryDetails: str(legacy1.surgeryDetails),
      hasHospitalizations: lowerYesNo(legacy1.hasHospitalizations),
      hospitalizationDetails: str(legacy1.hospitalizationDetails),
    };
  }

  // ── Step 2 ──
  let step2 = EMPTY_STEP2;
  const medsNew = !!meds && !meds.skipped;
  const allgNew = !!allg && !allg.skipped;
  if (medsNew || allgNew) {
    const medications = rec(meds?.medications);
    const herbal = rec(meds?.["herbal&ayurvedic"]);
    const medAll = rec(allg?.medicineAllergies);
    const foodAll = rec(allg?.foodAllergies);
    const list = str(medications?.inputValue)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    step2 = {
      takingMedicines: lowerYesNo(medications?.selectedValue),
      medicines: list,
      hasHerbalMedicines: lowerYesNo(herbal?.selectedValue),
      herbalMedicineDetails: str(herbal?.inputValue),
      allergicToMedicines: lowerYesNo(medAll?.selectedValue),
      medicineAllergies: str(medAll?.inputValue),
      hasFoodAllergies: lowerYesNo(foodAll?.selectedValue),
      foodAllergies: str(foodAll?.inputValue),
    };
  } else if (legacy2 && !legacy2.skipped) {
    step2 = {
      takingMedicines: lowerYesNo(legacy2.takingMedicines),
      medicines: Array.isArray(legacy2.medicines)
        ? (legacy2.medicines as unknown[]).map(String)
        : [],
      hasHerbalMedicines: lowerYesNo(legacy2.hasHerbalMedicines),
      herbalMedicineDetails: str(legacy2.herbalMedicineDetails),
      allergicToMedicines: lowerYesNo(legacy2.allergicToMedicines),
      medicineAllergies: str(legacy2.medicineAllergies),
      hasFoodAllergies: lowerYesNo(legacy2.hasFoodAllergies),
      foodAllergies: str(legacy2.foodAllergies),
    };
  }

  // ── Step 3 ──
  let step3 = EMPTY_STEP3;
  const ins = isNewShape ? rec(mh?.insurance) : undefined;
  if (ins && !ins.skipped) {
    const typeStr = str(ins.type).toLowerCase();
    const doc = rec(ins.document);
    step3 = {
      hasHealthInsurance: lowerYesNo(ins.hasInsurance),
      insuranceType: typeStr.includes("government")
        ? "government"
        : typeStr.includes("private")
          ? "private"
          : typeStr
            ? "other"
            : "",
      otherInsuranceType: str(ins.insuranceNameOther),
      insuranceName: str(ins.insuranceName),
      insuranceDocument: doc ? str(doc.uri) || str(doc.name) : "",
      insuranceDocumentName: doc ? str(doc.name) : "",
      // Older tablet saves wrote a full date; the field is month + year.
      insuranceValidTill: str(ins.validTill).slice(0, 7),
    };
  } else if (legacy3 && !legacy3.skipped) {
    step3 = {
      hasHealthInsurance: lowerYesNo(legacy3.hasHealthInsurance),
      insuranceType: str(legacy3.insuranceType),
      otherInsuranceType: str(legacy3.otherInsuranceType),
      insuranceName: str(legacy3.insuranceName),
      insuranceDocument: str(legacy3.insuranceDocument),
      insuranceDocumentName: str(legacy3.insuranceDocumentName),
      insuranceValidTill: str(legacy3.insuranceValidTill).slice(0, 7),
    };
  }

  const cs = Number(q.currentStep);
  const step = cs === 2 || cs === 3 ? cs : 1;
  return { step, step1, step2, step3 };
}

// ── Payloads (Practice `toMedicalHistoryPayload` & friends) ─────────────────

const upperYesNo = (v: YesNo | string): string =>
  v === "yes" ? "Yes" : v === "no" ? "No" : v || "";
/** Practice's second toYesNo: an unanswered allergy/medicine question is "No". */
const upperYesNoDefaultNo = (v: YesNo | string): string =>
  v === "yes" ? "Yes" : v === "no" ? "No" : v || "No";

export function toMedicalHistoryPayload(
  step1: Step1Data,
  insurance?: Step3Data | null
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    pastConditions: {
      selectedValue: step1.conditions,
      inputValue: step1.otherCondition,
      conditionDates: step1.conditionDates,
      otherConditionDate: step1.otherConditionDate,
    },
    surgeries: {
      selectedValue: upperYesNo(step1.hasSurgeries),
      inputValue: step1.surgeryDetails,
    },
    hospitalizations: {
      selectedValue: upperYesNo(step1.hasHospitalizations),
      inputValue: step1.hospitalizationDetails,
    },
  };
  if (insurance && (insurance.hasHealthInsurance || insurance.insuranceName)) {
    const typeLabel =
      insurance.insuranceType === "government"
        ? "Government Insurance"
        : insurance.insuranceType === "private"
          ? "Private Insurance"
          : insurance.insuranceType === "other"
            ? insurance.otherInsuranceType || "Other"
            : insurance.insuranceType;
    payload.insurance = {
      hasInsurance: upperYesNoDefaultNo(insurance.hasHealthInsurance),
      type: typeLabel,
      insuranceName: insurance.insuranceName,
      insuranceNameOther: insurance.otherInsuranceType,
      validTill: insurance.insuranceValidTill || null,
      document: insurance.insuranceDocument
        ? {
            uri: insurance.insuranceDocument,
            name: insurance.insuranceDocumentName,
            size: 0,
          }
        : undefined,
    };
  }
  return payload;
}

export function toStep2Payload(step2: Step2Data): Record<string, unknown> {
  return {
    allergies: {
      medicineAllergies: {
        selectedValue: upperYesNoDefaultNo(step2.allergicToMedicines),
        inputValue: step2.medicineAllergies,
      },
      foodAllergies: {
        selectedValue: upperYesNoDefaultNo(step2.hasFoodAllergies),
        inputValue: step2.foodAllergies,
      },
      otherAllergies: { selectedValue: "No", inputValue: "" },
    },
    CurrentMedications: {
      medications: {
        selectedValue: upperYesNoDefaultNo(step2.takingMedicines),
        inputValue: step2.medicines.filter(Boolean).join(", "),
      },
      "herbal&ayurvedic": {
        selectedValue: upperYesNoDefaultNo(step2.hasHerbalMedicines),
        inputValue: step2.herbalMedicineDetails,
      },
      otherMedicationsDetails: { selectedValue: "No", inputValue: "" },
    },
  };
}

/** What "Skip now" records for a step (Practice `handleSkip`). */
export function skipPayload(step: 1 | 2 | 3): Record<string, unknown> {
  return step === 2
    ? { allergies: { skipped: true }, CurrentMedications: { skipped: true } }
    : { skipped: true };
}

// ── Validation (Practice validateStepN) ─────────────────────────────────────

export type Errors = Record<string, string | undefined>;

export function validateStep1(s: Step1Data): Errors {
  const e: Errors = {};
  if (s.hasSurgeries === "yes" && !s.surgeryDetails.trim())
    e.surgeryDetails = "Surgery details are required when 'Yes' is selected";
  if (s.hasHospitalizations === "yes" && !s.hospitalizationDetails.trim())
    e.hospitalizationDetails =
      "Hospitalization details are required when 'Yes' is selected";
  return e;
}

export function validateStep2(s: Step2Data): Errors {
  const e: Errors = {};
  if (s.takingMedicines === "yes" && s.medicines.length === 0)
    e.medicines = "At least one medicine is required when 'Yes' is selected";
  if (s.hasHerbalMedicines === "yes" && !s.herbalMedicineDetails.trim())
    e.herbalMedicineDetails =
      "Herbal medicine details are required when 'Yes' is selected";
  if (s.allergicToMedicines === "yes" && !s.medicineAllergies.trim())
    e.medicineAllergies = "Medicine allergies are required when 'Yes' is selected";
  if (s.hasFoodAllergies === "yes" && !s.foodAllergies.trim())
    e.foodAllergies = "Food allergies are required when 'Yes' is selected";
  return e;
}

export function validateStep3(s: Step3Data): Errors {
  const e: Errors = {};
  if (s.hasHealthInsurance === "yes") {
    if (!s.insuranceType)
      e.insuranceType = "Insurance type is required when 'Yes' is selected";
    if (!s.insuranceName.trim())
      e.insuranceName = "Insurance name is required when 'Yes' is selected";
    if (!s.insuranceValidTill)
      e.insuranceValidTill = "Valid till date is required when 'Yes' is selected";
    if (!s.insuranceDocument)
      e.insuranceDocument = "Insurance document is required when 'Yes' is selected";
  }
  return e;
}

export const hasErrors = (e: Errors) => Object.values(e).some(Boolean);
