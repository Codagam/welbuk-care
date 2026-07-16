import { Text, View } from "react-native";

import { Button } from "@/ui";

/**
 * Primary Complete CTA — sticky footer below consultation content.
 * Safe-area inset is handled by the parent Screen shell.
 */
export function CompleteFooter({
  onComplete,
  completing,
  completeDisabled,
  completeDisabledReason,
  error,
  done,
}: {
  onComplete: () => void;
  completing?: boolean;
  completeDisabled?: boolean;
  completeDisabledReason?: string | null;
  error?: string | null;
  done?: string | null;
}) {
  return (
    <View className="border-t border-neutral-200 bg-white px-4 pb-3 pt-3">
      <View className="w-full gap-2 self-center" style={{ maxWidth: 1152 }}>
        {completeDisabled && completeDisabledReason ? (
          <Text className="text-sm text-amber-700">
            {completeDisabledReason}
          </Text>
        ) : null}
        {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
        {done ? <Text className="text-sm text-emerald-600">{done}</Text> : null}

        <Button
          label="Complete"
          size="lg"
          onPress={onComplete}
          loading={completing}
          disabled={completeDisabled}
          className="w-full min-h-[52px]"
        />
      </View>
    </View>
  );
}
