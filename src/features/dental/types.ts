export interface ToothState {
  problem: string;
  note?: string;
  priority?: number;
  suggestedTreatment?: string;
  treatmentDate?: string;
}

export type TeethStates = Record<string, ToothState>;

export interface TreatmentProvider {
  doctorId?: string;
  name?: string;
  role?: string;
  fee?: number;
}

/** Matches the Practice `Dental.treatmentPlanItems` JSON row the billing sync reads. */
export interface TreatmentPlanItem {
  id: string;
  treatmentName: string;
  status: "planned" | "in-progress" | "done";
  totalFee?: number;
  providers?: TreatmentProvider[];
  findingSummary?: { tooth?: string };
}

export interface DentalData {
  teethStates: TeethStates;
  treatmentEntries: unknown[];
  treatmentOrder: string[];
  treatmentPlanItems: TreatmentPlanItem[];
  billingPayments: unknown[];
}
