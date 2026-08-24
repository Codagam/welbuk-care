import { api } from "@/lib/api/client";

export type FeatureMap = Record<string, boolean>;

export type FacilityEntitlements = {
  facilityId: string;
  subscriptionPlanId: string | null;
  subscriptionStatus: string;
  active: boolean;
  planFeatures: FeatureMap;
  featureOverrides: FeatureMap;
  effectiveFeatures: FeatureMap;
};

type EntitlementsResponse = {
  entitlements?: FacilityEntitlements;
  bypassSubscriptionGate?: boolean;
};

/** GET /api/facility/entitlements?facilityId= */
export function fetchFacilityEntitlements(
  facilityId: string
): Promise<EntitlementsResponse> {
  return api<EntitlementsResponse>({
    path: "/api/facility/entitlements",
    query: { facilityId },
  });
}

function getPracticeFeatureMap(entitlements: FacilityEntitlements): FeatureMap {
  if (entitlements.active) {
    return entitlements.effectiveFeatures ?? {};
  }

  const configured =
    Boolean(entitlements.subscriptionPlanId?.trim()) ||
    Object.keys(entitlements.featureOverrides ?? {}).length > 0;

  if (!configured) {
    return entitlements.effectiveFeatures ?? {};
  }

  const planFeatures =
    Object.keys(entitlements.planFeatures ?? {}).length > 0
      ? entitlements.planFeatures
      : (entitlements.effectiveFeatures ?? {});

  return { ...planFeatures, ...(entitlements.featureOverrides ?? {}) };
}

/** Mirrors Practice `isFeatureEnabled` (without plan-catalog fallback). */
export function isFeatureEnabled(
  entitlements: FacilityEntitlements | null | undefined,
  featureId: string
): boolean {
  if (!entitlements) return false;
  return getPracticeFeatureMap(entitlements)[featureId] === true;
}
