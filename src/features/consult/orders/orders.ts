/**
 * Orders & referrals — mirrors Practice `lib/consult/orders.ts` (read-only
 * reference; Care never changes Practice). Keep the two in step: the kinds,
 * priorities, wards and the duplicate rule must match what the server accepts.
 *
 * One tab per kind of order. Lines print on the prescription as soon as they
 * are added. A tab with a destination can be sent now; anything not sent goes
 * out when the consult is completed. "Print only" is never sent: the paper is
 * the order. Day care is done in the clinic and goes on the bill — it is never
 * a referral.
 */

export const ORDER_KINDS = [
  "LAB",
  "SCAN",
  "XRAY",
  "SPECIALIST",
  "ADMISSION",
  "DAYCARE",
] as const;
export type OrderKind = (typeof ORDER_KINDS)[number];

export const ORDER_KIND_META: Record<
  OrderKind,
  { label: string; referralType: string | null; itemNoun: string }
> = {
  LAB: { label: "Lab", referralType: "Lab", itemNoun: "test" },
  SCAN: { label: "Scan", referralType: "Scan", itemNoun: "scan" },
  XRAY: { label: "X-Ray", referralType: "X-Ray", itemNoun: "X-ray" },
  SPECIALIST: {
    label: "Specialist",
    referralType: "Specialist",
    itemNoun: "specialty",
  },
  ADMISSION: {
    label: "Admission",
    referralType: "Admission",
    itemNoun: "admission",
  },
  DAYCARE: { label: "Day care", referralType: null, itemNoun: "procedure" },
};

export const ORDER_PRIORITIES = ["Routine", "Urgent", "STAT"] as const;
export type OrderPriority = (typeof ORDER_PRIORITIES)[number];

export const ADMISSION_WARDS = [
  "General",
  "Semi-private",
  "Private",
  "ICU",
] as const;
export type AdmissionWard = (typeof ADMISSION_WARDS)[number];

export type OrderDraft = {
  /** Null = print only: the patient takes the paper wherever they like. */
  destinationFacilityId: string | null;
  priority: OrderPriority;
  note: string;
  toDoctorId: string | null;
  toDoctorName: string | null;
  /** Admission only. */
  ward: AdmissionWard | null;
  expectedStayDays: number | null;
};

/** Practice `TESTS_BY_TYPE` (lib/referral/referral-constants.ts). */
const CATALOGUE: Partial<Record<OrderKind, readonly string[]>> = {
  LAB: [
    "Complete Blood Count (CBC)",
    "Basic/Comprehensive Metabolic Panel",
    "Lipid Panel",
    "Thyroid Function (TSH/T3/T4)",
    "HbA1c",
    "Liver/Renal Function",
    "Urine Analysis",
    "Blood Culture",
    "ESR/CRP",
    "PT/INR",
    "Serum Electrolytes",
    "Fasting Blood Sugar",
    "HIV Screening",
    "Hepatitis B/C Panel",
    "Vitamin D/B12",
    "Iron Studies",
    "Tumor Markers",
  ],
  SCAN: [
    "Ultrasound (Abdomen, Pelvis, Thyroid)",
    "CT (Brain, Chest, Abdomen & Pelvis, Spine)",
    "MRI (Brain, Spine, Knee/Shoulder, Abdomen)",
    "PET Scan",
    "DEXA Scan",
    "Echocardiogram",
    "2D Echo with Doppler",
    "Doppler (Carotid, Peripheral)",
  ],
  XRAY: [
    "Chest X-Ray (PA/AP)",
    "Skull",
    "Cervical/Thoracic/Lumbar Spine",
    "Pelvis",
    "Hip",
    "Knee",
    "Ankle/Foot",
    "Wrist/Hand",
    "Shoulder",
    "Elbow",
    "Abdomen (Erect)",
    "KUB",
  ],
  SPECIALIST: [
    "Cardiology",
    "Orthopedics",
    "Neurology",
    "Dermatology",
    "Ophthalmology",
    "ENT",
    "Gastroenterology",
    "Psychiatry",
    "Pulmonology",
    "Endocrinology",
    "Urology",
    "Gynecology & Obstetrics",
    "Oncology",
    "Nephrology",
    "Rheumatology",
    "Hematology",
    "Infectious Disease",
    "Plastic Surgery",
    "Vascular Surgery",
    "General Surgery",
  ],
};

/** Standard names a tab suggests after the clinic's rate-card services. */
export function catalogueFor(kind: OrderKind): readonly string[] {
  return CATALOGUE[kind] ?? [];
}

/** Same name within a tab, ignoring case and spacing (the server's duplicate rule). */
export function sameOrderLine(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return norm(a) === norm(b);
}

export const REFERRAL_STATUS_LABEL: Record<string, string> = {
  pending: "Sent",
  referral_received: "Received",
  registered: "Accepted",
  sample_collected: "Sample taken",
  processing: "Processing",
  results_ready: "Results ready",
  report_generated: "Report ready",
  delivered: "Report delivered",
  acknowledged: "Reviewed",
  scheduled: "Scheduled",
  arranged: "Bed arranged",
  admitted: "Admitted",
  completed: "Completed",
  cancelled: "Declined / cancelled",
};

export function formatOrderRupees(value: number): string {
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatOrderDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
