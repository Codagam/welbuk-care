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
      <View className="gap-1 rounded-xl bg-brand px-4 py-3">
        <Text className="text-xl font-semibold tracking-tight text-white">
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-sm leading-5 text-white/80">{subtitle}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
