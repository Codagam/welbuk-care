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
} as const;
