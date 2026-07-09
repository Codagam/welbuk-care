import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

export interface TopBarProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
}

export function TopBar({ title, subtitle, right, onBack }: TopBarProps) {
  const router = useRouter();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/home")));
  return (
    <View className="flex-row items-center gap-2 border-b border-neutral-200 bg-white px-3 py-3">
      <Pressable
        onPress={back}
        className="h-9 w-9 items-center justify-center rounded-full active:bg-neutral-100"
      >
        <Text className="text-2xl leading-none text-neutral-700">‹</Text>
      </Pressable>
      <View className="flex-1">
        <Text className="text-lg font-semibold text-neutral-900" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-xs text-neutral-500" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
