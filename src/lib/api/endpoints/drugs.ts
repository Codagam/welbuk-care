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
  genericName: string;
  strength?: string | null;
  unit?: string | null;
  price?: number | null;
  gstRatePercent?: number | null;
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
