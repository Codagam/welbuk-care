import type {
  BillingSync,
  DentalData,
  DentalTreatmentPlanRow,
  DiagnosisOption,
  TeethStates,
  TreatmentCatalogItem,
} from "@/features/dental/types";
import {
  mapRawToDiagnosisEntries,
  mapRawToPlanRows,
} from "@/features/dental/utils";
import { api } from "@/lib/api/client";

type RawDentalResponse = {
  dental?: DentalData["dental"];
  teethStates?: unknown;
  treatmentEntries?: unknown;
  treatmentOrder?: unknown;
  treatmentPlanItems?: unknown;
  billingPayments?: unknown;
};

function normalizeDental(raw: RawDentalResponse): DentalData {
  const entries = Array.isArray(raw.treatmentEntries)
    ? mapRawToDiagnosisEntries(raw.treatmentEntries)
    : [];
  const plan = Array.isArray(raw.treatmentPlanItems)
    ? mapRawToPlanRows(raw.treatmentPlanItems)
    : [];
  const teethStates =
    raw.teethStates &&
    typeof raw.teethStates === "object" &&
    !Array.isArray(raw.teethStates)
      ? (raw.teethStates as TeethStates)
      : {};
  return {
    dental: raw.dental ?? null,
    teethStates,
    treatmentEntries: entries,
    treatmentOrder: Array.isArray(raw.treatmentOrder)
      ? raw.treatmentOrder.filter((t): t is string => typeof t === "string")
      : [],
    treatmentPlanItems: plan,
    billingPayments: Array.isArray(raw.billingPayments)
      ? (raw.billingPayments as DentalData["billingPayments"])
      : [],
  };
}

export function getDental(consultationId: string): Promise<DentalData> {
  return api<RawDentalResponse>({
    path: "/api/consult/dental",
    query: { consultationId },
  }).then(normalizeDental);
}

/** First save / findings save by appointment — preserves existing plan if omitted. */
export function postDentalFindings(body: {
  appointmentId: string;
  teethStates: TeethStates;
  treatmentOrder: string[];
  treatmentEntries: unknown[];
  nextAppointments?: unknown[];
}): Promise<{ consultation?: unknown; dental?: unknown }> {
  return api({
    path: "/api/consult/dental",
    method: "POST",
    body: { nextAppointments: [], ...body },
  });
}

/** Full overwrite (autosave / flush). Always send current plan. */
export function putDentalFull(body: {
  consultationId: string;
  teethStates: TeethStates;
  treatmentOrder: string[];
  treatmentEntries: unknown[];
  treatmentPlanItems: DentalTreatmentPlanRow[];
  nextAppointments?: unknown[];
}): Promise<{ dental?: unknown }> {
  return api({
    path: "/api/consult/dental",
    method: "PUT",
    body: { nextAppointments: [], ...body },
  });
}

/** Plan-only save + billing sync. */
export function patchDentalPlan(
  consultationId: string,
  treatmentPlanItems: DentalTreatmentPlanRow[]
): Promise<{ dental?: unknown; billingSync?: BillingSync }> {
  return api({
    path: "/api/consult/dental",
    method: "PATCH",
    body: { consultationId, treatmentPlanItems },
  });
}

export function getDiagnosisTypes(
  consultationType = "dental",
  opts?: { search?: string; page?: number; pageSize?: number }
): Promise<{ diagnosisTypes: DiagnosisOption[]; hasMore: boolean }> {
  return api<{ diagnosisTypes?: DiagnosisOption[]; hasMore?: boolean }>({
    path: "/api/consult/diagnosis-types",
    query: {
      consultationType,
      search: opts?.search ?? "",
      page: opts?.page ?? 1,
      pageSize: opts?.pageSize ?? 80,
    },
  }).then((data) => ({
    diagnosisTypes: Array.isArray(data.diagnosisTypes)
      ? data.diagnosisTypes
      : [],
    hasMore: data.hasMore === true,
  }));
}

/** Paginate diagnosis-types the same way Practice autocomplete does. */
export async function fetchAllDiagnosisTypes(
  search: string,
  consultationType = "dental"
): Promise<DiagnosisOption[]> {
  const acc: DiagnosisOption[] = [];
  let page = 1;
  const pageSize = 80;
  let hasMore = true;
  const maxPages = 15;
  while (hasMore && page <= maxPages) {
    const data = await getDiagnosisTypes(consultationType, {
      search,
      page,
      pageSize,
    });
    acc.push(...data.diagnosisTypes);
    hasMore = data.hasMore && data.diagnosisTypes.length > 0;
    page += 1;
  }
  return acc;
}

export type FacilityDoctor = {
  id: string;
  name: string;
  doctorId?: number;
  specialization?: string;
  isDefault?: boolean;
};

export function getFacilityDoctors(
  facilityId: string
): Promise<FacilityDoctor[]> {
  return api<{ doctors?: FacilityDoctor[] }>({
    path: "/api/facility/doctors",
    query: { facilityId, pageSize: 100, page: 1 },
  }).then((data) => {
    const list = Array.isArray(data.doctors) ? data.doctors : [];
    return list.map((x) => ({
      id: String(x.id ?? ""),
      name: String(x.name ?? "").trim() || "Doctor",
      doctorId: typeof x.doctorId === "number" ? x.doctorId : undefined,
      specialization:
        typeof x.specialization === "string" ? x.specialization : undefined,
      isDefault: x.isDefault === true,
    }));
  });
}

export function getFacilityTreatments(
  facilityId: string
): Promise<TreatmentCatalogItem[]> {
  return api<{ items?: TreatmentCatalogItem[] }>({
    path: "/api/facility/treatments",
    query: { facilityId },
  }).then((data) => (Array.isArray(data.items) ? data.items : []));
}
