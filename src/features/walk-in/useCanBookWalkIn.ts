import { isReceptionistRole } from "@/lib/auth/roles";
import { useAuthUser, useFacilityId } from "@/lib/auth/store";
import { useCanCreate } from "@/features/permissions";

/**
 * Walk-in desk booking is a receptionist-only surface, and still needs the
 * Practice `appointment.create` permission the POST enforces.
 */
export function useCanBookWalkIn(): boolean {
  const user = useAuthUser();
  const facilityId = useFacilityId();
  const canCreateAppointment = useCanCreate("appointment");
  return isReceptionistRole(user, facilityId) && canCreateAppointment;
}
