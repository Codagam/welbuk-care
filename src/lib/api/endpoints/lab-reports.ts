import { api } from "@/lib/api/client";
import type { LabReportPayload } from "@/features/consult/types";

export interface PatientLabReport {
  id: string;
  patientId?: string;
  date?: string | Date | null;
  test?: string | null;
  status?: string | null;
  notes?: string | null;
  /** Legacy; Practice no longer sends it. Files are in `reportPayload`. */
  fileUrl?: string | null;
  /** Display summary only — empty, a file NAME, or note text. Never a URL. */
  result?: string | null;
  source?: "upload" | "referral" | "visit";
  facilityLabel?: string;
  reportPayload?: LabReportPayload | null;
  createdAt?: string | Date | null;
  [key: string]: unknown;
}

/** GET /api/patient/lab-reports — patientId must be Mongo id. */
export async function listPatientLabReports(params: {
  patientId: string;
  facilityId?: string;
}): Promise<PatientLabReport[]> {
  const res = await api<{ labReports?: PatientLabReport[] }>({
    path: "/api/patient/lab-reports",
    query: {
      patientId: params.patientId,
      ...(params.facilityId ? { facilityId: params.facilityId } : {}),
    },
  });
  return Array.isArray(res.labReports) ? res.labReports : [];
}

export {
  createPatientLabReport,
  deletePatientLabReport,
} from "./consult-data";
