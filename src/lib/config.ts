/**
 * Runtime config. Values come from Expo public env vars (EXPO_PUBLIC_*), which
 * are inlined at build time. Set them in `.env` (see `.env.example`).
 *
 * - practiceUrl: the Welbuk Practice API origin (no trailing slash).
 * - wsUrl: the realtime notification server (ws.welbuk.com).
 *
 * NOTE: a physical device cannot reach `localhost` — point EXPO_PUBLIC_PRACTICE_URL
 * at your machine's LAN IP (e.g. http://192.168.1.5:3005) or the staging origin.
 */
function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export const config = {
  practiceUrl: stripTrailingSlash(
    process.env.EXPO_PUBLIC_PRACTICE_URL ?? "http://localhost:3005"
  ),
  wsUrl: stripTrailingSlash(
    process.env.EXPO_PUBLIC_WS_URL ?? "https://ws.welbuk.com"
  ),
  /** Only for a password-protected Vercel preview backend; empty otherwise. */
  vercelProtectionBypass: (
    process.env.EXPO_PUBLIC_VERCEL_PROTECTION_BYPASS ?? ""
  ).trim(),
} as const;

/**
 * Header that lets a request through Vercel deployment protection (same as
 * Welbuk Health's `vercelBypassHeaders`). Empty when the variable is unset, so
 * normal backends never receive it. Attach only to Practice API requests —
 * never to third-party URLs.
 */
export function vercelBypassHeaders(): Record<string, string> {
  return config.vercelProtectionBypass
    ? { "x-vercel-protection-bypass": config.vercelProtectionBypass }
    : {};
}

/** True when `url` points at the configured Practice API origin. */
export function isPracticeUrl(url: string): boolean {
  return url === config.practiceUrl || url.startsWith(`${config.practiceUrl}/`);
}
