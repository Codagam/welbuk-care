import { api } from "@/lib/api/client";
import { config } from "@/lib/config";
import type { Recording } from "@/features/consult/types";

export type UploadPurpose = "consult_audio" | "care_recording" | "patient_document";

export interface UploadContext {
  facilityId?: string;
  patientId?: string;
  consultationId?: string;
}

/**
 * Upload a local file (audio/doc/image) to Practice → DO Spaces, returning the
 * stored URL(s). Sends multipart FormData with the bearer token attached by the
 * API client.
 */
export async function uploadFile(
  fileUri: string,
  fileName: string,
  mimeType: string,
  purpose: UploadPurpose,
  ctx: UploadContext
): Promise<string[]> {
  const form = new FormData();
  form.append("purpose", purpose);
  if (ctx.facilityId) form.append("facilityId", ctx.facilityId);
  if (ctx.patientId) form.append("patientId", ctx.patientId);
  if (ctx.consultationId) form.append("consultationId", ctx.consultationId);
  // React Native FormData file shape.
  form.append("file", {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);

  const res = await api<{ urls: string[] }>({
    path: "/api/upload",
    method: "POST",
    body: form,
  });
  return res.urls ?? [];
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

/** Absolute URL for a stored file served via the Practice signed-file proxy. */
export function fileProxyUrl(url: string): string {
  if (url.startsWith("http")) return url;
  return `${config.practiceUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}
