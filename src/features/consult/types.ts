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

export interface PatientHistory {
  medicalHistory?: unknown;
  medications?: unknown[];
  allergies?: unknown[];
  labReports?: unknown[];
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

export interface Recording {
  id: string;
  kind: "AUDIO" | "DOCUMENT" | "IMAGE";
  url: string;
  mimeType?: string | null;
  durationSec?: number | null;
  note?: string | null;
  createdAt: string;
}
