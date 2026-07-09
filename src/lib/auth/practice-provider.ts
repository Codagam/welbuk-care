/**
 * PracticeJwtAuthProvider — v1 auth against Welbuk Practice.
 *
 * Login POSTs credentials and gets back a 7-day HS256 bearer JWT (no refresh).
 * `resolveToken` just returns the stored token; expiry surfaces as a 401 which
 * the store turns into a re-login. When Welbuk Identity (OIDC) lands, swap this
 * class for `WelbukIdentityOidcProvider` — the store + screens don't change.
 */
import { loginRequest, logoutRequest } from "@/lib/api/endpoints/auth";
import type { AuthProvider, LoginInput, Session } from "./types";

export class PracticeJwtAuthProvider implements AuthProvider {
  readonly id = "practice-jwt";

  async login(input: LoginInput): Promise<Session> {
    const { token, user, facilities } = await loginRequest(input);
    return { token, user, facilities };
  }

  async logout(): Promise<void> {
    await logoutRequest();
  }

  async resolveToken(session: Session | null): Promise<string | null> {
    return session?.token ?? null;
  }
}

export const authProvider: AuthProvider = new PracticeJwtAuthProvider();
