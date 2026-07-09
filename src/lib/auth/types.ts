/**
 * Auth domain types + the `AuthProvider` seam.
 *
 * v1 uses `PracticeJwtAuthProvider` (Practice `/api/auth/login` bearer token).
 * A future `WelbukIdentityOidcProvider` implements the same interface, so the
 * screens/store never change when SSO lands.
 */

export type GlobalRole = "USER" | "FACILITY_ADMIN" | "SUPER_ADMIN" | string;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: GlobalRole;
  image?: string | null;
  displayName?: string | null;
}

export interface Facility {
  /** Mongo ObjectId — the value passed as `facilityId` to the API. */
  id: string;
  /** Numeric public facility id (display). */
  facilityId?: number | string;
  name: string;
  address?: string | null;
  type?: string | null;
  /** Drives which consult sub-flow renders: dental | eye | general. */
  consultationType?: string | null;
  /** True when this device's network is blocked for this facility (IP allowlist). */
  networkBlocked?: boolean;
}

export interface Session {
  token: string;
  user: AuthUser;
  facilities: Facility[];
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthProvider {
  /** Stable id for diagnostics / analytics (e.g. "practice-jwt"). */
  readonly id: string;
  /** Authenticate and return a full session. Throws ApiError on failure. */
  login(input: LoginInput): Promise<Session>;
  /** Best-effort server-side logout / cleanup. */
  logout(session: Session | null): Promise<void>;
  /**
   * Return a currently-valid access token for a session, refreshing if the
   * provider supports it. Practice JWT has no refresh — returns the stored
   * token and lets a 401 drive re-login.
   */
  resolveToken(session: Session | null): Promise<string | null>;
}
