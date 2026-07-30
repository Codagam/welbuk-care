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

/** GET /api/notifications?facilityId= */
export async function listNotifications(
  facilityId: string
): Promise<NotificationsListResult> {
  const res = await api<NotificationsListResult>({
    path: "/api/notifications",
    query: { facilityId },
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

/** PATCH /api/notifications/read-all?facilityId= */
export function markAllNotificationsRead(
  facilityId: string
): Promise<{ success?: boolean; updated?: number }> {
  return api<{ success?: boolean; updated?: number }>({
    path: "/api/notifications/read-all",
    method: "PATCH",
    query: { facilityId },
  });
}
