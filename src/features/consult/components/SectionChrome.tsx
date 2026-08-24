import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/** Clean section card — title left, optional chevron / actions right. */
export function SectionChrome({
  title,
  right,
  icon,
  badge,
  emptyBorder = false,
  className,
  collapsible = false,
  defaultOpen = true,
  children,
}: {
  title: string;
  right?: ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
  badge?: number;
  /** Kept for API compat; no longer draws a left accent border. */
  emptyBorder?: boolean;
  className?: string;
  /** When true, title row toggles children; starts from `defaultOpen`. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const showChildren = !collapsible || open;
  void emptyBorder;

  const titleEl = (
    <View className="min-w-0 flex-1 flex-row items-center gap-2">
      {icon ? <Ionicons name={icon} size={16} color="#FD006A" /> : null}
      <Text
        className="min-w-0 shrink text-sm font-semibold text-brand"
        numberOfLines={1}
      >
        {title}
      </Text>
      {badge != null && badge > 0 ? (
        <View className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5">
          <Text className="text-[10px] font-semibold text-brand">{badge}</Text>
        </View>
      ) : null}
    </View>
  );

  const trailing = collapsible ? (
    <Ionicons
      name={open ? "chevron-up" : "chevron-down"}
      size={18}
      color="#FD006A"
    />
  ) : (
    right
  );

  return (
    <View
      className={`overflow-hidden rounded-2xl border border-neutral-200 bg-white${
        className ? ` ${className}` : ""
      }`}
    >
      {collapsible ? (
        <Pressable
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={
            open ? `Collapse ${title}` : `Expand ${title}`
          }
          className="flex-row items-center justify-between gap-3 px-3.5 py-3 active:bg-neutral-50"
        >
          {titleEl}
          {trailing}
        </Pressable>
      ) : (
        <View className="flex-row items-center justify-between gap-3 px-3.5 py-3">
          {titleEl}
          {trailing}
        </View>
      )}
      {showChildren ? (
        <View className="border-t border-neutral-100 px-3.5 pb-3.5 pt-2.5">
          {children}
        </View>
      ) : null}
    </View>
  );
}
