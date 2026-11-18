import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { StaffNotification } from "@/lib/api/endpoints/notifications";
import { describeError } from "@/lib/api/errors";
import { AppModal, Button } from "@/ui";

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "./hooks";

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

function eventIcon(
  type?: string | null,
  event?: string | null
): keyof typeof Ionicons.glyphMap {
  const t = (type || event || "").toUpperCase();
  if (t.includes("DOCTOR_CHANGED") || t.includes("LANE_TRANSFERRED")) {
    return "swap-horizontal-outline";
  }
  if (t.includes("APPOINTMENT") || t.includes("VITALS")) return "calendar-outline";
  if (t.includes("PRESCRIPTION")) return "medkit-outline";
  if (t.includes("LAB")) return "flask-outline";
  if (t.includes("REFERRAL")) return "swap-horizontal-outline";
  if (t.includes("PAYMENT") || t.includes("BILLING")) return "card-outline";
  if (t.includes("CALL") || t.includes("DOCTOR")) return "call-outline";
  return "notifications-outline";
}

function NotificationBellButton({
  unreadCount,
  light,
  onPress,
}: {
  unreadCount: number;
  light?: boolean;
  onPress: () => void;
}) {
  const color = light ? "#FFFFFF" : "#111827";
  const badge = unreadCount > 99 ? "99+" : String(unreadCount);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount > 0
          ? `Notifications, ${unreadCount} unread`
          : "Notifications"
      }
      hitSlop={8}
      className="h-11 w-11 items-center justify-center rounded-full active:opacity-70"
    >
      <Ionicons name="notifications-outline" size={22} color={color} />
      {unreadCount > 0 ? (
        <View
          className={`absolute right-0.5 top-0.5 min-w-[16px] items-center rounded-full px-1 ${
            light ? "bg-white" : "bg-brand"
          }`}
        >
          <Text
            className={`text-[9px] font-bold leading-[14px] ${
              light ? "text-brand" : "text-white"
            }`}
          >
            {badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function NotificationRow({
  item,
  onPress,
}: {
  item: StaffNotification;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-start gap-3 border-b border-neutral-100 px-4 py-3.5 active:bg-neutral-50 ${
        item.read ? "bg-white" : "bg-brand/5"
      }`}
    >
      <View
        className={`mt-0.5 h-9 w-9 items-center justify-center rounded-full ${
          item.read ? "bg-neutral-100" : "bg-brand/10"
        }`}
      >
        <Ionicons
          name={eventIcon(item.type, item.event)}
          size={18}
          color="#FD006A"
        />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-start justify-between gap-2">
          <Text
            className={`min-w-0 flex-1 text-sm ${
              item.read
                ? "font-medium text-neutral-800"
                : "font-semibold text-neutral-900"
            }`}
            numberOfLines={2}
          >
            {item.title || "Notification"}
          </Text>
          {!item.read ? (
            <View className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
          ) : null}
        </View>
        {item.body ? (
          <Text className="text-xs text-neutral-600" numberOfLines={2}>
            {item.body}
          </Text>
        ) : null}
        <Text className="text-[11px] text-neutral-400">
          {relativeTime(item.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}


/** The appointment a notification is about, when its payload names one. */
export function notificationAppointmentId(
  item: StaffNotification
): string | null {
  const id = item.payload?.appointmentId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

/**
 * Header, "mark all", and the list. Rendered inside the bell's sheet, and
 * docked beside the appointment list on a landscape tablet.
 */
export function NotificationPanel({
  onSelect,
  onClose,
  onCollapse,
}: {
  /** Runs after the row is marked read. */
  onSelect?: (item: StaffNotification) => void;
  /** Sheet: shows a close button. */
  onClose?: () => void;
  /** Docked: shows a collapse button. */
  onCollapse?: () => void;
}) {
  const q = useNotifications({ enabled: true });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const unreadCount = q.data?.unreadCount ?? 0;
  const rows = useMemo(() => q.data?.notifications ?? [], [q.data]);

  const onRowPress = (item: StaffNotification) => {
    if (!item.read) markRead.mutate(item.id);
    onSelect?.(item);
  };

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-lg font-semibold text-neutral-900">
            Notifications
          </Text>
          <Text className="text-xs text-neutral-500">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          </Text>
        </View>
        {unreadCount > 0 && onCollapse ? (
          <Pressable
            onPress={() => markAll.mutate()}
            disabled={markAll.isPending}
            accessibilityRole="button"
            accessibilityLabel="Mark all as read"
            hitSlop={8}
            className={`h-9 w-9 items-center justify-center rounded-full active:bg-brand-50 ${
              markAll.isPending ? "opacity-40" : ""
            }`}
          >
            <Ionicons name="checkmark-done-outline" size={20} color="#FD006A" />
          </Pressable>
        ) : null}
        {onCollapse ? (
          <Pressable
            onPress={onCollapse}
            accessibilityRole="button"
            accessibilityLabel="Hide notifications"
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full active:bg-neutral-100"
          >
            <Ionicons name="chevron-forward" size={20} color="#6b7280" />
          </Pressable>
        ) : null}
        {onClose ? (
          <Pressable
            onPress={onClose}
            hitSlop={12}
            className="h-9 w-9 items-center justify-center rounded-full active:bg-neutral-100"
          >
            <Ionicons name="close" size={22} color="#6b7280" />
          </Pressable>
        ) : null}
      </View>

      {unreadCount > 0 && !onCollapse ? (
        <View className="border-b border-neutral-100 px-4 py-2">
          <Button
            label="Mark all as read"
            size="md"
            variant="outline"
            loading={markAll.isPending}
            onPress={() => markAll.mutate()}
            icon={
              <Ionicons
                name="checkmark-done-outline"
                size={16}
                color="#171717"
              />
            }
          />
        </View>
      ) : null}

      {q.isLoading && !q.data ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FD006A" />
        </View>
      ) : q.isError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-red-500">
            {describeError(q.error)}
          </Text>
          <View className="mt-3">
            <Button
              label="Retry"
              size="md"
              variant="primary"
              onPress={() => void q.refetch()}
            />
          </View>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(n) => n.id}
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
          contentContainerStyle={
            rows.length === 0
              ? { flexGrow: 1, justifyContent: "center", padding: 24 }
              : { paddingBottom: 24 }
          }
          ListEmptyComponent={
            <Text className="text-center text-sm text-neutral-500">
              No notifications yet.
            </Text>
          }
          renderItem={({ item }) => (
            <NotificationRow item={item} onPress={() => onRowPress(item)} />
          )}
        />
      )}
    </View>
  );
}

/**
 * Collapsed docked panel: a slim rail with the bell and unread count.
 */
export function NotificationRail({ onExpand }: { onExpand: () => void }) {
  const q = useNotifications({ enabled: true });
  const unreadCount = q.data?.unreadCount ?? 0;
  return (
    <View className="flex-1 items-center bg-white pt-3">
      <Pressable
        onPress={onExpand}
        accessibilityRole="button"
        accessibilityLabel="Show notifications"
        hitSlop={8}
        className="h-9 w-9 items-center justify-center rounded-full active:bg-neutral-100"
      >
        <Ionicons name="chevron-back" size={20} color="#6b7280" />
      </Pressable>
      <NotificationBellButton
        unreadCount={unreadCount}
        light={false}
        onPress={onExpand}
      />
    </View>
  );
}

/**
 * Bell + unread badge (next to QR) and sheet listing facility notifications.
 */
export function NotificationQueue({ light = true }: { light?: boolean }) {
  const [open, setOpen] = useState(false);
  const q = useNotifications({ enabled: true });
  const unreadCount = q.data?.unreadCount ?? 0;

  return (
    <>
      <NotificationBellButton
        unreadCount={unreadCount}
        light={light}
        onPress={() => setOpen(true)}
      />

      <AppModal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <NotificationPanel onClose={() => setOpen(false)} />
      </AppModal>
    </>
  );
}
