import { api } from "@/lib/api/client";
import type {
  DentalData,
  TeethStates,
  TreatmentPlanItem,
} from "@/features/dental/types";

export function getDental(consultationId: string): Promise<DentalData> {
  return api({ path: "/api/consult/dental", query: { consultationId } });
}

/** Full overwrite of the dental exam (teeth chart) — PUT is the draft/save path. */
export function saveDentalExam(
  consultationId: string,
  payload: {
    teethStates: TeethStates;
    treatmentEntries?: unknown[];
    treatmentOrder?: string[];
  }
): Promise<unknown> {
  return api({
    path: "/api/consult/dental",
    method: "PUT",
    body: { consultationId, ...payload },
  });
}

/** Persist the treatment plan (+ trigger invoice/billing sync) via PATCH. */
export function saveDentalPlan(
  consultationId: string,
  treatmentPlanItems: TreatmentPlanItem[]
): Promise<{
  dental: unknown;
  billingSync?: { ok: boolean; doneTotalRupees?: number; error?: string };
}> {
  return api({
    path: "/api/consult/dental",
    method: "PATCH",
    body: { consultationId, treatmentPlanItems },
  });
}
