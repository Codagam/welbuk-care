import type { ReactNode } from "react";
import { View } from "react-native";
import {
  SafeAreaView,
  type Edge,
} from "react-native-safe-area-context";

export interface ScreenProps {
  children: ReactNode;
  className?: string;
  /** Background tint of the safe area. Defaults to neutral-50. */
  bgClassName?: string;
  /** Safe-area edges to inset. Defaults to all edges. */
  edges?: Edge[];
}

export function Screen({
  children,
  className = "",
  bgClassName = "bg-neutral-50",
  edges,
}: ScreenProps) {
  return (
    <SafeAreaView className={`flex-1 ${bgClassName}`} edges={edges}>
      <View className={`flex-1 ${className}`}>{children}</View>
    </SafeAreaView>
  );
}
