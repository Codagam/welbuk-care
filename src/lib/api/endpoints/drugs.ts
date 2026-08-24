import { api } from "@/lib/api/client";

export interface DrugCatalogItem {
  id: string;
  brandName?: string | null;
  genericName?: string | null;
  dosageForm?: string | null;
  strength?: string | null;
  route?: string | null;
  drugClass?: string | null;
  /**
   * Facility catalog expiry from `POST /api/drug/search`.
   * Prefer this over `expiryDate` when both exist.
   */
  expiry?: string | null;
  /** Legacy alias some responses use */
  expiryDate?: string | null;
  facilityPrice?: number | null;
}

export interface QuickAddedDrug {
  id: string;
  brandName: string;
  genericName?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
}

export type QuickAddDrugResult = {
  ok: boolean;
  alreadyExisted: boolean;
  drug: QuickAddedDrug;
};

/** Fallback dosage types when catalog-options is unavailable. */
export const DEFAULT_DOSAGE_TYPES = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Suspension",
  "Injection",
  "Inhaler",
  "Drops",
  "Cream",
  "Ointment",
  "Gel",
  "Lotion",
  "Pad",
  "Sachet",
  "Patch",
  "Suppository",
  "Bar",
  "Shampoo",
  "Serum",
] as const;

/**
 * Facility drug master row from `GET /api/drugs?facilityId=`
 * (legacy unpaginated catalog used by IP service picker).
 */
export interface FacilityDrugItem {
  id: string;
  name: string;
  /** Present on some `/api/drugs?q=` rows; prefer `name`. */
  brandName?: string | null;
  genericName: string;
  strength?: string | null;
  unit?: string | null;
  price?: number | null;
  gstRatePercent?: number | null;
  barcode?: string | null;
}

export async function searchDrugs(body: {
  facilityId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
}): Promise<{ drugs: DrugCatalogItem[] }> {
  const res = await api<{ drugs?: DrugCatalogItem[] }>({
    path: "/api/drug/search",
    method: "POST",
    body: {
      facilityId: body.facilityId,
      page: body.page ?? 1,
      pageSize: body.pageSize ?? 50,
      sortBy: body.sortBy ?? "brandName",
      sortOrder: body.sortOrder ?? "asc",
      search: body.search ?? "",
    },
  });
  return { drugs: res.drugs ?? [] };
}

/**
 * Doctor mid-consult catalog create — requires `consult.create`, not `drugs.create`.
 * Four fields only; no barcode / HSN / GST / price.
 */
export function quickAddDrug(body: {
  facilityId: string;
  brandName: string;
  genericName: string;
  dosageForm: string;
  strength: string;
  category?: string;
}): Promise<QuickAddDrugResult> {
  return api({
    path: "/api/drugs/quick-add",
    method: "POST",
    body: {
      facilityId: body.facilityId,
      brandName: body.brandName.trim(),
      genericName: body.genericName.trim(),
      dosageForm: body.dosageForm.trim(),
      strength: body.strength.trim(),
      ...(body.category?.trim() ? { category: body.category.trim() } : {}),
    },
  });
}

/** Presets + facility custom dosage type names. */
export async function getDrugCatalogOptions(
  facilityId: string,
  kind: "dosageType" = "dosageType"
): Promise<string[]> {
  const res = await api<{
    options?: string[];
    values?: string[];
    items?: Array<string | { name?: string; value?: string }>;
  }>({
    path: "/api/drugs/catalog-options",
    query: { kind, facilityId },
  });
  const fromOptions = res.options ?? res.values;
  if (Array.isArray(fromOptions) && fromOptions.length > 0) {
    return fromOptions.map(String).filter((s) => s.trim().length > 0);
  }
  if (Array.isArray(res.items) && res.items.length > 0) {
    return res.items
      .map((item) =>
        typeof item === "string" ? item : item.name ?? item.value ?? ""
      )
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [...DEFAULT_DOSAGE_TYPES];
}

/** GET /api/drugs?facilityId= — full facility catalog for client-side IP search. */
export async function listFacilityDrugs(
  facilityId: string,
  signal?: AbortSignal
): Promise<FacilityDrugItem[]> {
  const data = await api<{ drugs: FacilityDrugItem[] }>({
    path: "/api/drugs",
    query: { facilityId },
    signal,
  });
  return data.drugs ?? [];
}

export type FacilityDrugsPage = {
  drugs: FacilityDrugItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

/**
 * GET /api/drugs?facilityId=&q=&page=&pageSize=
 * Param is `q` (not `search`). Matches brandName, genericName, barcode.
 * Empty q still returns page 1 of the facility catalogue.
 */
export async function searchFacilityDrugs(
  facilityId: string,
  opts: { q?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal
): Promise<FacilityDrugsPage> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 10;
  const q = opts.q ?? "";
  const data = await api<{
    drugs?: FacilityDrugItem[];
    total?: number;
    page?: number;
    pageSize?: number;
    hasMore?: boolean;
  }>({
    path: "/api/drugs",
    query: { facilityId, q, page, pageSize },
    signal,
  });
  const drugs = data.drugs ?? [];
  const total = typeof data.total === "number" ? data.total : drugs.length;
  const resolvedPage = data.page ?? page;
  const resolvedPageSize = data.pageSize ?? pageSize;
  const hasMore =
    typeof data.hasMore === "boolean"
      ? data.hasMore
      : resolvedPage * resolvedPageSize < total;
  return {
    drugs,
    total,
    page: resolvedPage,
    pageSize: resolvedPageSize,
    hasMore,
  };
}
