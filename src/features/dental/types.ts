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
  /** NET (after-discount) rupees per treatment — what gets billed once treated. */
  suggestedTreatmentFees?: Record<string, number>;
  /** ORIGINAL rupees per treatment, before the doctor's discount. */
  suggestedTreatmentFeeBases?: Record<string, number>;
  /**
   * Discount per treatment as a percent, DERIVED from (original − net) and kept
   * UNROUNDED: Practice rebuilds the billed fee as `original × (1 − pct/100)`,
   * so a rounded percent bills paise off. Only present when discounted.
   */
  suggestedTreatmentDiscountPcts?: Record<string, number>;
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
    /** Snapshot of finding treatment fees for billing when treatments are done. */
    suggestedTreatmentFees?: Record<string, number>;
  } | null;
  selectedActuals?: SelectedActualItem[];
  linkedFollowUpAppointmentId?: string;
  /** Copied from the finding by the Practice server merge — original fees. */
  originalFeesByName?: Record<string, number>;
  /** Copied from the finding by the Practice server merge — discount %. */
  discountPctsByName?: Record<string, number>;
  /** Older single-treatment discount %; superseded by `discountPctsByName`. */
  discountPct?: number;
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
  /** Original fee (what the Fees box edits). The discount never overwrites it. */
  feeBase: string;
  /** Net fee = feeBase − discountAmount (read-only in the UI). */
  fee: string;
  /** Discount entered in RUPEES, not percent. "" = no discount. */
  discountAmount: string;
  maxDiscountPercent?: number | null;
};

export type BillingSync = {
  ok: boolean;
  doneTotalRupees?: number;
  invoiceId?: string;
  lineItemId?: string;
  error?: string;
};
