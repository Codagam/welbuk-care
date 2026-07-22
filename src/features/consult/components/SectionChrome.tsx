import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/** Web-parity section title with horizontal rules. */
export function SectionChrome({
  title,
  right,
  emptyBorder = false,
  className,
  collapsible = false,
  defaultOpen = true,
  children,
}: {
  title: string;
  right?: ReactNode;
  /** Left accent border when section is empty (web pattern). */
  emptyBorder?: boolean;
  className?: string;
  /** When true, title row toggles children; starts from `defaultOpen`. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const showChildren = !collapsible || open;

  const header = (
    <>
      {collapsible ? (
        <View
          className={`h-6 w-6 items-center justify-center rounded-full ${
            open ? "bg-neutral-200" : "bg-brand/15"
          }`}
        >
          <Ionicons
            name={open ? "chevron-down" : "chevron-forward"}
            size={14}
            color={open ? "#6b7280" : "#FD006A"}
          />
        </View>
      ) : null}
      <View className="h-px flex-1 bg-neutral-200" />
      <Text className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {title}
      </Text>
      <View className="h-px flex-1 bg-neutral-200" />
      {collapsible ? (
        open ? (
          <Ionicons name="remove-outline" size={16} color="#9ca3af" />
        ) : (
          <View className="flex-row items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5">
            <Ionicons name="add" size={12} color="#FD006A" />
            <Text className="text-[10px] font-semibold uppercase tracking-wide text-brand">
              Closed
            </Text>
          </View>
        )
      ) : (
        right
      )}
    </>
  );

  return (
    <View
      className={`gap-3 p-3 ${
        emptyBorder ? "border-l-4 border-l-brand" : "border border-neutral-200"
      }${className ? ` ${className}` : ""}`}
    >
      {collapsible ? (
        <Pressable
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={
            open ? `Collapse ${title}` : `Expand ${title}`
          }
          className="flex-row items-center gap-2 active:opacity-70"
        >
          {header}
        </Pressable>
      ) : (
        <View className="flex-row items-center gap-2">{header}</View>
      )}
      {showChildren ? children : null}
    </View>
  );
}
