export interface Vitals {
  height?: string | null;
  weight?: string | null;
  bloodPressure?: string | null;
  spO2?: string | null;
  temperature?: string | null;
  bloodSugar?: string | null;
  recordedAt?: string | null;
}

export interface DiagnosisCode {
  code: string;
  label?: string | null;
  system?: string | null;
  isPrimary?: boolean;
}

export interface ConsultSummary {
  summary?: string | null;
  isAIGenerated?: boolean;
  doctorNotes?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  diagnosisCodes?: DiagnosisCode[];
  followUp?: string | null;
  prescriptionAttachmentUrls?: string[];
  reportAttachmentUrls?: string[];
}

export interface Prescription {
  id: string;
  name: string;
  dosePattern?: string | null;
  foodTiming?: string | null;
  duration?: string | number | null;
  qtyPrescribed?: number | null;
  isAttachment?: boolean;
}

export interface PrescriptionItemInput {
  name: string;
  dosePattern: string;
  foodTiming: string; // "BF" | "AF"
  duration: string | number;
  qtyPrescribed?: number;
  drugId?: string;
}

export interface MedicalCondition {
  name: string;
  since?: string;
}

export interface MedicationRecord {
  name: string;
  dosage?: string;
}

export interface AllergyRecord {
  name: string;
  severity?: string;
}

export interface LabReportPayload {
  labReportAttachmentUrls?: string[];
  reportImageUrls?: string[];
  reportNote?: string;
  radiologyReport?: string;
  results?: unknown;
  reportGeneratedAt?: string;
  patientName?: string;
}

export interface LabReportItem {
  id?: string;
  date?: string;
  test?: string;
  result?: string;
  status?: string;
  source?: "upload" | "referral" | "visit";
  facilityLabel?: string;
  referralType?: string;
  canDelete?: boolean;
  reportPayload?: LabReportPayload;
}

export interface DoctorNote {
  date: string;
  doctor: string;
  note: string;
}

export interface PatientHistory {
  patient?: {
    height?: string | null;
    weight?: string | null;
    bloodPressure?: string | null;
    spO2?: string | null;
    temperature?: string | null;
    bloodSugar?: string | null;
    [key: string]: unknown;
  } | null;
  medicalHistory?: MedicalCondition[] | unknown;
  medications?: MedicationRecord[] | unknown[];
  allergies?: AllergyRecord[] | unknown[];
  labReports?: LabReportItem[];
  doctorNotes?: DoctorNote[];
  /** Legacy field some clients used; prefer doctorNotes */
  previousNotes?: PreviousNote[];
}

export interface PreviousNote {
  consultationId?: string;
  date?: string;
  summary?: string | null;
  assessment?: string | null;
  plan?: string | null;
  doctorName?: string | null;
  diagnosisCodes?: DiagnosisCode[];
}

export interface ConversationMessage {
  id: string;
  speaker: "doctor" | "patient" | string;
  text: string;
  timestamp: string;
}

export interface Recording {
  id: string;
  kind: "AUDIO" | "DOCUMENT" | "IMAGE";
  url: string;
  mimeType?: string | null;
  durationSec?: number | null;
  note?: string | null;
  createdAt: string;
}
