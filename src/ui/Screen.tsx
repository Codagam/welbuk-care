import type { ReactNode } from "react";
import { View } from "react-native";
import {
  SafeAreaView,
  type Edge,
} from "react-native-safe-area-context";

import { StatusBarBrandFill } from "./AppStatusBar";

export interface ScreenProps {
  children: ReactNode;
  className?: string;
  /** Background tint of the safe area. Defaults to neutral-50. */
  bgClassName?: string;
  /** Safe-area edges to inset. Defaults to all edges. Top is always handled by the brand status-bar fill. */
  edges?: Edge[];
  /**
   * When false, skip the brand status-bar fill (screen draws its own brand header under the status bar).
   * Defaults to true.
   */
  statusBarFill?: boolean;
}

export function Screen({
  children,
  className = "",
  bgClassName = "bg-neutral-50",
  edges,
  statusBarFill = true,
}: ScreenProps) {
  const baseEdges: Edge[] = edges ?? ["top", "right", "bottom", "left"];
  // Brand fill owns the top inset so status-bar icons sit on primary color.
  const safeEdges = (
    statusBarFill ? baseEdges.filter((e) => e !== "top") : baseEdges
  ) as Edge[];

  return (
    <View className={`flex-1 ${bgClassName}`}>
      {statusBarFill ? <StatusBarBrandFill /> : null}
      <SafeAreaView className="flex-1" edges={safeEdges}>
        <View className={`flex-1 ${className}`}>{children}</View>
      </SafeAreaView>
    </View>
  );
}
