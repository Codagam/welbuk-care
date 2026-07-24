import { api, getAuthToken } from "@/lib/api/client";
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

/**
 * Download QR PNG bytes via the authenticated wrapper-qr proxy (or data URL).
 * Returns a base64 string without the data-URL prefix.
 */
export async function downloadWrapperQrBase64(
  storedImageUrl: string
): Promise<string | null> {
  const trimmed = storedImageUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("data:image/")) {
    const comma = trimmed.indexOf(",");
    return comma >= 0 ? trimmed.slice(comma + 1) : null;
  }

  const token = await getAuthToken();
  const url = wrapperQrProxyUrl(trimmed);
  const res = await fetch(url, {
    headers: {
      Accept: "image/png,image/*,*/*",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) return null;

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return null;

  const buffer = await res.arrayBuffer();
  if (!buffer.byteLength) return null;

  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
