import type { ReactNode } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";

type Props = {
  /** Practice-aligned DOM-style section id */
  id: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onLayoutY?: (id: string, y: number) => void;
};

/**
 * Full-width consult section with sticky-style title (scroll target).
 */
export function ConsultSectionCard({
  id,
  title,
  subtitle,
  children,
  onLayoutY,
}: Props) {
  const onLayout = (e: LayoutChangeEvent) => {
    onLayoutY?.(id, e.nativeEvent.layout.y);
  };

  return (
    <View
      onLayout={onLayout}
      collapsable={false}
      style={{ width: "100%", flexDirection: "column", gap: 12 }}
      className="w-full flex-col gap-3"
    >
      <View className="gap-0.5 px-1">
        <Text className="text-xl font-semibold text-neutral-900">{title}</Text>
        {subtitle ? (
          <Text className="text-sm text-neutral-500">{subtitle}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
