import { api } from "@/lib/api/client";
import type {
  BillItem,
  BillStatusQuery,
  BillTotals,
  InpatientAdmission,
  InpatientBill,
  RateCardItem,
} from "@/features/inpatient/types";

/** GET /api/inpatient/admissions?facilityId= */
export async function listInpatientAdmissions(
  facilityId: string,
  signal?: AbortSignal
): Promise<InpatientAdmission[]> {
  const data = await api<{ admissions: InpatientAdmission[] }>({
    path: "/api/inpatient/admissions",
    query: { facilityId },
    signal,
  });
  return data.admissions ?? [];
}

/** GET /api/inpatient/admissions/[id]?facilityId= — id may be ipSerial or Mongo id. */
export async function getInpatientAdmission(
  admissionId: string,
  facilityId: string,
  signal?: AbortSignal
): Promise<InpatientAdmission> {
  const data = await api<{ admission: InpatientAdmission }>({
    path: `/api/inpatient/admissions/${encodeURIComponent(admissionId)}`,
    query: { facilityId },
    signal,
  });
  return data.admission;
}

/** GET /api/inpatient/admissions/[id]/bill?facilityId=&status= */
export async function getInpatientBill(
  admissionId: string,
  facilityId: string,
  status: BillStatusQuery,
  signal?: AbortSignal
): Promise<InpatientBill | null> {
  const data = await api<{ bill: InpatientBill | null }>({
    path: `/api/inpatient/admissions/${encodeURIComponent(admissionId)}/bill`,
    query: { facilityId, status },
    signal,
  });
  return data.bill ?? null;
}

export type PutInpatientBillInput = {
  facilityId: string;
  status: BillStatusQuery;
  items: BillItem[];
  notes?: string;
  discountPct?: number;
  totals?: BillTotals;
};

export type PutInpatientBillResult = {
  bill: InpatientBill;
  ledgerInvoiceId?: string;
  pharmacyLedgerInvoiceId?: string;
};

/** PUT /api/inpatient/admissions/[id]/bill */
export function putInpatientBill(
  admissionId: string,
  body: PutInpatientBillInput
): Promise<PutInpatientBillResult> {
  return api<PutInpatientBillResult>({
    path: `/api/inpatient/admissions/${encodeURIComponent(admissionId)}/bill`,
    method: "PUT",
    body,
  });
}

/** PUT /api/inpatient/admissions/[id] — e.g. discharge. */
export async function updateInpatientAdmission(
  admissionId: string,
  body: {
    facilityId: string;
    status?: string;
    dischargeDate?: string;
    diagnosis?: string;
    notes?: string;
    ward?: string;
  }
): Promise<InpatientAdmission> {
  const data = await api<{ admission: InpatientAdmission }>({
    path: `/api/inpatient/admissions/${encodeURIComponent(admissionId)}`,
    method: "PUT",
    body,
  });
  return data.admission;
}

/** GET /api/inpatient/rate-card?facilityId= */
export async function listInpatientRateCard(
  facilityId: string,
  signal?: AbortSignal
): Promise<RateCardItem[]> {
  const data = await api<{ items: RateCardItem[] }>({
    path: "/api/inpatient/rate-card",
    query: { facilityId },
    signal,
  });
  return data.items ?? [];
}
