/**
 * Auth endpoints on the Practice API.
 *   POST /api/auth/login  → { token, authToken, user, facilities }
 *   GET  /api/auth/me     → { user?, facilities, authenticated } (+ doctorId)
 *   GET  /api/auth/ws-token?facilityId= → { token } (1h, facility-scoped WS JWT)
 *
 * Login `user` does NOT include doctorId. Care must call /me after login.
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

interface MeResponse {
  user?: AuthUser | null;
  facilities?: Facility[];
  authenticated?: boolean;
}

/**
 * Resolve the enriched session user (doctorId, roles, facilities) via /me.
 * Pass `token` when the auth store is not yet updated (right after login).
 */
export async function fetchMe(token?: string): Promise<MeResponse> {
  const me = token
    ? await api<MeResponse>({
        path: "/api/auth/me",
        headers: { Authorization: `Bearer ${token}` },
        skipAuth: true,
        skipAuthRedirect: true,
      })
    : await api<MeResponse>({ path: "/api/auth/me" });

  // Debug: where role / name / doctorId come from (remove once verified).
  // console.log("[auth] GET /api/auth/me response", JSON.stringify(me, null, 2));
  // console.log("[auth] /me key fields", {
  //   name: me.user?.name,
  //   displayName: me.user?.displayName,
  //   role: me.user?.role,
  //   globalRole: me.user?.globalRole,
  //   roles: me.user?.roles,
  //   roleLabels: me.user?.roleLabels,
  //   doctorId: me.user?.doctorId,
  //   // NOTE: there is no separate "doctorName" on /me — greeting uses user.name/displayName
  // });

  return me;
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

  // Debug: login payload (no doctorId here — /me supplies it).
  // console.log("[auth] POST /api/auth/login response", JSON.stringify(data, null, 2));
  // console.log("[auth] login key fields", {
  //   name: data.user?.name,
  //   displayName: data.user?.displayName,
  //   role: data.user?.role,
  //   doctorId: data.user?.doctorId ?? "(not on login — need /me)",
  // });

  const token = data.authToken ?? data.token;
  if (!token) {
    throw new Error("Login succeeded but no token was returned.");
  }

  // /me is authoritative for doctorId + richer role/facility shape.
  try {
    const me = await fetchMe(token);
    if (me.authenticated !== false && me.user) {
      // console.log("[auth] session user after /me", {
      //   greetingName: me.user.displayName || me.user.name,
      //   role: me.user.globalRole ?? me.user.role,
      //   doctorId: me.user.doctorId,
      // });
      return {
        token,
        user: me.user,
        facilities: me.facilities ?? data.facilities ?? [],
      };
    }
  } catch (err) {
    console.log("[auth] /me failed after login, falling back to login user", err);
  }

  return { token, user: data.user, facilities: data.facilities ?? [] };
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
