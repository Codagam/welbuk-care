/**
 * Vitals form helpers — mirror Practice `lib/vitals/vitals-format.ts`.
 */

export type VitalsFormState = {
  temperature: string;
  height: string;
  weight: string;
  bloodPressure: string;
  spO2: string;
  bloodSugar: string;
};

export const EMPTY_VITALS_FORM: VitalsFormState = {
  temperature: "",
  height: "",
  weight: "",
  bloodPressure: "",
  spO2: "",
  bloodSugar: "",
};

export const TEMP_F_MIN = 77;
export const TEMP_F_MAX = 113;
const TEMP_MAX_DECIMAL_PLACES = 2;

export function extractNumericValue(value?: string | null): string {
  if (!value) return "";
  return value
    .replace(/\s*(°?\s*c|°?\s*f|°c|°f)\s*$/i, "")
    .replace(/\s*(cm|kg|mmhg|%|mg\s*\/\s*dl)\s*$/i, "")
    .trim();
}

function formatTemperatureInput(n: number): string {
  if (!Number.isFinite(n)) return "";
  const s = n.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

function celsiusToFahrenheitString(c: number): string {
  return formatTemperatureInput((c * 9) / 5 + 32);
}

export function normalizeInitialTemperatureToFahrenheit(
  raw?: string | null
): string {
  if (!raw?.trim()) return "";
  const trimmed = raw.trim();
  const num = parseFloat(extractNumericValue(trimmed));
  if (Number.isNaN(num)) return "";

  const hasExplicitF = /°?\s*f\b/i.test(trimmed);
  const hasExplicitC = /°?\s*c\b/i.test(trimmed);

  if (hasExplicitF) return formatTemperatureInput(num);
  if (hasExplicitC) return celsiusToFahrenheitString(num);
  if (num >= 25 && num <= 45) return celsiusToFahrenheitString(num);
  return formatTemperatureInput(num);
}

export function sanitizeTemperatureFahrenheitInput(raw: string): string {
  if (!raw) return "";
  let cleaned = raw.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  if (cleaned === "" || cleaned === ".") return "";

  const endsWithDot = cleaned.endsWith(".");
  const [intRaw = "", decJoined = ""] = cleaned.split(".");
  const decRaw = decJoined.replace(/\./g, "");

  let intDigits = intRaw.replace(/\D/g, "").slice(0, 3);
  if (intDigits === "") {
    if (firstDot !== -1 && decRaw.replace(/\D/g, "").length > 0) return "";
    if (endsWithDot) return "";
  }
  if (intDigits !== "") {
    const iv = parseInt(intDigits, 10);
    if (!Number.isNaN(iv) && iv > TEMP_F_MAX) intDigits = String(TEMP_F_MAX);
  }

  const decDigits = decRaw.replace(/\D/g, "").slice(0, TEMP_MAX_DECIMAL_PLACES);

  let out: string;
  if (firstDot === -1) out = intDigits;
  else if (decDigits.length > 0) out = `${intDigits}.${decDigits}`;
  else if (endsWithDot) out = `${intDigits}.`;
  else out = intDigits;

  const parseable = out.endsWith(".") ? out.slice(0, -1) : out;
  if (parseable !== "") {
    const n = Number(parseable);
    if (!Number.isNaN(n) && n > TEMP_F_MAX) return String(TEMP_F_MAX);
  }
  return out;
}

function isValidTemperatureFahrenheitForSave(value: string): boolean {
  const t = value.trim();
  if (t === "") return true;
  if (t.endsWith(".")) return false;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return false;
  const n = Number(t);
  if (Number.isNaN(n)) return false;
  return n >= TEMP_F_MIN && n <= TEMP_F_MAX;
}

function formatWithUnit(value: string, unit: string): string {
  if (!value || value.trim() === "") return "";
  return `${value.trim()} ${unit}`;
}

export const sanitizeDecimal = (v: string) => v.replace(/[^\d.]/g, "");
export const sanitizeInteger = (v: string) => v.replace(/\D/g, "");
export const sanitizeBloodPressure = (v: string) => v.replace(/[^0-9/]/g, "");
export const sanitizeBloodSugar = (v: string) =>
  v.replace(/\D/g, "").slice(0, 3);
export const sanitizeTemperature = sanitizeTemperatureFahrenheitInput;

export function initialVitalsToForm(initial?: {
  temperature?: string | null;
  height?: string | null;
  weight?: string | null;
  bloodPressure?: string | null;
  spO2?: string | null;
  bloodSugar?: string | null;
} | null): VitalsFormState {
  if (!initial) return { ...EMPTY_VITALS_FORM };
  return {
    temperature: normalizeInitialTemperatureToFahrenheit(initial.temperature),
    height: extractNumericValue(initial.height),
    weight: extractNumericValue(initial.weight),
    bloodPressure: extractNumericValue(initial.bloodPressure),
    spO2: extractNumericValue(initial.spO2),
    bloodSugar: extractNumericValue(initial.bloodSugar),
  };
}

export function validateVitalsForm(form: VitalsFormState): string | null {
  const tempStr = form.temperature.trim();
  if (tempStr && !isValidTemperatureFahrenheitForSave(form.temperature)) {
    return `Enter a valid temperature (${TEMP_F_MIN}–${TEMP_F_MAX}°F, up to 2 decimal places)`;
  }

  const height = Number(form.height);
  if (form.height && (height < 20 || height > 300)) return "Invalid height value";

  const weight = Number(form.weight);
  if (form.weight && (weight < 1 || weight > 500)) return "Invalid weight value";

  const bp = form.bloodPressure.trim();
  if (bp) {
    if (!/^\d{2,3}\/\d{2,3}$/.test(bp)) {
      return "Enter blood pressure in format like 120/80";
    }
    const [sys, dia] = bp.split("/").map(Number);
    if (sys < 40 || sys > 300 || dia < 30 || dia > 200) {
      return "Invalid blood pressure value";
    }
  }

  const spo2 = Number(form.spO2);
  if (form.spO2 && (spo2 < 0 || spo2 > 100)) return "SpO₂ must be between 0 and 100%";

  const sugarRaw = form.bloodSugar.trim();
  if (sugarRaw) {
    const n = parseInt(sugarRaw, 10);
    if (Number.isNaN(n) || n < 20 || n > 600) {
      return "Blood sugar must be a whole number between 20 and 600 mg/dL";
    }
  }
  return null;
}

export function buildVitalsPayload(form: VitalsFormState): {
  temperature?: string;
  height?: string;
  weight?: string;
  bloodPressure?: string;
  spO2?: string;
  bloodSugar?: string;
} {
  return {
    temperature: form.temperature
      ? formatWithUnit(form.temperature, "°F")
      : undefined,
    height: form.height ? formatWithUnit(form.height, "cm") : undefined,
    weight: form.weight ? formatWithUnit(form.weight, "kg") : undefined,
    bloodPressure: form.bloodPressure
      ? formatWithUnit(form.bloodPressure, "mmHg")
      : undefined,
    spO2: form.spO2 ? formatWithUnit(form.spO2, "%") : undefined,
    bloodSugar: form.bloodSugar
      ? formatWithUnit(form.bloodSugar, "mg/dL")
      : undefined,
  };
}

/** Prefer consult vitals, fall back to history patient demographics. */
export function mergeDisplayVitals(
  consult?: {
    temperature?: string | null;
    height?: string | null;
    weight?: string | null;
    bloodPressure?: string | null;
    spO2?: string | null;
    bloodSugar?: string | null;
  } | null,
  historyPatient?: {
    temperature?: string | null;
    height?: string | null;
    weight?: string | null;
    bloodPressure?: string | null;
    spO2?: string | null;
    bloodSugar?: string | null;
  } | null
) {
  return {
    temperature: consult?.temperature || historyPatient?.temperature || undefined,
    height: consult?.height || historyPatient?.height || undefined,
    weight: consult?.weight || historyPatient?.weight || undefined,
    bloodPressure:
      consult?.bloodPressure || historyPatient?.bloodPressure || undefined,
    spO2: consult?.spO2 || historyPatient?.spO2 || undefined,
    bloodSugar: consult?.bloodSugar || historyPatient?.bloodSugar || undefined,
  };
}
