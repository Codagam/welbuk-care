import { useFacilityId } from "@/lib/auth/store";
import { usePatientHistory } from "@/features/consult/hooks";
import { LabsCard } from "@/features/consult/plan-of-care/components/LabsCard";

import { ConsultOrdersCard } from "./ConsultOrdersCard";
import { useConsultReferrals } from "./hooks";

/**
 * Orders & referrals: its own last section of the consult, after Plan of care,
 * as in Practice (consult page, CONSULT_SECTION_IDS.orders). It is the same
 * Labs card that used to sit inside Plan of care, with the same props, so
 * nothing about it behaves differently; it only moved.
 */
export function OrdersReferralsSection({
  consultationId,
  patientId,
  patientName,
}: {
  consultationId: string;
  patientId?: string;
  patientName?: string;
}) {
  const facilityId = useFacilityId() ?? "";
  // Same queries (and query keys) Plan of care uses, so they share the cache.
  const historyQ = usePatientHistory(patientId, consultationId);
  const referralsQ = useConsultReferrals(facilityId, patientId);

  const name =
    patientName ||
    (patientId ? `Patient ${patientId.slice(-6)}` : "Patient");

  return (
    <LabsCard
      labReports={historyQ.data?.labReports ?? []}
      patientName={name}
      referrals={referralsQ.data ?? []}
      ordersPanel={
        facilityId ? (
          <ConsultOrdersCard
            consultationId={consultationId}
            facilityId={facilityId}
          />
        ) : undefined
      }
    />
  );
}
