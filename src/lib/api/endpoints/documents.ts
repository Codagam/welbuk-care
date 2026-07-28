import { File, UploadType } from "expo-file-system";

import { api, getAuthToken } from "@/lib/api/client";
import { ApiError, mapErrorCode } from "@/lib/api/errors";
import { config } from "@/lib/config";

export interface PatientDocumentItem {
  id: string;
  patientDocumentId?: string;
  url: string;
  viewUrl?: string | null;
  fileName?: string | null;
  displayName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  createdAt?: string | Date | null;
  uploadedByPatient?: boolean;
}

export interface PatientDocumentsPage {
  documents: PatientDocumentItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

export const PATIENT_DOCUMENT_MIME = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const PATIENT_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractMessage(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (typeof d.error === "string") return d.error;
    if (typeof d.message === "string") return d.message;
  }
  if (typeof data === "string" && data.trim()) return data;
  return `Request failed (${status})`;
}

/**
 * GET /api/documents/patient/[patientId]
 * Staff JWT + patient access. Never use /api/mobile/documents from Care.
 */
export async function listPatientDocuments(
  patientId: string,
  opts?: { page?: number; pageSize?: number }
): Promise<PatientDocumentsPage> {
  const res = await api<{
    documents?: PatientDocumentItem[];
    pagination?: PatientDocumentsPage["pagination"];
  }>({
    path: `/api/documents/patient/${encodeURIComponent(patientId)}`,
    query: {
      page: opts?.page ?? 1,
      pageSize: opts?.pageSize ?? 20,
    },
  });

  return {
    documents: Array.isArray(res.documents) ? res.documents : [],
    pagination: res.pagination ?? {
      page: opts?.page ?? 1,
      pageSize: opts?.pageSize ?? 20,
      totalCount: Array.isArray(res.documents) ? res.documents.length : 0,
      totalPages: 1,
    },
  };
}

/**
 * POST /api/documents/upload — all-in-one staff patient document upload.
 * FormData: file, type=patient, patientId.
 * Uses expo-file-system File.upload (Expo FormData cannot carry file parts).
 */
export async function uploadPatientDocument(params: {
  uri: string;
  fileName: string;
  mimeType: string;
  patientId: string;
}): Promise<{
  message?: string;
  document: {
    id: string;
    url: string;
    fileName?: string | null;
    fileType?: string | null;
    fileSize?: number | null;
  };
}> {
  const { uri, fileName, mimeType, patientId } = params;
  if (!patientId?.trim()) throw new Error("patientId is required");
  if (!PATIENT_DOCUMENT_MIME.has(mimeType)) {
    throw new Error(
      "Invalid file type. Only JPEG, PNG, PDF, and Word documents are allowed"
    );
  }

  const token = await getAuthToken();
  const url = `${config.practiceUrl}/api/documents/upload`;
  const file = new File(uri);

  const result = await file.upload(url, {
    httpMethod: "POST",
    uploadType: UploadType.MULTIPART,
    fieldName: "file",
    mimeType,
    parameters: {
      type: "patient",
      patientId: patientId.trim(),
    },
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = result.body ? safeJson(result.body) : null;

  if (result.status < 200 || result.status >= 300) {
    const message = extractMessage(data, result.status);
    const serverCode =
      data && typeof data === "object"
        ? ((data as Record<string, unknown>).code as string | undefined)
        : undefined;
    throw new ApiError(message, {
      status: result.status,
      code: mapErrorCode(result.status, serverCode, message),
      serverCode,
      data,
    });
  }

  const payload = data as {
    message?: string;
    document?: {
      id: string;
      url: string;
      fileName?: string | null;
      fileType?: string | null;
      fileSize?: number | null;
    };
  } | null;

  if (!payload?.document?.url) {
    throw new ApiError("Upload failed", {
      status: result.status,
      code: mapErrorCode(result.status, undefined, "Upload failed"),
      data,
    });
  }

  return {
    message: payload.message,
    document: payload.document,
  };
}
