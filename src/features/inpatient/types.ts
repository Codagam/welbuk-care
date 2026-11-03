export type InpatientAdmissionStatus = "ADMITTED" | "DISCHARGED" | string;

export type InpatientAdmission = {
  id: string;
  ipSerial?: number | null;
  patientId?: string;
  doctorId?: string;
  roomId?: string;
  admitDate: string;
  dischargeDate?: string | null;
  diagnosis: string;
  /** Discharge remarks that print on the bill — not the ward notes timeline. */
  notes?: string | null;
  ward?: string | null;
  status: InpatientAdmissionStatus;
  attenderName?: string | null;
  attenderPhone?: string | null;
  attenderRelation?: string | null;
  nurseStationId?: string | null;
  dutyNurseUserId?: string | null;
  patient: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    patientId?: number | null;
    phone?: string | null;
    facilities?: Array<{ facilityId: string; mrdNumber?: string | null }>;
  };
  doctor: {
    id: string;
    doctorId?: number | null;
    name?: string | null;
    specialization?: string | null;
  };
  room: {
    id: string;
    displayName: string;
    roomType: string;
    roomNumber?: string | null;
    ratePerDay?: number;
    features?: string[] | null;
    floor: number;
    beds: number;
    available: boolean;
    rateCardItem?: {
      rate?: number | null;
      unit?: string | null;
      categoryId?: string | null;
      name?: string | null;
    } | null;
  };
  bills?: Array<{ id: string }>;
};

export type InpatientRoom = {
  id: string;
  displayName: string;
  roomNumber: string;
  roomType: string;
  floor: number;
  beds: number;
  available: boolean;
  ratePerDay?: number;
};

export type WardVitalFieldKey =
  | "bloodPressure"
  | "pulse"
  | "temperature"
  | "spO2"
  | "respiratoryRate"
  | "bloodSugar"
  | "painScore";

export type InpatientVitals = {
  id: string;
  recordedAt: string;
  recordedById?: string | null;
  recordedBy: string | null;
  notes: string | null;
  height?: string | null;
  weight?: string | null;
  bloodPressure?: string | null;
  pulse?: string | null;
  temperature?: string | null;
  spO2?: string | null;
  respiratoryRate?: string | null;
  bloodSugar?: string | null;
  painScore?: string | null;
};

export type NoteKind = "PROGRESS" | "INSTRUCTION" | "HANDOVER";

export type InpatientNote = {
  id: string;
  kind: string;
  body: string;
  notedAt: string;
  authorId?: string;
  author: string;
  editedAt: string | null;
  supersededBody: string | null;
};

export type MedAdministration = {
  id: string;
  drugId: string;
  drugName: string;
  batchId?: string | null;
  quantity: number;
  route: string | null;
  notes: string | null;
  matchedOrder: boolean;
  administeredAt: string;
  administeredById?: string;
  administeredBy: string;
};

export type MedReconciliation = {
  drugId: string;
  drugName: string;
  dispensed: number;
  administered: number;
  settled: number;
  unaccounted: number;
};

export type MatchingOrder = {
  prescriptionId: string;
  name: string | null;
  dosePattern: string | null;
  qtyPrescribed: number;
  qtyDispensed: number;
  matchedBy: "exact" | "name";
};

export type RecordDoseResult = {
  ok: true;
  id: string;
  administeredAt?: string;
  matchedOrder: boolean;
  candidateOrders?: MatchingOrder[];
};

export type AccountMedResult = {
  ok: true;
  holdId?: string;
  status: "AWAITING_REVIEW" | "RECORDED" | string;
};

export type PageWho = "DOCTOR" | "NURSE";

export type PageStaffResult = {
  ok: true;
  notifiedUserCount: number;
  pushedToDevices: number;
  fellBackToFacility: boolean;
  stationName: string | null;
};

export type AuditEditor = {
  section: string;
  changedAt: string;
  changedById: string;
  changedBy: string | null;
};

export type InpatientAudit = {
  editors: Record<string, AuditEditor>;
};

export type InpatientListRow = {
  id: string;
  ipSerial: number | null;
  patientName: string;
  patientCode: string;
  patientNumberId: number | null;
  roomLabel: string;
  roomType: string;
  roomNumber: string;
  admitDateLabel: string;
  days: number;
  doctorShort: string;
  diagnosis: string;
  running: number;
  statusKey: "admitted" | "discharged";
};

/** Wire shape for IP bill line items (client-computed totals). */
export type BillItem = {
  id: string;
  serviceId: string;
  catId: string;
  name: string;
  qty: number;
  rate: number;
  discountPct: number;
  taxRate: number;
  lineTotal: number;
  taxAmt: number;
};

export type BillTotals = {
  subtotal: number;
  overallDisc: number;
  totalTax: number;
  grossTotal: number;
  insuranceClaim: number;
  coPayAmt: number;
  patientPayable: number;
};

export type InpatientBill = {
  id: string;
  admissionId: string;
  status: "DRAFT" | "FINAL" | string;
  items: BillItem[];
  notes?: string | null;
  discountPct?: number;
  insuranceId?: string | null;
  customCoverage?: number | null;
  totals?: BillTotals | Record<string, unknown> | null;
};

export type RateCardItem = {
  id: string;
  facilityId?: string;
  categoryId: string | null;
  name: string;
  unit: string;
  rate: number;
};

export type BillStatusQuery = "draft" | "final";

/** Merged rate-card + drug row for the IP service search dropdown. */
export type PickableService = {
  id: string;
  catId: string;
  name: string;
  rate: number;
  unit: string;
  taxRate: number;
  source: "rate-card" | "drug";
};