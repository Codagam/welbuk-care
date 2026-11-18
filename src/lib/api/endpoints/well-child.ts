import { api } from "@/lib/api/client";

/** Practice `/api/consult/well-child` (docs/MOTHER_AND_CHILD_PLAN.md §2). */

export type WellChildMeasurement = {
  id: string;
  measuredOn: string;
  weightKg: number | null;
  heightCm: number | null;
  lengthPosition: string | null;
  headCircumferenceCm: number | null;
  muacCm: number | null;
};

export type WellChildScreening = {
  id: string;
  testKey: string;
  side: string | null;
  result: string;
  value: string | null;
  notes?: string | null;
  testedOn: string;
};

export type WellChildData = {
  patient: { dob: string | null; sex: string | null };
  measurement: WellChildMeasurement | null;
  /** Recorded in this consult. */
  screenings: WellChildScreening[];
  /** Earlier results at this clinic, or the family's. */
  history: WellChildScreening[];
  /** Anything recorded in this consult: the section shows itself. */
  hasData: boolean;
};

export type MeasurementInput = {
  weightKg?: string;
  heightCm?: string;
  lengthPosition?: "recumbent" | "standing";
  headCircumferenceCm?: string;
  muacCm?: string;
};

export type ScreeningInput = {
  testKey: string;
  side?: string;
  result: string;
  value?: string;
  notes?: string;
};

export function getWellChild(consultationId: string): Promise<WellChildData> {
  return api({ path: "/api/consult/well-child", query: { consultationId } });
}

/** One measurement per consult: a change replaces it (the old row is kept as history). */
export function saveWellChildMeasurement(
  consultationId: string,
  input: MeasurementInput
): Promise<{ ok: true; id: string }> {
  return api({
    path: "/api/consult/well-child",
    method: "POST",
    body: { consultationId, action: "measurement", ...input },
  });
}

export function addWellChildScreening(
  consultationId: string,
  input: ScreeningInput
): Promise<{ ok: true; id: string }> {
  return api({
    path: "/api/consult/well-child",
    method: "POST",
    body: { consultationId, action: "screening", ...input },
  });
}

/** Soft delete with a reason (at least 3 characters); kept in the history. */
export function removeWellChildScreening(
  consultationId: string,
  screeningId: string,
  reason: string
): Promise<{ ok: true }> {
  return api({
    path: "/api/consult/well-child",
    method: "DELETE",
    body: { consultationId, screeningId, reason },
  });
}
