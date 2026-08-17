import { api } from "@/lib/api/client";
import type {
  AccountMedResult,
  BillItem,
  BillStatusQuery,
  BillTotals,
  InpatientAdmission,
  InpatientBill,
  InpatientNote,
  InpatientRoom,
  InpatientVitals,
  MedAdministration,
  MedReconciliation,
  NoteKind,
  PageStaffResult,
  PageWho,
  RateCardItem,
  RecordDoseResult,
  AuditEditor,
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

/** PUT /api/inpatient/admissions/[id] — e.g. discharge or attender. */
export async function updateInpatientAdmission(
  admissionId: string,
  body: {
    facilityId: string;
    status?: string;
    dischargeDate?: string;
    diagnosis?: string;
    notes?: string;
    ward?: string;
    roomId?: string;
    attenderName?: string | null;
    attenderPhone?: string | null;
    attenderRelation?: string | null;
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

/** GET /api/inpatient/rooms?facilityId= — occupancy KPI. */
export async function listInpatientRooms(
  facilityId: string,
  signal?: AbortSignal
): Promise<InpatientRoom[]> {
  const data = await api<{ rooms: InpatientRoom[] }>({
    path: "/api/inpatient/rooms",
    query: { facilityId },
    signal,
  });
  return data.rooms ?? [];
}

/** GET /api/inpatient/admissions/[id]/audit?facilityId= */
export async function getInpatientAudit(
  admissionId: string,
  facilityId: string,
  signal?: AbortSignal
): Promise<Record<string, AuditEditor>> {
  const data = await api<{ editors?: Record<string, AuditEditor> }>({
    path: `/api/inpatient/admissions/${encodeURIComponent(admissionId)}/audit`,
    query: { facilityId },
    signal,
  });
  return data.editors ?? {};
}

/** GET /api/inpatient/vitals?facilityId=&admissionId= — not OPD /api/patient/vitals. */
export async function listInpatientVitals(
  facilityId: string,
  admissionId: string,
  signal?: AbortSignal
): Promise<InpatientVitals[]> {
  const data = await api<{ vitals: InpatientVitals[] }>({
    path: "/api/inpatient/vitals",
    query: { facilityId, admissionId },
    signal,
  });
  return data.vitals ?? [];
}

export type PostInpatientVitalsInput = {
  facilityId: string;
  admissionId: string;
  notes?: string;
  bloodPressure?: string;
  pulse?: string;
  temperature?: string;
  spO2?: string;
  respiratoryRate?: string;
  bloodSugar?: string;
  painScore?: string;
  height?: string;
  weight?: string;
};

export async function postInpatientVitals(
  body: PostInpatientVitalsInput
): Promise<{ ok: true; id: string }> {
  return api({ path: "/api/inpatient/vitals", method: "POST", body });
}

/** GET /api/inpatient/notes?facilityId=&admissionId= */
export async function listInpatientNotes(
  facilityId: string,
  admissionId: string,
  signal?: AbortSignal
): Promise<InpatientNote[]> {
  const data = await api<{ notes: InpatientNote[] }>({
    path: "/api/inpatient/notes",
    query: { facilityId, admissionId },
    signal,
  });
  return data.notes ?? [];
}

export async function postInpatientNote(body: {
  facilityId: string;
  admissionId: string;
  body: string;
  kind?: NoteKind;
}): Promise<{ ok: true; id: string }> {
  return api({ path: "/api/inpatient/notes", method: "POST", body });
}

/** GET /api/inpatient/medication-administration?facilityId=&admissionId= */
export async function getMedicationChart(
  facilityId: string,
  admissionId: string,
  signal?: AbortSignal
): Promise<{
  administrations: MedAdministration[];
  reconciliation: MedReconciliation[];
}> {
  const data = await api<{
    administrations?: MedAdministration[];
    reconciliation?: MedReconciliation[];
  }>({
    path: "/api/inpatient/medication-administration",
    query: { facilityId, admissionId },
    signal,
  });
  return {
    administrations: data.administrations ?? [],
    reconciliation: data.reconciliation ?? [],
  };
}

export async function postMedicationAdministration(body: {
  facilityId: string;
  admissionId: string;
  drugId: string;
  quantity: number;
  route?: string | null;
  notes?: string | null;
}): Promise<RecordDoseResult> {
  return api({
    path: "/api/inpatient/medication-administration",
    method: "POST",
    body,
  });
}

export async function accountMedication(body: {
  facilityId: string;
  admissionId: string;
  drugId: string;
  quantity: number;
  outcome: "RETURNED" | "CONSUMED";
  notes?: string | null;
}): Promise<AccountMedResult> {
  return api({
    path: "/api/inpatient/medication-administration/account",
    method: "POST",
    body,
  });
}

/**
 * POST /api/inpatient/page — module-only; any facility member may ring.
 * Do not use POST /api/patient/call for ward paging.
 */
export async function pageInpatientStaff(body: {
  facilityId: string;
  admissionId: string;
  who: PageWho;
  reason?: string | null;
  urgent?: boolean;
}): Promise<PageStaffResult> {
  return api({ path: "/api/inpatient/page", method: "POST", body });
}
