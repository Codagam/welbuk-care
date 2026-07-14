/**
 * Typed HTTP client for the Welbuk Practice API.
 *
 * - Injects `Authorization: Bearer <token>` from a pluggable token provider
 *   (the auth layer registers it via `setTokenProvider`). This keeps the client
 *   independent of *how* auth works today (Practice JWT) vs. tomorrow (OIDC).
 * - Auto-detects `FormData` bodies (multipart uploads) and lets fetch set the
 *   boundary + content-type.
 * - Maps failures to typed `ApiError`s and fires a global 401 handler so the
 *   auth layer can force a re-login.
 */
import { config } from "@/lib/config";
import { ApiError, mapErrorCode } from "./errors";

type TokenProvider = () => Promise<string | null> | string | null;

let tokenProvider: TokenProvider = () => null;
let unauthorizedHandler: (() => void) | null = null;

export function setTokenProvider(fn: TokenProvider): void {
  tokenProvider = fn;
}

/** Resolve the current bearer token (for Image/proxy headers outside `api()`). */
export async function getAuthToken(): Promise<string | null> {
  return tokenProvider();
}

export function setUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

export type QueryValue = string | number | boolean | null | undefined;

export interface ApiRequest {
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  /** Skip attaching the bearer token (public routes like /api/auth/login). */
  skipAuth?: boolean;
  /** Don't fire the global 401 handler (e.g. the login call handles its own 401). */
  skipAuthRedirect?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const base = path.startsWith("http")
    ? path
    : `${config.practiceUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${base}${base.includes("?") ? "&" : "?"}${qs}` : base;
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

export async function api<T = unknown>(req: ApiRequest): Promise<T> {
  const url = buildUrl(req.path, req.query);
  const isForm =
    typeof FormData !== "undefined" && req.body instanceof FormData;

  const headers: Record<string, string> = { Accept: "application/json", ...(req.headers ?? {}) };

  if (!req.skipAuth) {
    const token = await tokenProvider();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let body: BodyInit | undefined;
  if (req.body != null) {
    if (isForm) {
      body = req.body as FormData; // let fetch set multipart boundary
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(req.body);
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: req.method ?? "GET",
      headers,
      body,
      signal: req.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    const underlying =
      err instanceof Error ? err.message : typeof err === "string" ? err : "unknown";
    console.log("[api] fetch FAILED (no HTTP response)", {
      url,
      method: req.method ?? "GET",
      underlying,
      err,
    });
    throw new ApiError(`Network request failed: ${underlying}`, {
      status: 0,
      code: "NETWORK",
      data: { url, underlying, err: String(err) },
    });
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    console.log("[api] HTTP error", {
      url,
      method: req.method ?? "GET",
      status: res.status,
      body: data,
    });
    const message = extractMessage(data, res.status);
    const serverCode =
      data && typeof data === "object"
        ? ((data as Record<string, unknown>).code as string | undefined)
        : undefined;
    const code = mapErrorCode(res.status, serverCode, message);
    if (code === "UNAUTHORIZED" && !req.skipAuthRedirect) unauthorizedHandler?.();
    throw new ApiError(message, { status: res.status, code, serverCode, data });
  }

  return data as T;
}
