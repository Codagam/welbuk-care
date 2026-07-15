import { api } from "@/lib/api/client";
import type {
  ConsultSummary,
  ConversationMessage,
  DiagnosisCode,
  PatientHistory,
  Vitals,
} from "@/features/consult/types";

// ---- Vitals -------------------------------------------------------------

export async function getVitals(consultationId: string): Promise<Vitals> {
  const res = await api<{ vitals: Vitals }>({
    path: `/api/consult/${consultationId}/vitals`,
  });
  return res.vitals ?? {};
}

export function saveVitals(
  consultationId: string,
  vitals: Partial<Vitals>
): Promise<{ vitals: Vitals }> {
  return api({
    path: `/api/consult/${consultationId}/vitals`,
    method: "PATCH",
    body: vitals,
  });
}

// ---- SOAP summary -------------------------------------------------------

export function getSummary(consultationId: string): Promise<ConsultSummary> {
  return api({ path: "/api/consult/summary", query: { consultationId } });
}

export function saveSummary(
  consultationId: string,
  summary: Partial<ConsultSummary>
): Promise<ConsultSummary> {
  return api({
    path: "/api/consult/summary",
    method: "POST",
    body: { consultationId, ...summary },
  });
}

// ---- ICD-10 diagnosis search -------------------------------------------

export async function searchDiagnosisCodes(
  q: string,
  signal?: AbortSignal
): Promise<DiagnosisCode[]> {
  const res = await api<{ codes: DiagnosisCode[] }>({
    path: "/api/consult/diagnosis-codes",
    query: { q, limit: 20 },
    signal,
  });
  return res.codes ?? [];
}

// ---- Prescriptions ------------------------------------------------------

export {
  getPrescriptions,
  finalizePrescription,
  patchPrescriptionAttachmentUrls,
  validateConsultPrescription,
  getPrescriptionTemplates,
  createPrescriptionTemplate,
  updatePrescriptionTemplate,
} from "./prescription";

export function addPrescriptionLine(body: {
  consultationId: string;
  appointmentId?: string;
  name: string;
  dosePattern: string;
  foodTiming: string;
  duration: string | number;
  qtyPrescribed?: number;
}): Promise<unknown> {
  return api({ path: "/api/consult/prescription", method: "POST", body });
}

export function deletePrescriptionLine(id: string): Promise<unknown> {
  return api({ path: "/api/consult/prescription", method: "DELETE", query: { id } });
}

// ---- Patient history ----------------------------------------------------

export function getPatientHistory(params: {
  patientId: string;
  facilityId: string;
  consultationId?: string;
}): Promise<PatientHistory> {
  return api({ path: "/api/consult/patient-history", query: params });
}

// ---- Live conversation --------------------------------------------------

export async function getConversation(
  consultationId: string
): Promise<ConversationMessage[]> {
  const res = await api<{ messages?: ConversationMessage[] }>({
    path: "/api/consult/conversation",
    query: { consultationId },
  });
  return res.messages ?? [];
}

// ---- Visit report attachments -------------------------------------------

/**
 * PATCH /api/consult/report/attachments
 * Persists visit Documents URLs on the consultation (does NOT upload files).
 * Body: { consultationId: string, attachmentUrls: string[] } — full list required.
 * Auth: Authorization: Bearer <staff JWT>
 */
export async function patchReportAttachmentUrls(
  consultationId: string,
  attachmentUrls: string[]
): Promise<{ attachmentUrls: string[] }> {
  if (!consultationId?.trim()) {
    throw new Error("consultationId is required");
  }
  if (!Array.isArray(attachmentUrls)) {
    throw new Error("attachmentUrls must be an array");
  }

  const body = {
    consultationId: consultationId.trim(),
    attachmentUrls: attachmentUrls.filter(
      (u): u is string => typeof u === "string" && u.trim().length > 0
    ),
  };

  console.log("[PATCH /api/consult/report/attachments] request body", body);

  try {
    const res = await api<{ attachmentUrls?: string[] }>({
      path: "/api/consult/report/attachments",
      method: "PATCH",
      body,
    });
    console.log("[PATCH /api/consult/report/attachments] 200 response", res);
    return {
      attachmentUrls: Array.isArray(res?.attachmentUrls)
        ? res.attachmentUrls
        : body.attachmentUrls,
    };
  } catch (err) {
    console.log("[PATCH /api/consult/report/attachments] failed", {
      message: err instanceof Error ? err.message : String(err),
      status:
        err && typeof err === "object" && "status" in err
          ? (err as { status: unknown }).status
          : undefined,
      code:
        err && typeof err === "object" && "code" in err
          ? (err as { code: unknown }).code
          : undefined,
      data:
        err && typeof err === "object" && "data" in err
          ? (err as { data: unknown }).data
          : undefined,
    });
    throw err;
  }
}

// ---- Lab reports --------------------------------------------------------

export function deletePatientLabReport(params: {
  facilityId?: string;
  id?: string;
  fileUrl?: string;
  patientId?: string;
  consultationId?: string;
}): Promise<unknown> {
  const { facilityId, ...body } = params;
  return api({
    path: "/api/patient/lab-reports",
    method: "DELETE",
    query: facilityId ? { facilityId } : undefined,
    body,
  });
}

export function createPatientLabReport(
  facilityId: string,
  body: FormData
): Promise<unknown> {
  return api({
    path: "/api/patient/lab-reports",
    method: "POST",
    query: { facilityId },
    body,
  });
}
