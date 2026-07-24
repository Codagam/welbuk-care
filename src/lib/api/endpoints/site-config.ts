/**
 * Public site_config lookups via the mobile access API.
 *   GET/POST /api/mobile/auth/access?key=…
 */
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

export type SiteConfigResponse = {
  success: boolean;
  key: string;
  value: unknown;
  description?: string | null;
  error?: string;
};

/** Coerce site_config values into a boolean; anything unrecognized → false. */
export function parseSiteConfigBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "1" || v === "yes";
  }
  return false;
}

export async function getSiteConfigByKey(
  key: string
): Promise<SiteConfigResponse | null> {
  try {
    return await api<SiteConfigResponse>({
      path: "/api/mobile/auth/access",
      query: { key },
      skipAuth: true,
      skipAuthRedirect: true,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** Fetch a boolean site_config flag; missing/invalid → false. */
export async function getSiteConfigEnabled(key: string): Promise<boolean> {
  try {
    const config = await getSiteConfigByKey(key);
    if (!config?.success) return false;
    return parseSiteConfigBool(config.value);
  } catch {
    return false;
  }
}
