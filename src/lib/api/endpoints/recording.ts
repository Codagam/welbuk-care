import { File, UploadType } from "expo-file-system";

import { api, getAuthToken } from "@/lib/api/client";
import { ApiError, mapErrorCode } from "@/lib/api/errors";
import { config } from "@/lib/config";
import type { Recording } from "@/features/consult/types";

export type UploadPurpose =
  | "consult_audio"
  | "care_recording"
  | "patient_document"
  | "consult_report"
  | "patient_lab_report"
  | "consult_prescription";

export interface UploadContext {
  facilityId?: string;
  patientId?: string;
  consultationId?: string;
}

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
 * Upload a local file to Practice → DO Spaces via multipart.
 *
 * Uses `expo-file-system` File.upload — do NOT append `{ uri, name, type }` to
 * FormData (Expo fetch throws "Unsupported FormDataPart implementation").
 */
export async function uploadFile(
  fileUri: string,
  fileName: string,
  mimeType: string,
  purpose: UploadPurpose,
  ctx: UploadContext
): Promise<string[]> {
  const token = await getAuthToken();
  const url = `${config.practiceUrl}/api/upload`;

  const parameters: Record<string, string> = { purpose };
  if (ctx.facilityId) parameters.facilityId = ctx.facilityId;
  if (ctx.patientId) parameters.patientId = ctx.patientId;
  if (ctx.consultationId) parameters.consultationId = ctx.consultationId;

  const file = new File(fileUri);
  console.log("[uploadFile] starting", {
    url,
    purpose,
    fileName,
    mimeType,
    uri: fileUri,
    parameters,
  });

  const result = await file.upload(url, {
    httpMethod: "POST",
    uploadType: UploadType.MULTIPART,
    fieldName: "file",
    mimeType,
    parameters,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = result.body ? safeJson(result.body) : null;
  console.log("[uploadFile] response", {
    status: result.status,
    body: data,
  });

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

  const payload = data as { urls?: string[]; files?: { url: string }[] } | null;
  if (payload?.urls?.length) return payload.urls;
  if (Array.isArray(payload?.files)) {
    return payload.files.map((f) => f.url).filter(Boolean);
  }
  return [];
}

// ---- Recording ledger ---------------------------------------------------

export function createRecording(body: {
  facilityId: string;
  patientId: string;
  consultationId?: string;
  appointmentId?: string;
  kind: "AUDIO" | "DOCUMENT" | "IMAGE";
  url: string;
  mimeType?: string;
  durationSec?: number;
  note?: string;
}): Promise<{ recording: Recording }> {
  return api({ path: "/api/patient/recording", method: "POST", body });
}

export async function listRecordings(params: {
  facilityId: string;
  patientId: string;
  consultationId?: string;
}): Promise<Recording[]> {
  const res = await api<{ recordings: Recording[] }>({
    path: "/api/patient/recording",
    query: { ...params, pageSize: 50 },
  });
  return res.recordings ?? [];
}

/**
 * Authenticated Practice file proxy URL.
 * Callers must send `Authorization: Bearer` (cookies alone won't work on Care).
 */
export function fileProxyUrl(url: string): string {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return "";
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return trimmed;
  const absolute = trimmed.startsWith("http")
    ? trimmed
    : `${config.practiceUrl}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
  return `${config.practiceUrl}/api/files/proxy?url=${encodeURIComponent(absolute)}`;
}
