import { api } from "@/lib/api/client";

export interface DrugCatalogItem {
  id: string;
  brandName?: string | null;
  genericName?: string | null;
  dosageForm?: string | null;
  strength?: string | null;
  drugClass?: string | null;
  /** Facility-level expiry / not-prescribable flag when present */
  expiryDate?: string | null;
  facilityPrice?: number | null;
}

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
      pageSize: body.pageSize ?? 1000,
      sortBy: body.sortBy ?? "brandName",
      sortOrder: body.sortOrder ?? "asc",
      search: body.search ?? "",
    },
  });
  return { drugs: res.drugs ?? [] };
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
