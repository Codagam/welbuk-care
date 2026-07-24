import { Pressable, Text, View } from "react-native";

import { isBookedFollowUpSummaryLine } from "../followUp";

/**
 * Plan-of-care action bar: Follow-up aligned to the top-right.
 * Complete lives in CompleteFooter at the bottom of the screen.
 */
export function CompleteBar({
  followUpSummaryLine,
  onFollowUp,
}: {
  followUpSummaryLine?: string | null;
  onFollowUp: () => void;
}) {
  const booked = isBookedFollowUpSummaryLine(followUpSummaryLine);

  return (
    <View className="gap-2.5 rounded-2xl border border-neutral-200 bg-white px-4 py-3.5">
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 pr-2">
          <Text className="text-base font-semibold text-neutral-900">
            Follow-up
          </Text>
          <Text className="mt-0.5 text-sm text-neutral-500">
            {booked
              ? "A follow-up visit is scheduled"
              : "Schedule a return visit if needed"}
          </Text>
        </View>

        <Pressable
          onPress={onFollowUp}
          accessibilityRole="button"
          accessibilityLabel="Follow-up"
          className="relative min-h-[48px] min-w-[120px] items-center justify-center rounded-xl border border-neutral-300 bg-neutral-50 px-5 py-3 active:bg-neutral-100"
        >
          <Text className="text-base font-semibold text-neutral-900">
            Follow-up
          </Text>
          {booked ? (
            <View className="absolute -right-1.5 -top-1.5 h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1">
              <Text className="text-[10px] font-bold text-white">1</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {booked && followUpSummaryLine ? (
        <Text className="text-sm text-neutral-500">{followUpSummaryLine}</Text>
      ) : null}
    </View>
  );
}
