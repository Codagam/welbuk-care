/**
 * "Vaccines & wellness" chart — Practice `/api/patient/{immunizations,wellness}`
 * (+ `/[id]/verify`) and `/api/patient/screenings`. Mirrors Practice
 * `components/vaccimon/vaccimon-api.ts`.
 */
import { api } from "@/lib/api/client";

export type RecordSource = "CLINIC_RECORDED" | "PARENT_REPORTED" | "OCR_IMPORTED";
export type RecordVerification = "UNVERIFIED" | "CLINIC_VERIFIED";

export const SOURCE_LABEL: Record<RecordSource, string> = {
  CLINIC_RECORDED: "Clinic",
  PARENT_REPORTED: "Parent-reported",
  OCR_IMPORTED: "Scanned card",
};

export type ImmunizationRow = {
  id: string;
  vaccineCode: string;
  vaccineName: string;
  doseLabel: string | null;
  givenOn: string;
  productName: string | null;
  lotNumber: string | null;
  givenAtName: string | null;
  notes: string | null;
  source: RecordSource;
  verification: RecordVerification;
  verifiedAt: string | null;
  ownedByThisClinic: boolean;
};

export type WellnessRow = {
  id: string;
  measuredOn: string;
  weightKg: number | null;
  heightCm: number | null;
  lengthPosition: string | null;
  headCircumferenceCm: number | null;
  notes: string | null;
  source: RecordSource;
  verification: RecordVerification;
  verifiedAt: string | null;
  ownedByThisClinic: boolean;
};

type ListMeta = {
  hiddenFromOtherClinics: number;
  canVerify: boolean;
  patientMongoId: string;
};
export type ImmunizationList = ListMeta & { records: ImmunizationRow[] };
export type WellnessList = ListMeta & { measurements: WellnessRow[] };

export type ScreeningList = {
  screenings: {
    id: string;
    testKey: string;
    side: string | null;
    result: string;
    value: string | null;
    notes: string | null;
    testedOn: string;
  }[];
  hiddenFromOtherClinics: number;
};

export type ChartKind = "immunizations" | "wellness";

export const vaccimonKeys = {
  immunizations: (patientId: string, facilityId: string) => [
    "vaccimon",
    "immunizations",
    patientId,
    facilityId,
  ],
  wellness: (patientId: string, facilityId: string) => [
    "vaccimon",
    "wellness",
    patientId,
    facilityId,
  ],
  screenings: (patientId: string, facilityId: string) => [
    "vaccimon",
    "screenings",
    patientId,
    facilityId,
  ],
};

export function fetchChart<T>(
  kind: ChartKind | "screenings",
  patientId: string,
  facilityId: string
): Promise<T> {
  return api<T>({ path: `/api/patient/${kind}`, query: { patientId, facilityId } });
}

export function addChartRows(
  kind: ChartKind,
  body: { patientId: string; facilityId: string; rows: unknown[] }
): Promise<{ created: number }> {
  return api({ path: `/api/patient/${kind}`, method: "POST", body });
}

export function verifyChartRow(
  kind: ChartKind,
  id: string,
  patientId: string,
  facilityId: string
): Promise<unknown> {
  return api({
    path: `/api/patient/${kind}/${encodeURIComponent(id)}/verify`,
    method: "POST",
    body: { patientId, facilityId },
  });
}

export function removeChartRow(
  kind: ChartKind,
  id: string,
  patientId: string,
  facilityId: string,
  reason: string
): Promise<unknown> {
  return api({
    path: `/api/patient/${kind}`,
    method: "DELETE",
    query: { id, patientId, facilityId },
    body: { reason },
  });
}

/** "YYYY-MM-DD" in the device's day, for date fields. */
export function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
