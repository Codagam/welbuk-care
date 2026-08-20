/**
 * Typed API errors. The client maps HTTP status + server `code` into a stable
 * `ApiErrorCode` the UI can switch on — notably the Practice patient-edit guards:
 *   - 409 { code: "ABHA_GOVERNED_FIELD" }   → name/DOB/gender locked (ABHA present)
 *   - 403 { code: "PATIENT_MANAGE_REQUIRED" } → DOB change needs the Patient Manager role
 *   - 403 facility network block             → tablet is off the allowed clinic network
 */
export type ApiErrorCode =
  | "UNAUTHORIZED" // 401 — token missing/expired → re-login
  | "FORBIDDEN" // 403 generic (permission)
  | "ABHA_GOVERNED_FIELD" // 409 — demographic locked by ABHA
  | "PATIENT_MANAGE_REQUIRED" // 403 — needs patient.manage
  | "MODULE_NOT_ENABLED" // 403 — site switch inpatient_enable is off
  | "IP_BLOCKED" // 403 — per-facility IP allowlist
  | "NOT_FOUND" // 404
  | "CONSULT_COMPLETED" // 409 — consultation is locked; reopen to edit
  | "CONFLICT" // 409 generic
  | "VALIDATION" // 400
  | "NETWORK" // fetch failed / offline
  | "HTTP"; // anything else

export interface ApiErrorInit {
  status: number;
  code: ApiErrorCode;
  serverCode?: string;
  data?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly serverCode?: string;
  readonly data?: unknown;

  constructor(message: string, init: ApiErrorInit) {
    super(message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.serverCode = init.serverCode;
    this.data = init.data;
  }

  get isAuth(): boolean {
    return this.code === "UNAUTHORIZED";
  }
}

const NETWORK_BLOCK_HINTS = ["network", "ip", "allowlist", "not allowed on"];

export function mapErrorCode(
  status: number,
  serverCode: string | undefined,
  message: string | undefined
): ApiErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (serverCode === "ABHA_GOVERNED_FIELD") return "ABHA_GOVERNED_FIELD";
  if (serverCode === "PATIENT_MANAGE_REQUIRED") return "PATIENT_MANAGE_REQUIRED";
  if (serverCode === "MODULE_NOT_ENABLED") return "MODULE_NOT_ENABLED";
  if (serverCode === "CONSULT_COMPLETED") return "CONSULT_COMPLETED";
  if (status === 403) {
    const m = (message ?? "").toLowerCase();
    if (NETWORK_BLOCK_HINTS.some((h) => m.includes(h))) return "IP_BLOCKED";
    return "FORBIDDEN";
  }
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 400) return "VALIDATION";
  return "HTTP";
}

const FRIENDLY_NETWORK =
  "No connection. Check your network and try again.";
const FRIENDLY_GENERIC = "Something went wrong. Please try again.";

/** Raw native / JVM / Node messages that must never reach the UI. */
const TECHNICAL_MESSAGE =
  /\b(java\.|javax\.|kotlin\.|dalvik\.|android\.|okhttp|retrofit|volley)\b/i;

const TECHNICAL_NETWORK =
  /network request failed|failed to connect|unable to resolve host|unknownhost|sockettimeout|connectexception|sslhandshake|cleartext|econnrefused|enotfound|etimedout|econnreset|enetunreach|connection (refused|reset|timed out)|timed?\s*out|no address associated|name not resolved|xmlhttprequest/i;

function looksTechnical(message: string): boolean {
  const m = message.trim();
  if (!m) return true;
  if (TECHNICAL_MESSAGE.test(m)) return true;
  if (TECHNICAL_NETWORK.test(m)) return true;
  // Stack-ish: "at com.foo.Bar" / multiline exception dumps
  if (/\bat\s+[\w.$]+\(/.test(m) || (m.includes("\n") && /Exception|Error:/.test(m))) {
    return true;
  }
  // Extremely long dumps are never meant for end users
  if (m.length > 280) return true;
  return false;
}

function friendlyFromMessage(
  message: string | undefined,
  fallback: string
): string {
  const m = (message ?? "").trim();
  if (!m || looksTechnical(m)) return fallback;
  return m;
}

/**
 * Human-facing message for a caught error, safe to show in UI / alerts.
 * Never surfaces native/JVM stack fragments (e.g. `java.util…`).
 */
export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "UNAUTHORIZED":
        return "Your session expired. Please sign in again.";
      case "IP_BLOCKED":
        return "This device isn't on an allowed clinic network for this facility.";
      case "ABHA_GOVERNED_FIELD":
        return "Name, date of birth and gender are verified from ABHA. Update them in ABHA and re-verify.";
      case "PATIENT_MANAGE_REQUIRED":
        return "Date of birth can only be changed by a user with the Patient Manager role.";
      case "MODULE_NOT_ENABLED":
        return "Inpatient is not available on this deployment.";
      case "CONSULT_COMPLETED":
        return friendlyFromMessage(
          err.message,
          "This consultation is completed and locked. Reopen it to make changes."
        );
      case "NETWORK":
        return FRIENDLY_NETWORK;
      case "NOT_FOUND":
        return friendlyFromMessage(err.message, "We couldn't find what you requested.");
      case "FORBIDDEN":
        return friendlyFromMessage(
          err.message,
          "You don't have permission to do that."
        );
      case "VALIDATION":
      case "CONFLICT":
      case "HTTP":
      default:
        return friendlyFromMessage(err.message, FRIENDLY_GENERIC);
    }
  }
  if (err instanceof Error) {
    return friendlyFromMessage(err.message, FRIENDLY_GENERIC);
  }
  if (typeof err === "string") {
    return friendlyFromMessage(err, FRIENDLY_GENERIC);
  }
  return FRIENDLY_GENERIC;
}

export function isModuleNotEnabled(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    (err.code === "MODULE_NOT_ENABLED" || err.serverCode === "MODULE_NOT_ENABLED")
  );
}

/** True when Practice refused a write because the consult is COMPLETED. */
export function isConsultCompletedLock(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  return (
    err.code === "CONSULT_COMPLETED" ||
    err.serverCode === "CONSULT_COMPLETED"
  );
}
