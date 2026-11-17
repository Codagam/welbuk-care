import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addConsultOrderLine,
  getConsultOrders,
  listOrderDestinations,
  listReceivingDoctors,
  patchConsultOrderDraft,
  removeConsultOrderLine,
  sendConsultOrderTab,
  type OrdersView,
} from "@/lib/api/endpoints/orders";
import { listReferrals, type ReferralRow } from "@/lib/api/endpoints/referral";

import type { OrderDraft, OrderKind } from "./orders";

export const consultOrdersQueryKey = (consultationId: string) => [
  "consult-orders",
  consultationId,
];

export function useConsultOrders(consultationId: string) {
  return useQuery({
    queryKey: consultOrdersQueryKey(consultationId),
    queryFn: () => getConsultOrders(consultationId),
    enabled: !!consultationId,
  });
}

/** Refetch the card plus everything a sent order changes (referrals, reports). */
export function useInvalidateConsultOrders(consultationId: string) {
  const qc = useQueryClient();
  return useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: consultOrdersQueryKey(consultationId) }),
      qc.invalidateQueries({ queryKey: ["consult-referrals"] }),
      qc.invalidateQueries({ queryKey: ["patient-referrals"] }),
    ]);
  }, [qc, consultationId]);
}

export function useOrderDestinations(
  facilityId: string,
  referralType: string | null,
  enabled: boolean
) {
  return useQuery({
    queryKey: ["referral-destinations", facilityId, referralType],
    queryFn: () => listOrderDestinations(facilityId, referralType ?? ""),
    enabled: enabled && !!facilityId && !!referralType,
    staleTime: 60_000,
  });
}

export function useReceivingDoctors(
  facilityId: string,
  toFacilityId: string | null,
  enabled: boolean
) {
  return useQuery({
    queryKey: ["receiving-doctors", facilityId, toFacilityId],
    queryFn: () => listReceivingDoctors(facilityId, toFacilityId!),
    enabled: enabled && !!facilityId && !!toFacilityId,
    staleTime: 60_000,
  });
}

export function useAddOrderLine(consultationId: string, kind: OrderKind) {
  return useMutation({
    mutationFn: (input: { testName?: string; treatmentTypeId?: string }) =>
      addConsultOrderLine({ consultationId, kind, ...input }),
  });
}

export function useRemoveOrderLine(consultationId: string) {
  return useMutation({
    mutationFn: (id: string) => removeConsultOrderLine(consultationId, id),
  });
}

/** Draft choices show at once; the server answer (or a refetch on error) settles them. */
export function usePatchOrderDraft(consultationId: string, kind: OrderKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<OrderDraft>) =>
      patchConsultOrderDraft({ consultationId, kind, ...patch }),
    onMutate: (patch) => {
      qc.setQueryData<OrdersView>(
        consultOrdersQueryKey(consultationId),
        (prev) => {
          if (!prev) return prev;
          const current = prev.tabs[kind].draft;
          const next: OrderDraft = { ...current, ...patch };
          // A doctor belongs to a facility: a new destination clears the old pick.
          if (
            "destinationFacilityId" in patch &&
            patch.destinationFacilityId !== current.destinationFacilityId
          ) {
            next.toDoctorId = null;
            next.toDoctorName = null;
          }
          return {
            ...prev,
            tabs: {
              ...prev.tabs,
              [kind]: { ...prev.tabs[kind], draft: next },
            },
          };
        }
      );
    },
  });
}

export function useSendOrderTab(consultationId: string, kind: OrderKind) {
  return useMutation({
    mutationFn: () => sendConsultOrderTab(consultationId, kind),
  });
}

export type ConsultReferralRow = {
  id: string;
  createdAt: string;
  referralType: string;
  tests: string[];
  status: string;
  direction: "incoming" | "outgoing";
};

/**
 * "Reports and earlier referrals" — the patient's referrals at this facility,
 * both directions, newest first (Practice consult page `loadReferrals`).
 */
export function useConsultReferrals(
  facilityId: string,
  patientId: string | undefined
) {
  return useQuery({
    queryKey: ["consult-referrals", facilityId, patientId],
    enabled: !!facilityId && !!patientId,
    queryFn: async (): Promise<ConsultReferralRow[]> => {
      const map = (
        rows: ReferralRow[],
        direction: "incoming" | "outgoing"
      ): ConsultReferralRow[] =>
        rows.map((r) => ({
          id: String(r.id ?? ""),
          createdAt: String(r.createdAt ?? ""),
          referralType: String(r.referralType ?? ""),
          tests: Array.isArray(r.tests)
            ? r.tests.map(String)
            : typeof r.tests === "string" && r.tests.trim()
              ? r.tests.split(",").map((t) => t.trim())
              : [],
          status: String(r.status ?? ""),
          direction,
        }));
      const [incoming, outgoing] = await Promise.all([
        listReferrals({ facilityId, patientId: patientId!, mode: "incoming" })
          .then((r) => map(r, "incoming"))
          .catch(() => [] as ConsultReferralRow[]),
        listReferrals({ facilityId, patientId: patientId!, mode: "outgoing" })
          .then((r) => map(r, "outgoing"))
          .catch(() => [] as ConsultReferralRow[]),
      ]);
      const deduped = Array.from(
        new Map(
          [...incoming, ...outgoing].filter((r) => r.id).map((r) => [r.id, r])
        ).values()
      );
      deduped.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return deduped;
    },
  });
}
