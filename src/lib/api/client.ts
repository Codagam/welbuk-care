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
  /**
   * Abort the request after this many ms and throw a `TIMEOUT` ApiError.
   * Omit for the default (25s for JSON calls, none for multipart uploads).
   * Pass `null` to disable, or a number to override.
   */
  timeoutMs?: number | null;
}

/** Default request timeout for JSON calls. Uploads opt out (can run long on 3G). */
const DEFAULT_TIMEOUT_MS = 25_000;

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

  // RN's fetch has no built-in timeout — a server that accepts the connection
  // but never responds would leave this promise pending forever and freeze the
  // screen. Abort after `timeoutMs` and forward any caller-supplied signal into
  // the same controller so either can cancel.
  const timeoutMs =
    req.timeoutMs === undefined
      ? isForm
        ? null
        : DEFAULT_TIMEOUT_MS
      : req.timeoutMs;

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId =
    timeoutMs != null
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : undefined;

  if (req.signal) {
    if (req.signal.aborted) controller.abort();
    else
      req.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: req.method ?? "GET",
      headers,
      body,
      signal: controller.signal,
    });
  } catch (err) {
    if (timedOut) {
      throw new ApiError(
        "The server took too long to respond. Check your connection and try again.",
        { status: 0, code: "TIMEOUT", data: { url, timeoutMs } }
      );
    }
    if (err instanceof Error && err.name === "AbortError") throw err;
    const underlying =
      err instanceof Error ? err.message : typeof err === "string" ? err : "unknown";
    // Keep raw native detail in `data` for logs — never in the user-facing message.
    throw new ApiError("No connection. Check your network and try again.", {
      status: 0,
      code: "NETWORK",
      data: { url, underlying, err: String(err) },
    });
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    // console.log("[api] HTTP error", {
    //  url,
    //    method: req.method ?? "GET",
    //   status: res.status,
    //   body: data,
    // });
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
