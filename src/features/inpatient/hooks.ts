import { useMemo } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  listFacilityDrugs,
  searchFacilityDrugs,
} from "@/lib/api/endpoints/drugs";
import {
  accountMedication,
  getInpatientAdmission,
  getInpatientAudit,
  getInpatientBill,
  getMedicationChart,
  listInpatientAdmissions,
  listInpatientNotes,
  listInpatientRateCard,
  listInpatientRooms,
  listInpatientVitals,
  pageInpatientStaff,
  postInpatientNote,
  postInpatientVitals,
  postMedicationAdministration,
  putInpatientBill,
  updateInpatientAdmission,
  type PostInpatientVitalsInput,
  type PutInpatientBillInput,
} from "@/lib/api/endpoints/inpatient";
import type { NoteKind, PageWho } from "./types";
import { useFacilityId } from "@/lib/auth/store";
import {
  drugToPickable,
  mapAdmissionToRow,
  rateCardToPickable,
} from "./utils";
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

/** Rate-card + facility drugs catalogs for the IP service search dropdown. */
export function useServicePickables() {
  const facilityId = useFacilityId();

  const rateCardQ = useQuery({
    queryKey: ["inpatient-rate-card", facilityId],
    enabled: !!facilityId,
    staleTime: 60_000,
    queryFn: ({ signal }) => listInpatientRateCard(facilityId!, signal),
  });

  const drugsQ = useQuery({
    queryKey: ["facility-drugs-catalog", facilityId],
    enabled: !!facilityId,
    staleTime: 60_000,
    queryFn: ({ signal }) => listFacilityDrugs(facilityId!, signal),
  });

  const pickables = useMemo(() => {
    const fromRate = (rateCardQ.data ?? []).map(rateCardToPickable);
    const fromDrugs = (drugsQ.data ?? []).map(drugToPickable);
    return [...fromRate, ...fromDrugs];
  }, [rateCardQ.data, drugsQ.data]);

  return {
    pickables,
    isLoading: rateCardQ.isLoading || drugsQ.isLoading,
    isError: rateCardQ.isError || drugsQ.isError,
    refetch: async () => {
      await Promise.all([rateCardQ.refetch(), drugsQ.refetch()]);
    },
  };
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

export function useInpatientRooms() {
  const facilityId = useFacilityId();
  return useQuery({
    queryKey: ["inpatient-rooms", facilityId],
    enabled: !!facilityId,
    staleTime: 30_000,
    queryFn: ({ signal }) => listInpatientRooms(facilityId!, signal),
  });
}

export function useWardVitals(admissionId: string | undefined) {
  const facilityId = useFacilityId();
  return useQuery({
    queryKey: ["ward-vitals", facilityId, admissionId],
    enabled: !!facilityId && !!admissionId,
    queryFn: ({ signal }) =>
      listInpatientVitals(facilityId!, admissionId!, signal),
  });
}

export function useRecordWardVitals(admissionId: string | undefined) {
  const qc = useQueryClient();
  const facilityId = useFacilityId();
  return useMutation({
    mutationFn: (
      fields: Omit<PostInpatientVitalsInput, "facilityId" | "admissionId">
    ) => {
      if (!admissionId || !facilityId) throw new Error("admissionId is required");
      return postInpatientVitals({ facilityId, admissionId, ...fields });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ward-vitals", facilityId, admissionId] });
      qc.invalidateQueries({
        queryKey: ["inpatient-audit", facilityId, admissionId],
      });
    },
  });
}

export function useWardNotes(admissionId: string | undefined) {
  const facilityId = useFacilityId();
  return useQuery({
    queryKey: ["ward-notes", facilityId, admissionId],
    enabled: !!facilityId && !!admissionId,
    queryFn: ({ signal }) =>
      listInpatientNotes(facilityId!, admissionId!, signal),
  });
}

export function useAddWardNote(admissionId: string | undefined) {
  const qc = useQueryClient();
  const facilityId = useFacilityId();
  return useMutation({
    mutationFn: (input: { body: string; kind: NoteKind }) => {
      if (!admissionId || !facilityId) throw new Error("admissionId is required");
      return postInpatientNote({
        facilityId,
        admissionId,
        body: input.body,
        kind: input.kind,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ward-notes", facilityId, admissionId] });
      qc.invalidateQueries({
        queryKey: ["inpatient-audit", facilityId, admissionId],
      });
    },
  });
}

export function useMedicationChart(admissionId: string | undefined) {
  const facilityId = useFacilityId();
  return useQuery({
    queryKey: ["med-chart", facilityId, admissionId],
    enabled: !!facilityId && !!admissionId,
    queryFn: ({ signal }) =>
      getMedicationChart(facilityId!, admissionId!, signal),
  });
}

const DRUG_SEARCH_PAGE_SIZE = 10;

/** Paginated GET /api/drugs?q= — empty q still returns page 1. */
export function useFacilityDrugSearch(q: string, enabled: boolean) {
  const facilityId = useFacilityId();
  return useInfiniteQuery({
    queryKey: ["facility-drugs-search", facilityId, q],
    enabled: !!facilityId && enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      searchFacilityDrugs(
        facilityId!,
        { q, page: pageParam, pageSize: DRUG_SEARCH_PAGE_SIZE },
        signal
      ),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
}

export function useRecordDose(admissionId: string | undefined) {
  const qc = useQueryClient();
  const facilityId = useFacilityId();
  return useMutation({
    mutationFn: (input: {
      drugId: string;
      quantity: number;
      route?: string | null;
    }) => {
      if (!admissionId || !facilityId) throw new Error("admissionId is required");
      return postMedicationAdministration({
        facilityId,
        admissionId,
        ...input,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["med-chart", facilityId, admissionId] });
      qc.invalidateQueries({
        queryKey: ["inpatient-audit", facilityId, admissionId],
      });
    },
  });
}

export function useAccountMedication(admissionId: string | undefined) {
  const qc = useQueryClient();
  const facilityId = useFacilityId();
  return useMutation({
    mutationFn: (input: {
      drugId: string;
      quantity: number;
      outcome: "RETURNED" | "CONSUMED";
      notes?: string | null;
    }) => {
      if (!admissionId || !facilityId) throw new Error("admissionId is required");
      return accountMedication({ facilityId, admissionId, ...input });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["med-chart", facilityId, admissionId] });
    },
  });
}

export function usePageStaff(admissionId: string | undefined) {
  const facilityId = useFacilityId();
  return useMutation({
    mutationFn: (input: {
      who: PageWho;
      reason?: string | null;
      urgent?: boolean;
    }) => {
      if (!admissionId || !facilityId) throw new Error("admissionId is required");
      return pageInpatientStaff({
        facilityId,
        admissionId,
        who: input.who,
        reason: input.reason,
        urgent: input.urgent,
      });
    },
  });
}

export function useInpatientAudit(admissionId: string | undefined) {
  const facilityId = useFacilityId();
  return useQuery({
    queryKey: ["inpatient-audit", facilityId, admissionId],
    enabled: !!facilityId && !!admissionId,
    queryFn: ({ signal }) =>
      getInpatientAudit(admissionId!, facilityId!, signal),
    retry: false,
  });
}

export function useUpdateAttender(admissionId: string | undefined) {
  const qc = useQueryClient();
  const facilityId = useFacilityId();
  return useMutation({
    mutationFn: (input: {
      attenderName: string;
      attenderPhone: string;
      attenderRelation: string;
    }) => {
      if (!admissionId || !facilityId) throw new Error("admissionId is required");
      return updateInpatientAdmission(admissionId, {
        facilityId,
        attenderName: input.attenderName,
        attenderPhone: input.attenderPhone,
        attenderRelation: input.attenderRelation,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inpatient-admission", admissionId] });
      qc.invalidateQueries({ queryKey: ["inpatient-admissions"] });
    },
  });
}
