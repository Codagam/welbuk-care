/** Exact Practice dental JSON contracts — do not rename fields. */

export type FindingStatus = "planned" | "in-progress" | "done";
export type PlanStatus = "planned" | "in-progress" | "done";

export type TreatmentProvider = {
  doctorId: string;
  role: string;
  fee: number;
};

/** Finding row — source of truth in `treatmentEntries`. */
export type DiagnosisDetailsEntry = {
  id: string;
  toothId: string; // FDI string "16"
  problem: string;
  note?: string;
  fee?: number;
  suggestedTreatments?: string[];
  suggestedTreatmentFees?: Record<string, number>;
  suggestedTreatmentNextDates?: Record<string, string>;
  nextAppointmentDate?: string;
  nextAppointmentTime?: string;
  nextAppointmentReason?: string;
  treatmentStatus?: FindingStatus;
  treatmentProviders?: TreatmentProvider[];
};

/** Derived chart map — first problem per tooth only. */
export type TeethState = {
  problem: string;
  note: string;
  priority: number;
};

export type TeethStates = Record<string, TeethState>;

/** @deprecated alias — prefer TeethState */
export type ToothState = TeethState;

export type SelectedActualItem = { name: string; date: string };

/** Plan row — source of truth in `treatmentPlanItems`. */
export type DentalTreatmentPlanRow = {
  id: string;
  treatmentName: string;
  treatmentNames?: string[];
  treatmentOther?: string;
  plannedDate?: string;
  plannedTime?: string;
  actualDate?: string;
  plannedTreatment?: string;
  actualTreatment?: string;
  status: PlanStatus;
  providers: TreatmentProvider[];
  totalFee?: number;
  diagnosisEntryId?: string;
  findingSummary?: {
    tooth: string;
    conditionsText: string;
    clinicalNote: string;
    suggestedOptions: string[];
  } | null;
  selectedActuals?: SelectedActualItem[];
  linkedFollowUpAppointmentId?: string;
};

/** @deprecated alias — prefer DentalTreatmentPlanRow */
export type TreatmentPlanItem = DentalTreatmentPlanRow;

export type BillingPayment = {
  id: string;
  amount: number;
  method: string;
  reference?: string;
  date: string;
  paymentType?: "full" | "advance" | "instalment";
};

export type DentalData = {
  dental?: { id?: string; consultationId?: string } | null;
  teethStates: TeethStates;
  treatmentEntries: DiagnosisDetailsEntry[];
  treatmentOrder: string[];
  treatmentPlanItems: DentalTreatmentPlanRow[];
  billingPayments: BillingPayment[];
};

export type DiagnosisOption = {
  value: string;
  label: string;
  fee?: number;
};

export type TreatmentCatalogItem = {
  id: string;
  value?: string;
  name: string;
  specialisation?: string;
  defaultFee?: number;
  maxDiscountPercent?: number | null;
};

/** UI-only suggested treatment row inside findings sheet. */
export type SuggestedTreatmentPlanRow = {
  id: string;
  treatmentName: string;
  date: string;
  feeBase: string;
  fee: string;
  discountPct: string;
  maxDiscountPercent?: number | null;
};

export type BillingSync = {
  ok: boolean;
  doneTotalRupees?: number;
  invoiceId?: string;
  lineItemId?: string;
  error?: string;
};
