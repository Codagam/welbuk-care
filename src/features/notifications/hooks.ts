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
import { useFacilityId } from "@/lib/auth/store";

export function notificationsQueryKey(facilityId: string | null) {
  return ["notifications", facilityId] as const;
}

export function useNotifications(opts?: { enabled?: boolean }) {
  const facilityId = useFacilityId();
  const enabled = opts?.enabled !== false;
  return useQuery({
    queryKey: notificationsQueryKey(facilityId),
    enabled: !!facilityId && enabled,
    queryFn: () => listNotifications(facilityId!),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const facilityId = useFacilityId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!facilityId) throw new Error("Select a facility first.");
      return markNotificationRead(id, facilityId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: notificationsQueryKey(facilityId),
      });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const facilityId = useFacilityId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!facilityId) throw new Error("Select a facility first.");
      return markAllNotificationsRead(facilityId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: notificationsQueryKey(facilityId),
      });
    },
  });
}
