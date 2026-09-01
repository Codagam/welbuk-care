import * as FileSystem from "expo-file-system/legacy";

import { getAuthToken } from "@/lib/api/client";
import { fileProxyUrl } from "@/lib/api/endpoints/recording";

const CACHE_DIR = `${FileSystem.cacheDirectory ?? ""}welbuk-proxy/`;

function extensionFromUrl(url: string): string {
  try {
    const path = url.split("?")[0] ?? url;
    const match = path.match(/\.([a-zA-Z0-9]+)$/);
    if (match?.[1]) return match[1].toLowerCase();
  } catch {
    /* fall through */
  }
  return "bin";
}

function safeCacheName(url: string): string {
  const trimmed = url.trim();
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) | 0;
  }
  return `f_${Math.abs(hash).toString(36)}`;
}

/**
 * Download a private Spaces file via Practice `/api/files/proxy` with Bearer
 * auth into the app cache. Never open the proxy URL in a browser — it has no
 * Authorization header and shows a blank/401 page.
 */
export async function fetchProxiedFileToCache(
  storageUrl: string
): Promise<{ localUri: string }> {
  const trimmed = storageUrl?.trim() ?? "";
  if (!trimmed) throw new Error("File URL is required");

  const token = await getAuthToken();
  if (!token) throw new Error("Not signed in");

  if (!FileSystem.cacheDirectory) {
    throw new Error("File cache is unavailable on this device");
  }

  const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }

  const ext = extensionFromUrl(trimmed);
  const dest = `${CACHE_DIR}${safeCacheName(trimmed)}.${ext}`;
  const proxy = fileProxyUrl(trimmed);

  const result = await FileSystem.downloadAsync(proxy, dest, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Failed to load file (${result.status})`);
  }

  return { localUri: result.uri };
}

/**
 * Delete every file downloaded via the proxy (lab reports, insurance cards,
 * documents, images). Called on sign-out — Care runs on shared clinic tablets
 * and these are decrypted PHI at rest.
 */
export async function clearProxiedFileCache(): Promise<void> {
  try {
    if (!FileSystem.cacheDirectory) return;
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (info.exists) {
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
    }
  } catch {
    // best-effort
  }
}
