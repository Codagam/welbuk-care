import { api } from "@/lib/api/client";
import type {
  Prescription,
  PrescriptionItemInput,
} from "@/features/consult/types";

export async function getPrescriptions(
  consultationId: string
): Promise<{
  prescriptions: Prescription[];
  prescriptionAttachmentUrls: string[];
}> {
  const res = await api<{
    prescriptions?: Prescription[];
    prescriptionAttachmentUrls?: string[];
  }>({ path: "/api/consult/prescription", query: { consultationId } });
  return {
    prescriptions: res.prescriptions ?? [],
    prescriptionAttachmentUrls: res.prescriptionAttachmentUrls ?? [],
  };
}

export function finalizePrescription(body: {
  consultationId: string;
  appointmentId?: string;
  patientId?: string;
  prescriptions: PrescriptionItemInput[];
  attachmentUrls?: string[];
}): Promise<{ consultationNumber?: string; prescriptions?: Prescription[] }> {
  return api({
    path: "/api/consult/prescription/finalize",
    method: "POST",
    body,
  });
}

/** Persist composer list without issuing (Practice Save Draft). */
export function savePrescriptionDraftApi(body: {
  consultationId: string;
  appointmentId?: string;
  patientId?: string;
  prescriptions: PrescriptionItemInput[];
}): Promise<{ prescriptions?: Prescription[] }> {
  return api({
    path: "/api/consult/prescription/draft",
    method: "PUT",
    body,
  });
}

export function patchPrescriptionAttachmentUrls(
  consultationId: string,
  attachmentUrls: string[]
): Promise<{ attachmentUrls: string[] }> {
  return api({
    path: "/api/consult/prescription/attachments",
    method: "PATCH",
    body: {
      consultationId: consultationId.trim(),
      attachmentUrls: attachmentUrls.filter(
        (u): u is string => typeof u === "string" && u.trim().length > 0
      ),
    },
  });
}

export function validateConsultPrescription(body: {
  consultationId: string;
  patientId: string;
  medications: Array<{ drugName: string }>;
  override?: boolean;
}): Promise<{
  warnings?: unknown[];
  blocked?: boolean;
  auditIds?: string[];
}> {
  return api({
    path: "/api/consultations/validate-prescription",
    method: "POST",
    body,
  });
}

export interface PrescriptionTemplate {
  id: string;
  templateName: string;
  medications?: Array<{
    name: string;
    dosePattern: string;
    foodTiming: string;
    duration: string;
  }>;
}

export async function getPrescriptionTemplates(
  consultationId: string
): Promise<PrescriptionTemplate[]> {
  const res = await api<{
    templates?: PrescriptionTemplate[];
    prescriptionTemplates?: PrescriptionTemplate[];
  }>({
    path: "/api/consult/prescription-template",
    query: { consultationId },
  });
  return res.templates ?? res.prescriptionTemplates ?? [];
}

export function createPrescriptionTemplate(body: {
  consultationId: string;
  templateName: string;
  medications: Array<{
    name: string;
    dosePattern: string;
    foodTiming: string;
    duration: string;
  }>;
}): Promise<unknown> {
  return api({
    path: "/api/consult/prescription-template",
    method: "POST",
    body,
  });
}

export function updatePrescriptionTemplate(body: {
  consultationId: string;
  templateName: string;
  medications: Array<{
    name: string;
    dosePattern: string;
    foodTiming: string;
    duration: string;
  }>;
}): Promise<unknown> {
  return api({
    path: "/api/consult/prescription-template",
    method: "PUT",
    body,
  });
}
