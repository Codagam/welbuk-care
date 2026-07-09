import { useMutation, useQuery } from "@tanstack/react-query";

import { searchAppointments } from "@/lib/api/endpoints/appointments";
import { openConsultForAppointment } from "@/lib/api/endpoints/consult";
import { useFacilityId } from "@/lib/auth/store";

function todayRange(): { start: string; end: string; key: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    key: start.toISOString().slice(0, 10),
  };
}

/** Today's facility queue, status-priority sorted, auto-refreshing. */
export function useTodayQueue() {
  const facilityId = useFacilityId();
  const { start, end, key } = todayRange();
  return useQuery({
    queryKey: ["queue", facilityId, key],
    enabled: !!facilityId,
    refetchInterval: 30_000,
    queryFn: ({ signal }) =>
      searchAppointments(
        {
          facilityId: facilityId!,
          startDate: start,
          endDate: end,
          page: 1,
          pageSize: 100,
          sortBy: "startTime",
          sortOrder: "asc",
        },
        signal
      ),
  });
}

/** Get-or-create the consultation for an appointment (used on queue tap). */
export function useOpenConsult() {
  return useMutation({
    mutationFn: (appointmentId: string) => openConsultForAppointment(appointmentId),
  });
}
