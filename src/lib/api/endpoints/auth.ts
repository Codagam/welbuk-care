/**
 * Auth endpoints on the Practice API.
 *   POST /api/auth/login  → { token, authToken, user, facilities }
 *   GET  /api/auth/me     → { user?, facilities } (with networkBlocked flags)
 *   GET  /api/auth/ws-token?facilityId= → { token } (1h, facility-scoped WS JWT)
 */
import { api } from "@/lib/api/client";
import type { AuthUser, Facility, LoginInput } from "@/lib/auth/types";

interface LoginResponse {
  message?: string;
  user: AuthUser;
  facilities: Facility[];
  authToken?: string;
  token?: string;
}

export async function loginRequest(input: LoginInput): Promise<{
  token: string;
  user: AuthUser;
  facilities: Facility[];
}> {
  const data = await api<LoginResponse>({
    path: "/api/auth/login",
    method: "POST",
    body: { email: input.email.trim(), password: input.password },
    skipAuth: true,
    skipAuthRedirect: true,
  });
  const token = data.authToken ?? data.token;
  if (!token) {
    throw new Error("Login succeeded but no token was returned.");
  }
  return { token, user: data.user, facilities: data.facilities ?? [] };
}

interface MeResponse {
  user?: AuthUser;
  facilities?: Facility[];
}

/** Refresh the facility list (and networkBlocked flags) for the current token. */
export async function fetchMe(): Promise<MeResponse> {
  return api<MeResponse>({ path: "/api/auth/me" });
}

export async function fetchWsToken(facilityId: string): Promise<string> {
  const data = await api<{ token: string }>({
    path: "/api/auth/ws-token",
    query: { facilityId },
  });
  return data.token;
}

export async function logoutRequest(): Promise<void> {
  try {
    await api({ path: "/api/auth/logout", method: "POST", skipAuthRedirect: true });
  } catch {
    // Logout is best-effort; the client clears local state regardless.
  }
}
