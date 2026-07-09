import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export interface ScreenProps {
  children: ReactNode;
  className?: string;
  /** Background tint of the safe area. Defaults to neutral-50. */
  bgClassName?: string;
}

export function Screen({
  children,
  className = "",
  bgClassName = "bg-neutral-50",
}: ScreenProps) {
  return (
    <SafeAreaView className={`flex-1 ${bgClassName}`}>
      <View className={`flex-1 ${className}`}>{children}</View>
    </SafeAreaView>
  );
}
