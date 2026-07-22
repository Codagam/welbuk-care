import type { ReactNode } from "react";
import { Text, View } from "react-native";

/** Web-parity section title with horizontal rules. */
export function SectionChrome({
  title,
  right,
  emptyBorder = false,
  className,
  children,
}: {
  title: string;
  right?: ReactNode;
  /** Left accent border when section is empty (web pattern). */
  emptyBorder?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <View
      className={`gap-3 p-3 ${
        emptyBorder ? "border-l-4 border-l-brand" : "bg-brand-50"
      }${className ? ` ${className}` : ""}`}
    >
      <View className="flex-row items-center gap-2">
        <View className="h-px flex-1 bg-neutral-200" />
        <Text className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {title}
        </Text>
        <View className="h-px flex-1 bg-neutral-200" />
        {right}
      </View>
      {children}
    </View>
  );
}
