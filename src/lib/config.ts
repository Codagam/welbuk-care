/**
 * Runtime config. Values come from Expo public env vars (EXPO_PUBLIC_*), which
 * are inlined into the JS bundle at build time.
 *
 * - Local dev: set them in `.env` (see `.env.example`). A physical device cannot
 *   reach `localhost` — point EXPO_PUBLIC_PRACTICE_URL at your machine's LAN IP
 *   (e.g. http://192.168.1.5:3005) or a staging origin.
 * - `preview` / `production` builds: set them as EAS environment variables.
 *
 * In a production build the vars are REQUIRED and must be `https://` origins.
 * A missing or cleartext value throws at startup instead of silently talking to
 * the wrong backend (cleartext HTTP is also blocked at runtime by iOS ATS).
 *
 * - practiceUrl: the Welbuk Practice API origin (no trailing slash).
 * - wsUrl: the realtime notification server (ws.welbuk.com).
 */
function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

const DEV_PRACTICE_URL = "http://localhost:3005";
const DEV_WS_URL = "https://ws.welbuk.com";

type EnvName = "EXPO_PUBLIC_PRACTICE_URL" | "EXPO_PUBLIC_WS_URL";

/**
 * Resolve a required origin from an EXPO_PUBLIC_* var. Falls back to a dev
 * default only in development; in a production build a missing or non-https
 * value is a hard error.
 */
function resolveOrigin(
  name: EnvName,
  value: string | undefined,
  devFallback: string
): string {
  const raw = value?.trim();

  if (!raw) {
    if (__DEV__) return devFallback;
    throw new Error(
      `[config] ${name} is not set. Production builds require it to be ` +
        `configured as an EAS environment variable pointing at an https:// origin.`
    );
  }

  if (!__DEV__ && !/^https:\/\//i.test(raw)) {
    throw new Error(
      `[config] ${name} must be an https:// origin in production builds ` +
        `(got "${raw}"). Cleartext HTTP is blocked by App Transport Security.`
    );
  }

  return stripTrailingSlash(raw);
}

export const config = {
  practiceUrl: resolveOrigin(
    "EXPO_PUBLIC_PRACTICE_URL",
    process.env.EXPO_PUBLIC_PRACTICE_URL,
    DEV_PRACTICE_URL
  ),
  wsUrl: resolveOrigin(
    "EXPO_PUBLIC_WS_URL",
    process.env.EXPO_PUBLIC_WS_URL,
    DEV_WS_URL
  ),
} as const;
