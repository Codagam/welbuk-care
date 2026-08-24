/**
 * Client-side role helpers mirroring Practice web (`lib/auth/global-role-client`).
 * Prefer fields from GET /api/auth/me — JWT `role` is a stale copy.
 */
import type { AuthUser } from "./types";

export function getGlobalRoleLower(
  user: Pick<AuthUser, "globalRole" | "role"> | null | undefined
): string | null {
  if (!user) return null;
  const g = user.globalRole ?? user.role;
  return g ? String(g).toLowerCase() : null;
}

export function isSuperAdminUser(
  user: Pick<AuthUser, "globalRole" | "role"> | null | undefined
): boolean {
  return getGlobalRoleLower(user) === "super_admin";
}

export function isFacilityAdminUser(
  user: Pick<AuthUser, "globalRole" | "role"> | null | undefined
): boolean {
  return getGlobalRoleLower(user) === "facility_admin";
}

/**
 * Doctor home: linked Doctor row and not an elevated admin.
 * These users must pass `doctorId` on appointment APIs (backend does not auto-scope).
 */
export function isDoctorHome(user: AuthUser | null | undefined): boolean {
  return (
    Boolean(user?.doctorId) &&
    !isSuperAdminUser(user) &&
    !isFacilityAdminUser(user)
  );
}

const DOCTOR_NAME_PREFIX_RE = /^(?:dr\.?\s*)+/i;

export function stripDoctorNamePrefix(name: string): string {
  return name.replace(DOCTOR_NAME_PREFIX_RE, "").trim();
}

function normalizeRoleKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function userRoleKeys(user: AuthUser | null | undefined): string[] {
  if (!user) return [];
  const keys = new Set<string>();
  const add = (value: unknown) => {
    const key = normalizeRoleKey(value);
    if (key) keys.add(key);
  };
  add(user.role);
  for (const role of user.roles ?? []) add(role);
  for (const label of user.roleLabels ?? []) add(label);
  for (const labels of Object.values(user.rolesByFacility ?? {})) {
    for (const label of labels) add(label);
  }
  return [...keys];
}

/**
 * True when this login is a doctor (linked Doctor row, not an elevated admin)
 * or the primary /me role is `doctor`.
 */
export function isDoctorRole(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (isSuperAdminUser(user) || isFacilityAdminUser(user)) return false;
  if (user.doctorId) return true;
  return userRoleKeys(user).includes("doctor");
}

/** Facility nurse (or nursing) role — not a doctor login. */
export function isNurseRole(user: AuthUser | null | undefined): boolean {
  if (!user || isDoctorRole(user)) return false;
  return userRoleKeys(user).some(
    (key) => key === "nurse" || key.startsWith("nurse_") || key.endsWith("_nurse")
  );
}

/** Display name for greetings: displayName → name → email local-part. */
export function userDisplayName(user: AuthUser | null | undefined): string {
  if (!user) return "";
  const named = user.name?.trim() || user.displayName?.trim();
  if (named) return named;
  const email = user.email?.trim();
  if (email?.includes("@")) return email.split("@")[0] ?? email;
  return email || "";
}

/** Greeting name: "Dr. …" only when the signed-in role is doctor. */
export function userGreetingName(user: AuthUser | null | undefined): string {
  const raw = userDisplayName(user);
  if (!raw) return "";
  const withoutPrefix = stripDoctorNamePrefix(raw);
  const name = withoutPrefix || raw;
  return isDoctorRole(user) ? `Dr. ${name}` : name;
}

export function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
