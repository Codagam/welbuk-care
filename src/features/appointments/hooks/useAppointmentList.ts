import { useEffect, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  checkInAppointment,
  searchAppointments,
} from "@/lib/api/endpoints/appointments";
import {
  openConsultForAppointment,
  readyForNextPatient,
} from "@/lib/api/endpoints/consult";
import { isDoctorHome } from "@/lib/auth/roles";
import { useAuthUser, useFacilityId } from "@/lib/auth/store";
import {
  buildSearchParams,
  defaultListFilters,
} from "../lib/buildSearchParams";
import type { AppointmentListFilters } from "../types";

const DEBOUNCE_MS = 500;
/** Dashboard default — Practice sends 50; cap 100 server-side. */
const PAGE_SIZE = 50;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useAppointmentListState() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<AppointmentListFilters>(
    defaultListFilters
  );
  const [filtersOpen, setFiltersOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search, DEBOUNCE_MS);
  const debouncedFilters = useDebouncedValue(filters, DEBOUNCE_MS);

  const clearFilters = () => {
    setFilters({
      date: "",
      patient: "",
      doctor: "",
      reason: "",
      status: "",
      filtersCleared: true,
    });
    setSearch("");
  };

  const resetToToday = () => {
    setFilters(defaultListFilters());
  };

  return {
    search,
    setSearch,
    filters,
    setFilters,
    debouncedSearch,
    debouncedFilters,
    filtersOpen,
    setFiltersOpen,
    clearFilters,
    resetToToday,
  };
}

/**
 * Infinite appointment list — Practice appointment-search, startTime desc.
 * Doctor home scopes with top-level `doctorId`.
 */
export function useAppointmentList(
  search: string,
  filters: AppointmentListFilters
) {
  const facilityId = useFacilityId();
  const user = useAuthUser();
  const doctorId =
    isDoctorHome(user) && user?.doctorId ? user.doctorId : undefined;

  const queryKey = useMemo(
    () => [
      "appointments",
      facilityId,
      doctorId ?? "facility",
      search,
      filters.date,
      filters.patient,
      filters.doctor,
      filters.reason,
      filters.status,
      filters.filtersCleared,
    ],
    [facilityId, doctorId, search, filters]
  );

  return useInfiniteQuery({
    queryKey,
    enabled: !!facilityId,
    refetchInterval: 30_000,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      const params = buildSearchParams({
        facilityId: facilityId!,
        doctorId,
        page: pageParam,
        pageSize: PAGE_SIZE,
        search,
        filters,
        sortBy: "startTime",
        sortOrder: "desc",
        hideTentativeFromList: true,
      });
      return searchAppointments(params, signal);
    },
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + (p.data?.length ?? 0), 0);
      if (loaded >= (last.totalCount ?? 0)) return undefined;
      return (last.currentPage ?? all.length) + 1;
    },
  });
}

export function useOpenConsult() {
  return useMutation({
    mutationFn: (appointmentId: string) =>
      openConsultForAppointment(appointmentId),
  });
}

export function useCheckInAppointment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (appointmentId: string) => checkInAppointment(appointmentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}

/** Doctor → front-desk “ready for next” notify (does not open a consult). */
export function useReadyForNext() {
  const facilityId = useFacilityId();
  return useMutation({
    mutationFn: () => {
      if (!facilityId) {
        throw new Error("Select a facility first");
      }
      return readyForNextPatient(facilityId);
    },
  });
}

export { PAGE_SIZE };
