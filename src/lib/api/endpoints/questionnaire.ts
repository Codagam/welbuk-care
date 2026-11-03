import { File, UploadType } from "expo-file-system";

import { api, getAuthToken } from "@/lib/api/client";
import { ApiError, mapErrorCode } from "@/lib/api/errors";
import { config } from "@/lib/config";
import type {
  PatientQuestionnaire,
  QuestionnaireStepPayload,
} from "@/features/patients/types";

export async function getPatientQuestionnaire(
  patientId: string,
  facilityId?: string
): Promise<PatientQuestionnaire | null> {
  try {
    const res = await api<{ questionnaire?: PatientQuestionnaire | null }>({
      path: "/api/patient/questionnaire",
      query: {
        patientId,
        ...(facilityId ? { facilityId } : {}),
      },
    });
    return res.questionnaire ?? null;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function savePatientQuestionnaire(body: {
  patientId: string;
  stepNumber: 1 | 2 | 3;
  stepData: QuestionnaireStepPayload;
  completed?: boolean;
  facilityId?: string;
}): Promise<{
  success?: boolean;
  questionnaire?: PatientQuestionnaire;
  message?: string;
}> {
  return api({
    path: "/api/patient/questionnaire",
    method: "POST",
    body,
  });
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

/** Insurance document upload — FormData patientId + file. */
export async function uploadQuestionnaireDocument(params: {
  patientId: string;
  uri: string;
  fileName: string;
  mimeType: string;
  facilityId?: string;
}): Promise<{ url: string; fileName?: string }> {
  const { patientId, uri, fileName, mimeType, facilityId } = params;
  const token = await getAuthToken();
  const url = `${config.practiceUrl}/api/patient/questionnaire/document`;
  const file = new File(uri);

  const parameters: Record<string, string> = {
    patientId: patientId.trim(),
  };
  if (facilityId) parameters.facilityId = facilityId;

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
  if (result.status < 200 || result.status >= 300) {
    const message = extractMessage(data, result.status);
    throw new ApiError(message, {
      status: result.status,
      code: mapErrorCode(result.status, undefined, message),
      data,
    });
  }

  const payload = data as { url?: string; fileName?: string } | null;
  if (!payload?.url) {
    throw new ApiError("Upload failed", {
      status: result.status,
      code: mapErrorCode(result.status, undefined, "Upload failed"),
      data,
    });
  }
  return { url: payload.url, fileName: payload.fileName ?? fileName };
}
