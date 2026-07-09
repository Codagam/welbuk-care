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
  | "IP_BLOCKED" // 403 — per-facility IP allowlist
  | "NOT_FOUND" // 404
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

/** Human-facing message for a caught error, safe to show in a toast. */
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
      case "NETWORK":
        return "No connection. Check your network and try again.";
      default:
        return err.message || "Something went wrong.";
    }
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
