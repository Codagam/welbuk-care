import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

export interface TopBarProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
  /** Primary brand bar with light text (e.g. consultation). */
  variant?: "default" | "brand";
  /** Text back control instead of the chevron icon. */
  backLabel?: string;
  /** Center the title between back and right actions. */
  titleCentered?: boolean;
}

export function TopBar({
  title,
  subtitle,
  right,
  onBack,
  variant = "default",
  backLabel,
  titleCentered = false,
}: TopBarProps) {
  const router = useRouter();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/queue")));
  const brand = variant === "brand";

  const backControl = (
    <Pressable
      onPress={back}
      accessibilityRole="button"
      accessibilityLabel={backLabel ?? "Back"}
      hitSlop={8}
      className={
        backLabel
          ? "min-h-9 justify-center px-1 active:opacity-70"
          : brand
            ? "h-9 w-9 items-center justify-center rounded-full active:bg-white/15"
            : "h-9 w-9 items-center justify-center rounded-full active:bg-neutral-100"
      }
    >
      {backLabel ? (
        <Text
          className={`text-base font-semibold ${
            brand ? "text-white" : "text-neutral-700"
          }`}
        >
          {backLabel}
        </Text>
      ) : (
        <Text
          className={`text-2xl leading-none ${
            brand ? "text-white" : "text-neutral-700"
          }`}
        >
          ‹
        </Text>
      )}
    </Pressable>
  );

  const titleBlock = (
    <View className={titleCentered ? "items-center px-2" : undefined}>
      <Text
        className={`${
          brand || titleCentered ? "text-base" : "text-lg"
        } font-semibold ${brand ? "text-white" : "text-neutral-900"}${
          titleCentered ? " text-center" : ""
        }`}
        numberOfLines={1}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          className={`text-xs ${
            brand ? "text-white/80" : "text-neutral-500"
          } ${titleCentered ? "text-center" : ""}`}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  if (titleCentered) {
    return (
      <View
        className={`flex-row items-center px-3 py-3 ${
          brand ? "bg-brand" : "border-b border-neutral-200 bg-white"
        }`}
      >
        <View className="min-w-[72px] items-start justify-center">
          {backControl}
        </View>
        <View className="min-w-0 flex-1 items-center justify-center">
          {titleBlock}
        </View>
        <View className="min-w-[72px] items-end justify-center">
          {right ?? null}
        </View>
      </View>
    );
  }

  return (
    <View
      className={`flex-row items-center gap-2 px-3 py-3 ${
        brand
          ? "bg-brand"
          : "border-b border-neutral-200 bg-white"
      }`}
    >
      {backControl}
      <View className="min-w-0 flex-1">{titleBlock}</View>
      {right}
    </View>
  );
}
