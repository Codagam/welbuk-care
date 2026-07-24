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
