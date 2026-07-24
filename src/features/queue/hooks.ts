import { useMutation, useQuery } from "@tanstack/react-query";

import { searchAppointments } from "@/lib/api/endpoints/appointments";
import { openConsultForAppointment } from "@/lib/api/endpoints/consult";
import { isDoctorHome } from "@/lib/auth/roles";
import { useAuthUser, useFacilityId } from "@/lib/auth/store";

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

/**
 * Today's facility queue, status-priority sorted, auto-refreshing.
 * Doctor logins pass `doctorId` so the API returns only that doctor's rows
 * (Practice does not auto-scope appointments from the JWT).
 */
export function useTodayQueue() {
  const facilityId = useFacilityId();
  const user = useAuthUser();
  const doctorId =
    isDoctorHome(user) && user?.doctorId ? user.doctorId : undefined;
  const { start, end, key } = todayRange();
  return useQuery({
    queryKey: ["queue", facilityId, doctorId ?? "facility", key],
    enabled: !!facilityId,
    refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      const params = {
        facilityId: facilityId!,
        ...(doctorId ? { doctorId } : {}),
        startDate: start,
        endDate: end,
        page: 1,
        pageSize: 100,
        sortBy: "startTime",
        sortOrder: "asc" as const,
      };
      console.log("[queue] appointment-search request", params);
      const result = await searchAppointments(params, signal);
      console.log("[queue] appointment-search response", {
        totalCount: result.totalCount,
        count: result.data?.length,
        sample: result.data?.slice(0, 2).map((a) => ({
          id: a.id,
          doctorId: a.doctorId,
          doctorName: a.doctor?.name,
          patient: a.patient
            ? `${a.patient.firstName} ${a.patient.lastName ?? ""}`.trim()
            : null,
          status: a.status,
        })),
      });
      return result;
    },
  });
}

/** Get-or-create the consultation for an appointment (used on queue tap). */
export function useOpenConsult() {
  return useMutation({
    mutationFn: (appointmentId: string) => openConsultForAppointment(appointmentId),
  });
}
