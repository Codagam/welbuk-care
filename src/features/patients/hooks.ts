import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createPatient,
  getPatient,
  searchPatients,
  updatePatient,
} from "@/lib/api/endpoints/patients";
import { useFacilityId } from "@/lib/auth/store";
import type { PatientSearchResult, PatientWriteInput } from "./types";

const PAGE_SIZE = 20;

/** Infinite, DB-paginated patient search scoped to the active facility. */
export function usePatientSearch(search: string) {
  const facilityId = useFacilityId();
  return useInfiniteQuery({
    queryKey: ["patients", facilityId, search.trim()],
    enabled: !!facilityId,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      searchPatients(
        {
          facilityId: facilityId!,
          search: search.trim() || undefined,
          page: pageParam,
          pageSize: PAGE_SIZE,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
        signal
      ),
    getNextPageParam: (last: PatientSearchResult) =>
      last.currentPage < last.totalPages ? last.currentPage + 1 : undefined,
  });
}

export function usePatient(id: string | undefined) {
  const facilityId = useFacilityId();
  return useQuery({
    queryKey: ["patient", id, facilityId],
    enabled: !!id && !!facilityId,
    queryFn: () => getPatient(id!, facilityId!),
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PatientWriteInput) => createPatient(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

export function useUpdatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PatientWriteInput) => updatePatient(body),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      if (variables.id) {
        qc.invalidateQueries({ queryKey: ["patient", variables.id] });
      }
    },
  });
}
