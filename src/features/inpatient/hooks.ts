import { useMemo } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  getInpatientAdmission,
  getInpatientBill,
  listInpatientAdmissions,
  listInpatientRateCard,
  putInpatientBill,
  updateInpatientAdmission,
  type PutInpatientBillInput,
} from "@/lib/api/endpoints/inpatient";
import { useFacilityId } from "@/lib/auth/store";
import { mapAdmissionToRow } from "./utils";
import type { BillStatusQuery, InpatientListRow } from "./types";

export type InpatientStatusFilter = "admitted" | "all";

/** Facility census — unbounded list; filter ADMITTED client-side. */
export function useInpatientAdmissions(
  filter: InpatientStatusFilter = "admitted"
) {
  const facilityId = useFacilityId();

  const q = useQuery({
    queryKey: ["inpatient-admissions", facilityId],
    enabled: !!facilityId,
    queryFn: ({ signal }) => listInpatientAdmissions(facilityId!, signal),
  });

  const rows: InpatientListRow[] = useMemo(() => {
    const mapped = (q.data ?? []).map(mapAdmissionToRow);
    if (filter === "admitted") {
      return mapped.filter((r) => r.statusKey === "admitted");
    }
    return mapped;
  }, [q.data, filter]);

  const admittedCount = useMemo(
    () => (q.data ?? []).filter((a) => a.status !== "DISCHARGED").length,
    [q.data]
  );

  return {
    ...q,
    rows,
    admittedCount,
    totalCount: q.data?.length ?? 0,
  };
}

/** Single admission — route id may be ipSerial or Mongo id. */
export function useInpatientAdmission(admissionId: string | undefined) {
  const facilityId = useFacilityId();
  return useQuery({
    queryKey: ["inpatient-admission", admissionId, facilityId],
    enabled: !!admissionId && !!facilityId,
    queryFn: ({ signal }) =>
      getInpatientAdmission(admissionId!, facilityId!, signal),
  });
}

/**
 * Hydrate bill like Practice IPBillingClient:
 * discharged → final then draft; admitted → draft then final.
 */
export function useInpatientBillHydration(
  admissionId: string | undefined,
  admissionStatus: string | undefined
) {
  const facilityId = useFacilityId();
  const isDischarged = String(admissionStatus ?? "").toUpperCase() === "DISCHARGED";
  const statuses: BillStatusQuery[] = isDischarged
    ? ["final", "draft"]
    : ["draft", "final"];

  return useQuery({
    queryKey: [
      "inpatient-bill-hydrate",
      admissionId,
      facilityId,
      isDischarged ? "discharged" : "admitted",
    ],
    enabled: !!admissionId && !!facilityId && !!admissionStatus,
    queryFn: async ({ signal }) => {
      for (const status of statuses) {
        const bill = await getInpatientBill(
          admissionId!,
          facilityId!,
          status,
          signal
        );
        if (bill?.items && Array.isArray(bill.items) && bill.items.length > 0) {
          return { bill, status };
        }
      }
      return { bill: null, status: null as BillStatusQuery | null };
    },
  });
}

export function useInpatientRateCard() {
  const facilityId = useFacilityId();
  return useQuery({
    queryKey: ["inpatient-rate-card", facilityId],
    enabled: !!facilityId,
    staleTime: 60_000,
    queryFn: ({ signal }) => listInpatientRateCard(facilityId!, signal),
  });
}

export function useSaveInpatientBill(admissionId: string | undefined) {
  const qc = useQueryClient();
  const facilityId = useFacilityId();

  return useMutation({
    mutationFn: (input: Omit<PutInpatientBillInput, "facilityId">) => {
      if (!admissionId) throw new Error("admissionId is required");
      if (!facilityId) throw new Error("facilityId is required");
      return putInpatientBill(admissionId, { ...input, facilityId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inpatient-bill-hydrate", admissionId] });
      qc.invalidateQueries({ queryKey: ["inpatient-admission", admissionId] });
      qc.invalidateQueries({ queryKey: ["inpatient-admissions"] });
    },
  });
}

export function useDischargeAdmission(admissionId: string | undefined) {
  const qc = useQueryClient();
  const facilityId = useFacilityId();

  return useMutation({
    mutationFn: (dischargeDate: string) => {
      if (!admissionId) throw new Error("admissionId is required");
      if (!facilityId) throw new Error("facilityId is required");
      return updateInpatientAdmission(admissionId, {
        facilityId,
        status: "DISCHARGED",
        dischargeDate,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inpatient-admission", admissionId] });
      qc.invalidateQueries({ queryKey: ["inpatient-admissions"] });
      qc.invalidateQueries({ queryKey: ["inpatient-bill-hydrate", admissionId] });
    },
  });
}
