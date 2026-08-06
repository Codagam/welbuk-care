import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  fetchFacilityEntitlements,
  isFeatureEnabled,
} from "@/lib/api/endpoints/entitlements";
import { fetchPermissions } from "@/lib/api/endpoints/permissions";
import {
  isFacilityAdminUser,
  isSuperAdminUser,
} from "@/lib/auth/roles";
import { useAuthStore, useAuthUser, useFacilityId } from "@/lib/auth/store";

/** Effective permission keys for the active facility (Practice `/api/permissions`). */
export function usePermissions(facilityId?: string | null) {
  const user = useAuthUser();
  const authStatus = useAuthStore((s) => s.status);
  const activeFacilityId = useFacilityId();
  const resolvedFacilityId = facilityId ?? activeFacilityId;
  const authLoading = authStatus === "loading";
  const enabled = Boolean(user) && !authLoading;

  const q = useQuery({
    queryKey: ["permissions", user?.id, resolvedFacilityId],
    enabled,
    staleTime: 30_000,
    queryFn: () => fetchPermissions(resolvedFacilityId),
  });

  const permissions = q.data ?? [];
  /**
   * Truthful loading — same contract as Practice `hooks/use-permissions.tsx`.
   * While auth is booting or the query is disabled, treat as loading so gates
   * never flash "no access" on an empty permission list.
   */
  const isLoading = authLoading || !enabled || q.isPending;

  return {
    permissions,
    isLoading,
    /** Permissions are known — safe to decide access on. */
    isResolved: !isLoading && !q.isError,
    error: q.error,
    refetch: q.refetch,
  };
}

export function useHasPermission(
  permissionKey: string,
  facilityId?: string | null
): boolean {
  const { permissions, isLoading } = usePermissions(facilityId);
  if (isLoading) return false;
  return permissions.includes(permissionKey);
}

export function useHasAnyPermission(
  permissionKeys: string[],
  facilityId?: string | null
): boolean {
  const { permissions, isLoading } = usePermissions(facilityId);
  if (isLoading) return false;
  return permissionKeys.some((key) => permissions.includes(key));
}

export function useHasAllPermissions(
  permissionKeys: string[],
  facilityId?: string | null
): boolean {
  const { permissions, isLoading } = usePermissions(facilityId);
  if (isLoading) return false;
  return permissionKeys.every((key) => permissions.includes(key));
}

export function useCanAccessSection(
  resource: string,
  action: string,
  facilityId?: string | null
): boolean {
  return useHasPermission(`${resource}.${action}`, facilityId);
}

export function useCanRead(
  resource: string,
  facilityId?: string | null
): boolean {
  return useCanAccessSection(resource, "read", facilityId);
}

export function useCanCreate(
  resource: string,
  facilityId?: string | null
): boolean {
  return useCanAccessSection(resource, "create", facilityId);
}

export function useCanWrite(
  resource: string,
  facilityId?: string | null
): boolean {
  const canWrite = useCanAccessSection(resource, "write", facilityId);
  const canUpdate = useCanAccessSection(resource, "update", facilityId);
  return canWrite || canUpdate;
}

export function useCanDelete(
  resource: string,
  facilityId?: string | null
): boolean {
  return useCanAccessSection(resource, "delete", facilityId);
}

/**
 * Section allow decision for layout gates (Practice `SectionAccessGate`).
 * Elevated admins bypass resource checks; refuse only after `isResolved`.
 */
export function useSectionAccess(options: {
  resource?: string | string[];
  anyPermissionKeys?: string[];
  extraAllow?: boolean;
  allowElevatedAdmin?: boolean;
  elevatedAdminOnly?: boolean;
  facilityId?: string | null;
}) {
  const {
    resource,
    anyPermissionKeys = [],
    extraAllow = false,
    allowElevatedAdmin = true,
    elevatedAdminOnly = false,
    facilityId,
  } = options;

  const user = useAuthUser();
  const authStatus = useAuthStore((s) => s.status);
  const { permissions, isResolved } = usePermissions(facilityId);
  const authLoading = authStatus === "loading";

  const isElevated = isSuperAdminUser(user) || isFacilityAdminUser(user);
  const resources = resource
    ? Array.isArray(resource)
      ? resource
      : [resource]
    : [];

  const canReadResource = resources.some((r) =>
    permissions.includes(`${r}.read`)
  );
  const hasAnyKey = anyPermissionKeys.some((k) => permissions.includes(k));

  let allowed = false;
  if (elevatedAdminOnly) {
    allowed = isElevated;
  } else {
    allowed =
      (allowElevatedAdmin && isElevated) ||
      canReadResource ||
      hasAnyKey ||
      extraAllow;
  }

  const decided = allowed || (isResolved && !authLoading);
  const denied = decided && !allowed;

  return { allowed, decided, denied, isResolved, permissions };
}

export function useFacilityEntitlements(facilityId?: string | null) {
  const user = useAuthUser();
  const activeFacilityId = useFacilityId();
  const resolvedFacilityId = facilityId ?? activeFacilityId;
  const superAdmin = isSuperAdminUser(user);

  const q = useQuery({
    queryKey: ["facility-entitlements", resolvedFacilityId],
    enabled: Boolean(resolvedFacilityId?.trim()),
    staleTime: 60_000,
    queryFn: () => fetchFacilityEntitlements(resolvedFacilityId!),
  });

  const entitlements = q.data?.entitlements;
  const bypass = superAdmin || Boolean(q.data?.bypassSubscriptionGate);

  const hasFeature = useCallback(
    (featureId: string) =>
      bypass || isFeatureEnabled(entitlements, featureId),
    [bypass, entitlements]
  );

  return {
    entitlements,
    hasFeature,
    bypassSubscriptionGate: bypass,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: q.refetch,
  };
}

const INPATIENT_PERMISSIONS = [
  "inpatient.read",
  "inpatient.create",
  "inpatient.update",
  "inpatient.delete",
] as const;

/**
 * Web sidebar parity for Inpatient / IPD:
 * (super admin OR any `inpatient.*`) AND plan feature `in-patient`.
 * While entitlements load, the plan half stays open (same as Practice sidebar).
 */
export function useCanAccessInpatient(facilityId?: string | null) {
  const user = useAuthUser();
  const { permissions, isLoading: permissionsLoading } =
    usePermissions(facilityId);
  const { hasFeature, isLoading: entitlementsLoading } =
    useFacilityEntitlements(facilityId);

  const canAccessByPermission =
    isSuperAdminUser(user) ||
    isFacilityAdminUser(user) ||
    INPATIENT_PERMISSIONS.some((key) => permissions.includes(key));

  const planAllows = entitlementsLoading || hasFeature("in-patient");

  return {
    canAccess: canAccessByPermission && planAllows,
    isLoading: permissionsLoading || entitlementsLoading,
  };
}

/**
 * Consult / clinical strip parity: non-doctors lose `consult.*` from the API.
 * Facility Admin / Super Admin keep access (and are not stripped server-side).
 */
export function useCanAccessConsult(facilityId?: string | null) {
  const { allowed, decided, denied } = useSectionAccess({
    resource: "consult",
    facilityId,
  });
  return {
    canAccess: allowed,
    isLoading: !decided,
    denied,
  };
}
