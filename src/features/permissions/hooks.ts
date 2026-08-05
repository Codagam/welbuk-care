import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  fetchFacilityEntitlements,
  isFeatureEnabled,
} from "@/lib/api/endpoints/entitlements";
import { fetchPermissions } from "@/lib/api/endpoints/permissions";
import { isSuperAdminUser } from "@/lib/auth/roles";
import { useAuthUser, useFacilityId } from "@/lib/auth/store";

/** Effective permission keys for the active facility (Practice `/api/permissions`). */
export function usePermissions(facilityId?: string | null) {
  const user = useAuthUser();
  const activeFacilityId = useFacilityId();
  const resolvedFacilityId = facilityId ?? activeFacilityId;
  const enabled = Boolean(user);

  const q = useQuery({
    queryKey: ["permissions", user?.id, resolvedFacilityId],
    enabled,
    staleTime: 30_000,
    queryFn: () => fetchPermissions(resolvedFacilityId),
  });

  const permissions = q.data ?? [];
  const isLoading = !enabled || q.isPending;

  return {
    permissions,
    isLoading,
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
    INPATIENT_PERMISSIONS.some((key) => permissions.includes(key));

  const planAllows =
    entitlementsLoading || hasFeature("in-patient");

  return {
    canAccess: canAccessByPermission && planAllows,
    isLoading: permissionsLoading || entitlementsLoading,
  };
}
