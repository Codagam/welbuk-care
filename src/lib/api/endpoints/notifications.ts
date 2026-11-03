import { api } from "@/lib/api/client";

export type StaffNotification = {
  id: string;
  type?: string | null;
  event?: string | null;
  title: string;
  body?: string | null;
  payload?: Record<string, unknown> | null;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
  expiresAt?: string | null;
};

export type NotificationsListResult = {
  notifications: StaffNotification[];
  unreadCount: number;
  total: number;
};

export type NotificationListOpts = {
  /** Doctor-home: clinical events scoped to this doctor (Practice tray parity). */
  doctorScope?: boolean;
};

/** GET /api/notifications?facilityId=&doctorScope=1 */
export async function listNotifications(
  facilityId: string,
  opts?: NotificationListOpts
): Promise<NotificationsListResult> {
  const res = await api<NotificationsListResult>({
    path: "/api/notifications",
    query: {
      facilityId,
      ...(opts?.doctorScope ? { doctorScope: "1" } : {}),
    },
  });
  return {
    notifications: res.notifications ?? [],
    unreadCount: res.unreadCount ?? 0,
    total: res.total ?? (res.notifications?.length ?? 0),
  };
}

/** PATCH /api/notifications/[id]?facilityId= */
export function markNotificationRead(
  id: string,
  facilityId: string
): Promise<{ success?: boolean }> {
  return api<{ success?: boolean }>({
    path: `/api/notifications/${id}`,
    method: "PATCH",
    query: { facilityId },
  });
}

/** PATCH /api/notifications/read-all?facilityId=&doctorScope=1 */
export function markAllNotificationsRead(
  facilityId: string,
  opts?: NotificationListOpts
): Promise<{ success?: boolean; updated?: number }> {
  return api<{ success?: boolean; updated?: number }>({
    path: "/api/notifications/read-all",
    method: "PATCH",
    query: {
      facilityId,
      ...(opts?.doctorScope ? { doctorScope: "1" } : {}),
    },
  });
}
