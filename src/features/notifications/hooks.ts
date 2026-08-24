import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/endpoints/notifications";
import { isDoctorHome } from "@/lib/auth/roles";
import { useAuthUser, useFacilityId } from "@/lib/auth/store";

export function notificationsQueryKey(
  facilityId: string | null,
  doctorScope: boolean
) {
  return [
    "notifications",
    facilityId,
    doctorScope ? "doctor" : "facility",
  ] as const;
}

export function useNotifications(opts?: { enabled?: boolean }) {
  const facilityId = useFacilityId();
  const user = useAuthUser();
  const doctorScope = isDoctorHome(user);
  const enabled = opts?.enabled !== false;
  return useQuery({
    queryKey: notificationsQueryKey(facilityId, doctorScope),
    enabled: !!facilityId && enabled,
    queryFn: () =>
      listNotifications(facilityId!, { doctorScope }),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const facilityId = useFacilityId();
  const user = useAuthUser();
  const doctorScope = isDoctorHome(user);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!facilityId) throw new Error("Select a facility first.");
      return markNotificationRead(id, facilityId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: notificationsQueryKey(facilityId, doctorScope),
      });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const facilityId = useFacilityId();
  const user = useAuthUser();
  const doctorScope = isDoctorHome(user);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!facilityId) throw new Error("Select a facility first.");
      return markAllNotificationsRead(facilityId, { doctorScope });
    },
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: notificationsQueryKey(facilityId, doctorScope),
      });
    },
  });
}
