import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";

import {
  getDental,
  getDiagnosisTypes,
  getFacilityTreatments,
  patchDentalPlan,
  postDentalFindings,
  putDentalFull,
} from "@/lib/api/endpoints/dental";
import { ApiError, describeError } from "@/lib/api/errors";
import { queryClient } from "@/lib/query";
import {
  CONSULT_LOCKED_MESSAGE,
  refetchConsultIfCompletedLock,
} from "@/features/consult/consultLock";
import { PROBLEM_TYPES } from "./problems";
import type {
  BillingSync,
  DentalTreatmentPlanRow,
  DiagnosisDetailsEntry,
  DiagnosisOption,
  TeethStates,
  TreatmentCatalogItem,
} from "./types";
import {
  deriveTeethStates,
  entriesToPostBody,
  mapRawToDiagnosisEntries,
  mapRawToPlanRows,
  mergeSuggestedTreatmentsFromPrior,
  cloneFindingsToTeeth,
  filterPlanRowsAfterRemovingTooth,
  planRowsWithClonedDiagnosisLinks,
  treatmentOrderFromEntries,
} from "./utils";
import type { DentalDiagnosisClonePair } from "./utils";

const AUTOSAVE_MS = 60_000;

export const PAID_LOCK_MESSAGE =
  "This treatment is done and paid, so it can no longer be changed.";

const STATIC_OPTIONS: DiagnosisOption[] = PROBLEM_TYPES.map((p) => ({
  value: p.value,
  label: p.label,
}));

type Options = {
  consultationId: string;
  appointmentId?: string;
  facilityId?: string;
  enabled?: boolean;
  priorDentalConsultationId?: string | null;
  defaultDoctorId?: string;
  locked?: boolean;
};

export function useDentalDiagnosis({
  consultationId,
  appointmentId,
  facilityId,
  enabled = true,
  priorDentalConsultationId = null,
  defaultDoctorId = "",
  locked = false,
}: Options) {
  const [entries, setEntries] = useState<DiagnosisDetailsEntry[]>([]);
  const [planItems, setPlanItems] = useState<DentalTreatmentPlanRow[]>([]);
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
  const [findingsOpen, setFindingsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  /** The consult's treatment line is fully paid, as the server last reported. */
  const [treatmentPaid, setTreatmentPaid] = useState(false);
  const [diagnosisTypes, setDiagnosisTypes] = useState<DiagnosisOption[] | null>(
    null
  );

  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const planRef = useRef(planItems);
  planRef.current = planItems;

  const catalogQuery = useQuery({
    queryKey: ["facility-treatments", facilityId],
    enabled: enabled && !!facilityId,
    staleTime: 5 * 60_000,
    queryFn: () => getFacilityTreatments(facilityId!),
  });

  const catalog: TreatmentCatalogItem[] = catalogQuery.data ?? [];

  useEffect(() => {
    if (!enabled) return;
    getDiagnosisTypes("dental")
      .then((data) => setDiagnosisTypes(data.diagnosisTypes))
      .catch(() => setDiagnosisTypes([]));
  }, [enabled]);

  const diagnosisOptions = useMemo(
    () =>
      diagnosisTypes != null && diagnosisTypes.length > 0
        ? diagnosisTypes
        : STATIC_OPTIONS,
    [diagnosisTypes]
  );

  const reload = useCallback(async () => {
    if (!consultationId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getDental(consultationId);
      setTreatmentPaid(data.treatmentPaid);
      let parsed = data.treatmentEntries;
      const priorTrim = (priorDentalConsultationId ?? "").trim();
      const priorOk =
        /^[0-9a-fA-F]{24}$/.test(priorTrim) &&
        priorTrim !== consultationId;

      if (priorOk) {
        try {
          const prior = await getDental(priorTrim);
          if (parsed.length === 0 && prior.treatmentEntries.length > 0) {
            parsed = prior.treatmentEntries;
          } else if (parsed.length > 0 && prior.treatmentEntries.length > 0) {
            parsed = mergeSuggestedTreatmentsFromPrior(
              parsed,
              prior.treatmentEntries
            );
          }
          if (
            data.treatmentPlanItems.length === 0 &&
            prior.treatmentPlanItems.length > 0
          ) {
            setPlanItems(prior.treatmentPlanItems);
          } else {
            setPlanItems(data.treatmentPlanItems);
          }
        } catch {
          setPlanItems(data.treatmentPlanItems);
        }
      } else {
        setPlanItems(data.treatmentPlanItems);
      }
      setEntries(parsed);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }, [consultationId, enabled, priorDentalConsultationId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * DONE + PAID = LOCKED. Read off the SAVED row: the editor's own status moves as
   * treated items are ticked. Paid is per consult because the whole plan bills as one
   * line, so a treatment added later can unlock this row again, as in Practice.
   */
  const isRowPaidLocked = useCallback(
    (rowId: string | null | undefined): boolean =>
      treatmentPaid &&
      planItems.some((p) => p.id === rowId && p.status === "done"),
    [treatmentPaid, planItems]
  );

  /** Removing a finding takes its plan row with it; the server keeps a paid one. */
  const findingsHavePaidRow = useCallback(
    (entryIds: Set<string>): boolean =>
      treatmentPaid &&
      planRef.current.some(
        (p) =>
          p.status === "done" &&
          !!p.diagnosisEntryId &&
          entryIds.has(p.diagnosisEntryId)
      ),
    [treatmentPaid]
  );

  const chartTeethStates = useMemo<TeethStates>(
    () => deriveTeethStates(entries),
    [entries]
  );

  const treatedToothIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of planItems) {
      if (p.status !== "done") continue;
      const tooth = p.findingSummary?.tooth?.replace(/^Tooth\s+/i, "").trim();
      if (tooth) ids.add(tooth);
      const linked = entries.find((e) => e.id === p.diagnosisEntryId);
      if (linked?.toothId) ids.add(linked.toothId);
    }
    return ids;
  }, [planItems, entries]);

  const openTooth = useCallback((toothId: string) => {
    if (locked) return;
    setSelectedTooth(toothId);
    setFindingsOpen(true);
  }, [locked]);

  const closeFindings = useCallback(() => {
    setFindingsOpen(false);
  }, []);

  const saveFindings = useCallback(
    async (
      nextEntries: DiagnosisDetailsEntry[],
      options?: { cloneToToothIds?: string[] }
    ): Promise<boolean> => {
      if (!appointmentId) {
        setError("Missing appointmentId — cannot save findings.");
        return false;
      }
      if (locked) {
        setError(CONSULT_LOCKED_MESSAGE);
        return false;
      }
      setSaving(true);
      setError(null);
      setStatusMsg(null);
      try {
        let toSave = nextEntries;
        let clonedPairs: DentalDiagnosisClonePair[] = [];
        let skippedCount = 0;

        if (
          selectedTooth &&
          options?.cloneToToothIds &&
          options.cloneToToothIds.length > 0
        ) {
          const cloned = cloneFindingsToTeeth(
            nextEntries,
            selectedTooth,
            options.cloneToToothIds
          );
          toSave = cloned.entries;
          clonedPairs = cloned.clonedPairs;
          skippedCount = cloned.skippedCount;
        }

        await postDentalFindings({
          appointmentId,
          teethStates: deriveTeethStates(toSave),
          treatmentOrder: treatmentOrderFromEntries(toSave),
          treatmentEntries: entriesToPostBody(toSave),
        });
        setEntries(toSave);

        if (clonedPairs.length > 0 && consultationId) {
          const nextPlan = planRowsWithClonedDiagnosisLinks(
            planRef.current,
            clonedPairs
          );
          if (nextPlan.length > planRef.current.length) {
            await patchDentalPlan(consultationId, nextPlan);
            setPlanItems(nextPlan);
          }
        }

        const msgs: string[] = ["Findings saved."];
        if (clonedPairs.length > 0) {
          msgs.push(`Cloned to ${clonedPairs.length} finding(s).`);
        }
        if (skippedCount > 0) {
          msgs.push(
            `Skipped ${skippedCount} duplicate tooth/condition pair(s).`
          );
        }
        setStatusMsg(msgs.join(" "));
        setFindingsOpen(false);
        return true;
      } catch (e) {
        refetchConsultIfCompletedLock(queryClient, consultationId, e);
        setError(describeError(e));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [appointmentId, selectedTooth, consultationId, locked]
  );

  const deleteFinding = useCallback(
    async (id: string): Promise<boolean> => {
      if (findingsHavePaidRow(new Set([id]))) {
        setError(PAID_LOCK_MESSAGE);
        return false;
      }
      const next = entriesRef.current.filter((e) => e.id !== id);
      const ok = await saveFindings(next);
      if (ok) {
        // Drop linked plan rows for deleted finding
        setPlanItems((prev) =>
          prev.filter((p) => p.diagnosisEntryId !== id)
        );
      }
      return ok;
    },
    [saveFindings, findingsHavePaidRow]
  );

  const clearTooth = useCallback(
    async (toothId: string): Promise<boolean> => {
      const removed = entriesRef.current.filter((e) => e.toothId === toothId);
      const removedIds = new Set(removed.map((e) => e.id));
      if (findingsHavePaidRow(removedIds)) {
        setError(PAID_LOCK_MESSAGE);
        return false;
      }
      const next = entriesRef.current.filter((e) => e.toothId !== toothId);
      const nextPlan = filterPlanRowsAfterRemovingTooth(
        planRef.current,
        toothId,
        removedIds
      );
      if (!appointmentId) return false;
      if (locked) {
        setError(CONSULT_LOCKED_MESSAGE);
        return false;
      }
      setSaving(true);
      try {
        await postDentalFindings({
          appointmentId,
          teethStates: deriveTeethStates(next),
          treatmentOrder: treatmentOrderFromEntries(next),
          treatmentEntries: entriesToPostBody(next),
        });
        if (consultationId) {
          await putDentalFull({
            consultationId,
            teethStates: deriveTeethStates(next),
            treatmentOrder: treatmentOrderFromEntries(next),
            treatmentEntries: entriesToPostBody(next),
            treatmentPlanItems: nextPlan,
          });
        }
        setEntries(next);
        setPlanItems(nextPlan);
        setFindingsOpen(false);
        setStatusMsg("Tooth cleared.");
        return true;
      } catch (e) {
        refetchConsultIfCompletedLock(queryClient, consultationId, e);
        setError(describeError(e));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [appointmentId, consultationId, locked, findingsHavePaidRow]
  );

  const persistFull = useCallback(
    async (
      planOverride?: DentalTreatmentPlanRow[]
    ): Promise<boolean> => {
      if (!consultationId) return false;
      // No dental chart on this consult: Complete must not write an empty one.
      if (locked || !enabled) return true;
      const toSave = entriesRef.current;
      const plan = planOverride ?? planRef.current;
      try {
        await putDentalFull({
          consultationId,
          teethStates: deriveTeethStates(toSave),
          treatmentOrder: treatmentOrderFromEntries(toSave),
          treatmentEntries: entriesToPostBody(toSave),
          treatmentPlanItems: plan,
        });
        return true;
      } catch (e) {
        refetchConsultIfCompletedLock(queryClient, consultationId, e);
        return false;
      }
    },
    [consultationId, locked, enabled]
  );

  const flushDental = useCallback(async (): Promise<boolean> => {
    return persistFull();
  }, [persistFull]);

  // Autosave every 60s
  useEffect(() => {
    if (!enabled || !consultationId || locked) return;
    const id = setInterval(() => {
      void persistFull();
    }, AUTOSAVE_MS);
    return () => clearInterval(id);
  }, [enabled, consultationId, persistFull, locked]);

  const savePlan = useCallback(
    async (
      nextPlan: DentalTreatmentPlanRow[]
    ): Promise<BillingSync | null> => {
      if (!consultationId) {
        setError("Missing consultationId");
        return null;
      }
      if (locked) {
        setError(CONSULT_LOCKED_MESSAGE);
        return null;
      }
      setSaving(true);
      setError(null);
      setStatusMsg(null);
      try {
        const res = await patchDentalPlan(consultationId, nextPlan);
        setPlanItems(nextPlan);
        setStatusMsg(null);
        return res.billingSync ?? null;
      } catch (e) {
        refetchConsultIfCompletedLock(queryClient, consultationId, e);
        // The desk took payment after this screen loaded. Show what the server has,
        // so the row reads locked and the edit does not sit there looking saved.
        if (e instanceof ApiError && e.serverCode === "TREATMENT_PAID_LOCKED") {
          await reload();
        }
        setError(describeError(e));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [consultationId, locked, reload]
  );

  return {
    loading,
    saving,
    error,
    statusMsg,
    setStatusMsg,
    setError,
    entries,
    setEntries,
    planItems,
    setPlanItems,
    chartTeethStates,
    treatedToothIds,
    selectedTooth,
    findingsOpen,
    openTooth,
    closeFindings,
    setFindingsOpen,
    diagnosisOptions,
    catalog,
    catalogLoading: catalogQuery.isLoading,
    facilityId,
    defaultDoctorId,
    saveFindings,
    deleteFinding,
    clearTooth,
    savePlan,
    flushDental,
    persistFull,
    reload,
    locked,
    treatmentPaid,
    isRowPaidLocked,
  };
}

/** Lightweight catalog-only hook for plan sheet. */
export function useTreatmentCatalog(facilityId?: string) {
  return useQuery({
    queryKey: ["facility-treatments", facilityId],
    enabled: !!facilityId,
    staleTime: 5 * 60_000,
    queryFn: () => getFacilityTreatments(facilityId!),
  });
}

// Re-export mappers used by older hooks file consumers
export { mapRawToDiagnosisEntries, mapRawToPlanRows };
