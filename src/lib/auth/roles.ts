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

/** Display name for greetings: displayName → name → email local-part. */
export function userDisplayName(user: AuthUser | null | undefined): string {
  if (!user) return "";
  const named = user.name?.trim() || user.displayName?.trim();
  if (named) return named;
  const email = user.email?.trim();
  if (email?.includes("@")) return email.split("@")[0] ?? email;
  return email || "";
}

export function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
