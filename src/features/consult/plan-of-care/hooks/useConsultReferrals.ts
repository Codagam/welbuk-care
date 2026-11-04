import { useQuery } from "@tanstack/react-query";

import { listReferrals } from "@/lib/api/endpoints/referral";
import { useFacilityId } from "@/lib/auth/store";

import { buildReferralRows } from "../labsTable";

/**
 * This patient's referrals at this facility, in both directions, as Practice's consult
 * page loads them. One direction failing leaves the other showing.
 */
export function useConsultReferrals(patientId?: string) {
  const facilityId = useFacilityId();
  return useQuery({
    queryKey: ["consult-referrals", patientId, facilityId],
    enabled: !!patientId && !!facilityId,
    queryFn: async () => {
      const fetchMode = (mode: "incoming" | "outgoing") =>
        listReferrals({
          facilityId: facilityId!,
          patientId: patientId!,
          mode,
        }).catch(() => []);
      const [incoming, outgoing] = await Promise.all([
        fetchMode("incoming"),
        fetchMode("outgoing"),
      ]);
      return buildReferralRows(incoming, outgoing);
    },
  });
}
