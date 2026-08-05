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
  notes?: string | null;
  ward?: string | null;
  status: InpatientAdmissionStatus;
  patient: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    patientId?: number | null;
    phone?: string | null;
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
