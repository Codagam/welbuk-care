import { useState, type ReactNode } from "react";
import {
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  /** Practice-aligned DOM-style section id */
  id: string;
  title: string;
  subtitle?: string;
  /**
   * Section body. Pass a function to keep part of the body visible when
   * collapsed (e.g. patient vitals stay, records hide).
   */
  children: ReactNode | ((open: boolean) => ReactNode);
  onLayoutY?: (id: string, y: number) => void;
  /** Show chevron toggle on the brand header. Defaults to true. */
  collapsible?: boolean;
  /** Start expanded. Defaults to true. */
  defaultOpen?: boolean;
};

/**
 * Full-width consult section with sticky-style title (scroll target).
 * Brand header includes a dropdown chevron when `collapsible`.
 */
export function ConsultSectionCard({
  id,
  title,
  subtitle,
  children,
  onLayoutY,
  collapsible = true,
  defaultOpen = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const onLayout = (e: LayoutChangeEvent) => {
    onLayoutY?.(id, e.nativeEvent.layout.y);
  };

  const body =
    typeof children === "function"
      ? children(collapsible ? open : true)
      : collapsible && !open
        ? null
        : children;

  return (
    <View
      onLayout={onLayout}
      collapsable={false}
      style={{ width: "100%", flexDirection: "column", gap: 12 }}
      className="w-full flex-col gap-3"
    >
      <View className="flex-row items-center gap-3 rounded-xl bg-brand px-4 py-3">
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-xl font-semibold tracking-tight text-white">
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-sm leading-5 text-white/80">{subtitle}</Text>
          ) : null}
        </View>
        {collapsible ? (
          <Pressable
            onPress={() => setOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={open ? `Collapse ${title}` : `Expand ${title}`}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full bg-white/15 active:bg-white/25"
          >
            <Ionicons
              name={open ? "chevron-up" : "chevron-down"}
              size={22}
              color="#FFFFFF"
            />
          </Pressable>
        ) : null}
      </View>
      {body}
    </View>
  );
}
