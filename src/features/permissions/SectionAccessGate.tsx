import { useEffect, type ReactNode } from "react";
import { Alert } from "react-native";

import { useSectionAccess } from "./hooks";
import { NoAccess, SectionAccessLoading } from "./NoAccess";

type SectionAccessGateProps = {
  /**
   * Permission resource(s) for `.read` (e.g. `consult`, `patient`).
   * Pass several to allow if the user can read any of them.
   */
  resource?: string | string[];
  /** Extra permission keys that also grant access. */
  anyPermissionKeys?: string[];
  /** Named in the "no access" message. */
  sectionLabel: string;
  children: ReactNode;
  /** Extra allow (computed by parent). */
  extraAllow?: boolean;
  /** Facility Admin / Super Admin bypass. Default true. */
  allowElevatedAdmin?: boolean;
  /** Only Facility Admin / Super Admin. */
  elevatedAdminOnly?: boolean;
  facilityId?: string | null;
};

/**
 * Blocks direct route entry when the role cannot use the section.
 * Three states: loading → allowed children → quiet NoAccess (never flash deny).
 * @see Practice `components/auth/section-access-gate.tsx`
 */
export function SectionAccessGate({
  resource,
  anyPermissionKeys,
  sectionLabel,
  children,
  extraAllow,
  allowElevatedAdmin,
  elevatedAdminOnly,
  facilityId,
}: SectionAccessGateProps) {
  const { decided, denied } = useSectionAccess({
    resource,
    anyPermissionKeys,
    extraAllow,
    allowElevatedAdmin,
    elevatedAdminOnly,
    facilityId,
  });

  useEffect(() => {
    if (!denied) return;
    Alert.alert(
      "You don't have permission",
      `${sectionLabel} isn't available for your role. Ask a facility administrator if you need access.`
    );
  }, [denied, sectionLabel]);

  if (!decided) {
    return <SectionAccessLoading label={sectionLabel} />;
  }

  if (denied) {
    return <NoAccess sectionLabel={sectionLabel} />;
  }

  return <>{children}</>;
}
