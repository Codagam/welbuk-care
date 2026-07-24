import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createPrescriptionTemplate,
  finalizePrescription,
  getPrescriptions,
  getPrescriptionTemplates,
  patchPrescriptionAttachmentUrls,
  updatePrescriptionTemplate,
  validateConsultPrescription,
} from "@/lib/api/endpoints/prescription";
import { searchDrugs, type DrugCatalogItem } from "@/lib/api/endpoints/drugs";
import { uploadFile } from "@/lib/api/endpoints/recording";
import { useFacilityId } from "@/lib/auth/store";
import type { Prescription } from "@/features/consult/types";

import { matchPrescriptionLinesToAllergies } from "../allergy";
import {
  clearPrescriptionDraft,
  loadPrescriptionDraft,
  mergePrescriptions,
  newPrescriptionId,
  savePrescriptionDraft,
} from "../prescriptionDraftStore";
import type { AttachedRxImage, PlanPrescription } from "../types";

function toPlanLine(p: Prescription): PlanPrescription {
  return {
    id: p.id,
    name: p.name,
    dosePattern: p.dosePattern ?? "1-0-1",
    foodTiming: p.foodTiming ?? "AF",
    duration: String(p.duration ?? "1"),
    drugId: p.drugId,
    isAttachment: p.isAttachment,
  };
}

export function useDrugCatalog(enabled = true) {
  const facilityId = useFacilityId();
  return useQuery({
    queryKey: ["drug-catalog", facilityId],
    enabled: enabled && !!facilityId,
    staleTime: 10 * 60_000,
    queryFn: () =>
      searchDrugs({
        facilityId: facilityId!,
        page: 1,
        pageSize: 1000,
        sortBy: "brandName",
        sortOrder: "asc",
      }).then((r) => r.drugs),
  });
}

export function filterDrugCatalog(
  drugs: DrugCatalogItem[],
  query: string
): DrugCatalogItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return drugs.slice(0, 40);
  return drugs
    .filter((d) => {
      const brand = (d.brandName ?? "").toLowerCase();
      const generic = (d.genericName ?? "").toLowerCase();
      return brand.includes(q) || generic.includes(q);
    })
    .slice(0, 40);
}

export function usePrescriptionTemplates(consultationId: string) {
  return useQuery({
    queryKey: ["prescription-templates", consultationId],
    enabled: !!consultationId,
    queryFn: () => getPrescriptionTemplates(consultationId),
  });
}

export function usePrescriptionDraft(consultationId: string) {
  const [prescriptions, setPrescriptionsState] = useState<PlanPrescription[]>(
    []
  );
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [attachedImages, setAttachedImages] = useState<AttachedRxImage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apiQ = useQuery({
    queryKey: ["prescriptions", consultationId],
    enabled: !!consultationId,
    queryFn: () => getPrescriptions(consultationId),
  });

  const hydratedForId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (!consultationId) return;
      // Wait for first successful API load (or allow draft-only if API already settled)
      if (!apiQ.isFetched) return;
      if (hydratedForId.current === consultationId) return;

      const draft = await loadPrescriptionDraft(consultationId);
      if (cancelled) return;
      const apiLines = (apiQ.data?.prescriptions ?? []).map(toPlanLine);
      const urls = apiQ.data?.prescriptionAttachmentUrls ?? [];
      setAttachmentUrls(urls);
      setAttachedImages(
        urls.map((url, i) => ({ id: `att-${i}-${url.slice(-12)}`, url }))
      );
      setPrescriptionsState(mergePrescriptions(apiLines, draft));
      hydratedForId.current = consultationId;
      setHydrated(true);
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [consultationId, apiQ.data, apiQ.isFetched]);

  useEffect(() => {
    // Reset hydration gate when consultation changes
    if (hydratedForId.current !== consultationId) {
      setHydrated(false);
    }
  }, [consultationId]);

  const persist = useCallback(
    (next: PlanPrescription[]) => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        void savePrescriptionDraft(consultationId, next);
      }, 200);
    },
    [consultationId]
  );

  const setPrescriptions = useCallback(
    (
      updater:
        | PlanPrescription[]
        | ((prev: PlanPrescription[]) => PlanPrescription[])
    ) => {
      setPrescriptionsState((prev) => {
        const next =
          typeof updater === "function" ? updater(prev) : updater;
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const addPrescription = useCallback(
    (item: Omit<PlanPrescription, "id"> & { id?: string }) => {
      const row: PlanPrescription = {
        id: item.id ?? newPrescriptionId(),
        name: item.name.trim(),
        dosePattern: item.dosePattern.trim(),
        foodTiming: item.foodTiming,
        duration: String(item.duration).trim(),
        drugId: item.drugId,
      };
      setPrescriptions((prev) => [...prev, row]);
      return row;
    },
    [setPrescriptions]
  );

  const updatePrescription = useCallback(
    (id: string, patch: Partial<PlanPrescription>) => {
      setPrescriptions((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
      );
    },
    [setPrescriptions]
  );

  const removePrescription = useCallback(
    (id: string) => {
      setPrescriptions((prev) => prev.filter((p) => p.id !== id));
    },
    [setPrescriptions]
  );

  const applyTemplateMeds = useCallback(
    (
      meds: Array<{
        name: string;
        dosePattern: string;
        foodTiming: string;
        duration: string;
      }>
    ) => {
      const rows: PlanPrescription[] = meds.map((m) => ({
        id: newPrescriptionId(),
        name: m.name,
        dosePattern: m.dosePattern,
        foodTiming: m.foodTiming,
        duration: m.duration,
      }));
      setPrescriptions(rows);
    },
    [setPrescriptions]
  );

  const clearDraft = useCallback(async () => {
    await clearPrescriptionDraft(consultationId);
  }, [consultationId]);

  return {
    prescriptions,
    setPrescriptions,
    addPrescription,
    updatePrescription,
    removePrescription,
    applyTemplateMeds,
    attachmentUrls,
    setAttachmentUrls,
    attachedImages,
    setAttachedImages,
    clearDraft,
    hydrated,
    isLoading: apiQ.isLoading && !hydrated,
    refetchApi: apiQ.refetch,
  };
}

export function useAttachPrescription(consultationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (files: Array<{
      uri: string;
      name: string;
      mimeType: string;
    }>) => {
      const urls: string[] = [];
      for (const f of files) {
        const uploaded = await uploadFile(
          f.uri,
          f.name,
          f.mimeType,
          "consult_prescription",
          { consultationId }
        );
        urls.push(...uploaded);
      }
      return urls;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prescriptions", consultationId] });
      qc.invalidateQueries({ queryKey: ["summary", consultationId] });
    },
  });
}

export function usePatchRxAttachments(consultationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (urls: string[]) =>
      patchPrescriptionAttachmentUrls(consultationId, urls),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prescriptions", consultationId] });
      qc.invalidateQueries({ queryKey: ["summary", consultationId] });
    },
  });
}

export function useSaveTemplate(consultationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      templateName: string;
      medications: Array<{
        name: string;
        dosePattern: string;
        foodTiming: string;
        duration: string;
      }>;
      mode: "create" | "update";
    }) => {
      const payload = {
        consultationId,
        templateName: body.templateName,
        medications: body.medications,
      };
      return body.mode === "create"
        ? createPrescriptionTemplate(payload)
        : updatePrescriptionTemplate(payload);
    },
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["prescription-templates", consultationId],
      }),
  });
}

export function useCompletePrescription(consultationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      appointmentId?: string;
      patientId?: string;
      prescriptions: PlanPrescription[];
      attachmentUrls?: string[];
      allergyOverrideAck?: boolean;
      skipValidate?: boolean;
    }) => {
      const meds = args.prescriptions
        .filter((p) => (p.name ?? "").trim().length > 0 && !p.isAttachment)
        .map((p) => ({
          name: p.name.trim(),
          dosePattern: p.dosePattern,
          foodTiming: p.foodTiming,
          duration: String(p.duration),
          drugId: p.drugId,
        }));

      if (
        !args.skipValidate &&
        meds.length > 0 &&
        args.patientId?.trim()
      ) {
        const v = await validateConsultPrescription({
          consultationId,
          patientId: args.patientId.trim(),
          medications: meds.map((m) => ({ drugName: m.name })),
          override: args.allergyOverrideAck === true,
        });
        if (v.blocked) {
          throw new Error(
            "Prescription blocked by allergy check. Acknowledge the warning to override."
          );
        }
      }

      return finalizePrescription({
        consultationId,
        appointmentId: args.appointmentId,
        patientId: args.patientId,
        prescriptions: meds,
        attachmentUrls: args.attachmentUrls,
      });
    },
    onSuccess: async () => {
      await clearPrescriptionDraft(consultationId);
      qc.invalidateQueries({ queryKey: ["prescriptions", consultationId] });
      qc.invalidateQueries({ queryKey: ["consultation", consultationId] });
      qc.invalidateQueries({ queryKey: ["summary", consultationId] });
      qc.invalidateQueries({ queryKey: ["queue"] });
    },
  });
}

export function useAllergyGate(
  prescriptions: PlanPrescription[],
  allergies: Array<{ name: string; severity?: string }> | undefined | null,
  drugs: DrugCatalogItem[] | undefined
) {
  const namesKey = prescriptions.map((p) => p.name).join("|");

  const warnings = useMemo(() => {
    const list =
      allergies
        ?.map((a) => ({
          name: typeof a === "string" ? a : a.name,
          severity:
            typeof a === "object" && a && "severity" in a
              ? a.severity
              : null,
        }))
        .filter((a) => a.name?.trim()) ?? [];
    const lines = prescriptions
      .filter((p) => (p.name ?? "").trim())
      .map((p) => {
        const drug = drugs?.find((d) => d.id === p.drugId);
        return {
          drugName: p.name,
          drugClass: drug?.drugClass ?? null,
          genericName: drug?.genericName ?? null,
        };
      });
    return matchPrescriptionLinesToAllergies(lines, list).warnings;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- namesKey captures Rx identity
  }, [namesKey, allergies, drugs]);

  const [allergyOverrideAck, setAllergyOverrideAck] = useState(false);

  useEffect(() => {
    setAllergyOverrideAck(false);
  }, [allergies, namesKey]);

  const hasAnyWarning = warnings.length > 0;
  const allergyPrintBlocked = hasAnyWarning && !allergyOverrideAck;

  return {
    warnings,
    hasAnyWarning,
    allergyOverrideAck,
    setAllergyOverrideAck,
    allergyPrintBlocked,
  };
}
