import { api } from "@/lib/api/client";
import type {
  LastUsed,
  LineDraft,
  RegimenView,
} from "@/features/consult/plan-of-care/lineDraft";

/** Practice caps a lookup at this many medicines, so longer picks go in batches. */
const LOOKUP_BATCH = 25;

export type RegimenLookup = {
  regimens: Record<string, RegimenView>;
  lastUsed: Record<string, LastUsed>;
  /** True only for the consult's own doctor; anyone else fills but cannot change. */
  canSave: boolean;
  /** A batch failed, so some medicines may be blank that have a regimen. */
  failed: boolean;
};

/** The CONSULT's doctor's regimens: an assistant entering it is filled from them. */
export async function lookupRegimens(
  facilityId: string,
  drugIds: string[],
  consultationId: string
): Promise<RegimenLookup> {
  const out: RegimenLookup = {
    regimens: {},
    lastUsed: {},
    canSave: false,
    failed: false,
  };
  for (let i = 0; i < drugIds.length; i += LOOKUP_BATCH) {
    try {
      const data = await api<{
        regimens?: Record<string, RegimenView>;
        lastUsed?: Record<string, LastUsed>;
        canSave?: boolean;
      }>({
        path: "/api/consult/regimens/lookup",
        query: {
          facilityId,
          consultationId,
          drugIds: drugIds.slice(i, i + LOOKUP_BATCH).join(","),
        },
      });
      Object.assign(out.regimens, data.regimens ?? {});
      Object.assign(out.lastUsed, data.lastUsed ?? {});
      out.canSave = Boolean(data.canSave);
    } catch {
      out.failed = true;
    }
  }
  return out;
}

export async function listRegimens(params: {
  facilityId: string;
  consultationId: string;
  page: number;
  pageSize: number;
}): Promise<{
  regimens: RegimenView[];
  total: number;
  readOnly: boolean;
  doctorName: string | null;
}> {
  const data = await api<{
    regimens?: RegimenView[];
    total?: number;
    readOnly?: boolean;
    doctorName?: string | null;
  }>({
    path: "/api/consult/regimens",
    query: { ...params, sort: "recent" },
  });
  return {
    regimens: data.regimens ?? [],
    total: data.total ?? 0,
    readOnly: Boolean(data.readOnly),
    doctorName: data.doctorName ?? null,
  };
}

export type RecentDrug = {
  id: string;
  name: string;
  brandName?: string | null;
  genericName?: string | null;
  dosageForm?: string | null;
  strength?: string | null;
  expiry?: string | null;
  lastPrescribedAt: string;
};

export async function listRecentDrugs(params: {
  facilityId: string;
  consultationId: string;
  limit: number;
  exclude: string[];
}): Promise<RecentDrug[]> {
  const data = await api<{ drugs?: RecentDrug[] }>({
    path: "/api/consult/regimens/recent-drugs",
    query: { ...params, exclude: params.exclude.join(",") },
  });
  return data.drugs ?? [];
}

/** Create or change the caller's own regimen. An identical save mints no version. */
export async function saveRegimen(body: {
  facilityId: string;
  consultationId: string;
  drugId: string;
  draft: LineDraft;
}): Promise<RegimenView> {
  const { draft, ...rest } = body;
  const data = await api<{ regimen: RegimenView }>({
    path: "/api/consult/regimens",
    method: "PUT",
    body: {
      ...rest,
      dosePattern: draft.dosePattern,
      foodTiming: draft.foodTiming,
      durationValue: draft.durationValue,
      durationUnit: draft.durationUnit,
      doseNote: draft.doseNote,
      source: "consult",
    },
  });
  return data.regimen;
}
