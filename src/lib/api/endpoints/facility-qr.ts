import * as FileSystem from "expo-file-system/legacy";

import { api, getAuthToken } from "@/lib/api/client";
import { ApiError, mapErrorCode } from "@/lib/api/errors";
import { config } from "@/lib/config";

export type FacilityWrapperShare = {
  facilityId?: number;
  name?: string;
  wrapperQrImageUrl?: string | null;
  wrapperDynamicLinkUrl?: string | null;
};

export type FacilityWrapperShareResponse = FacilityWrapperShare & {
  warning?: string;
  message?: string;
};

export function hasFacilityQrImage(
  fields: Pick<FacilityWrapperShare, "wrapperQrImageUrl"> | null | undefined
): boolean {
  return Boolean(fields?.wrapperQrImageUrl?.trim());
}

export async function fetchFacilityWrapperShare(
  facilityMongoId: string
): Promise<FacilityWrapperShare> {
  const body = await api<{ facility?: FacilityWrapperShare; error?: string }>({
    path: "/api/facility/crud",
    query: { id: facilityMongoId },
  });
  return body.facility ?? {};
}

export async function postFacilityWrapperShare(
  facilityMongoId: string,
  regenerate = false
): Promise<FacilityWrapperShareResponse> {
  const body = await api<{
    facility?: FacilityWrapperShare;
    warning?: string;
    message?: string;
  }>({
    path: "/api/facility/wrapper-share",
    method: "POST",
    body: { facilityId: facilityMongoId, regenerate },
  });
  return {
    ...(body.facility ?? {}),
    warning: body.warning,
    message: body.message,
  };
}

/** Authenticated proxy URL for a stored facility QR image. */
export function wrapperQrProxyUrl(storedImageUrl: string): string {
  const image = storedImageUrl.trim();
  if (!image) return "";
  if (image.startsWith("data:image/")) return image;
  if (image.startsWith("file://")) return image;
  const params = new URLSearchParams({ redirect: "1", url: image });
  return `${config.practiceUrl}/api/wrapper-qr?${params}`;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/** Read a JSON `{ error }` / `{ message }` body the proxy wrote into `destUri`. */
async function readErrorBody(destUri: string): Promise<string | undefined> {
  try {
    const raw = await FileSystem.readAsStringAsync(destUri);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { error?: string; message?: string };
    return parsed.error ?? parsed.message ?? undefined;
  } catch {
    return undefined;
  }
}

async function writeDataUrlToFile(dataUrl: string, destUri: string): Promise<void> {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : "";
  if (!base64) throw new Error("The facility QR image is empty.");
  await FileSystem.writeAsStringAsync(destUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

async function assertDownloadedImage(
  destUri: string,
  result: FileSystem.FileSystemDownloadResult
): Promise<void> {
  const contentType = (
    result.mimeType ??
    result.headers?.["content-type"] ??
    result.headers?.["Content-Type"] ??
    ""
  ).toLowerCase();
  if (contentType.includes("application/json") || contentType.includes("text/html")) {
    const serverMessage = await readErrorBody(destUri);
    await FileSystem.deleteAsync(destUri, { idempotent: true });
    throw new Error(
      serverMessage ||
        "The facility QR could not be loaded. Try regenerating the QR code."
    );
  }
  const info = await FileSystem.getInfoAsync(destUri);
  const size = info.exists && "size" in info ? info.size : 0;
  if (!info.exists || size === 0) {
    await FileSystem.deleteAsync(destUri, { idempotent: true });
    throw new Error("The downloaded facility QR image was empty.");
  }
}

async function downloadToFile(
  url: string,
  destUri: string,
  headers: Record<string, string>
): Promise<void> {
  let result: FileSystem.FileSystemDownloadResult;
  try {
    result = await FileSystem.downloadAsync(url, destUri, { headers });
  } catch (e) {
    throw new ApiError("No connection. Check your network and try again.", {
      status: 0,
      code: "NETWORK",
      data: { url, underlying: e instanceof Error ? e.message : String(e) },
    });
  }

  if (result.status < 200 || result.status >= 300) {
    const serverMessage = await readErrorBody(destUri);
    await FileSystem.deleteAsync(destUri, { idempotent: true });
    throw new ApiError(
      serverMessage || `Could not download the facility QR (${result.status}).`,
      {
        status: result.status,
        code: mapErrorCode(result.status, undefined, serverMessage),
        data: { url },
      }
    );
  }

  await assertDownloadedImage(destUri, result);
}

/** HTTP statuses where the proxy can't serve this URL, but a direct fetch might. */
function proxyRejectedUrl(err: unknown): boolean {
  return err instanceof ApiError && [400, 415, 500, 502, 503].includes(err.status);
}

/**
 * Download a stored facility QR PNG to `destUri`.
 *
 * - `data:` URL → decoded straight to the file.
 * - Otherwise → authenticated `/api/wrapper-qr` proxy (handles private Spaces
 *   objects). If the proxy can't handle the stored URL (e.g. a Smart Link
 *   fallback that isn't a Spaces object) we retry a direct fetch.
 *
 * Throws an `ApiError`/`Error` with a human-readable message on failure instead
 * of collapsing every cause into a generic "could not download".
 */
export async function downloadFacilityQrImageToFile(
  storedImageUrl: string,
  destUri: string
): Promise<void> {
  const trimmed = storedImageUrl.trim();
  if (!trimmed) throw new Error("No QR image is available for this facility yet.");

  if (trimmed.startsWith("data:image/")) {
    await writeDataUrlToFile(trimmed, destUri);
    return;
  }

  const token = await getAuthToken();
  const baseHeaders = { Accept: "image/png,image/*,*/*" };

  try {
    await downloadToFile(wrapperQrProxyUrl(trimmed), destUri, {
      ...baseHeaders,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });
  } catch (err) {
    if (isHttpUrl(trimmed) && proxyRejectedUrl(err)) {
      await downloadToFile(trimmed, destUri, baseHeaders);
      return;
    }
    throw err;
  }
}
