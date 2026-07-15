import { Pressable, Text, View } from "react-native";

import { Button } from "@/ui";
import { isBookedFollowUpSummaryLine } from "../followUp";

export function CompleteBar({
  followUpSummaryLine,
  onFollowUp,
  onInvoice,
  onComplete,
  completing,
  completeDisabled,
  completeDisabledReason,
}: {
  followUpSummaryLine?: string | null;
  onFollowUp: () => void;
  onInvoice: () => void;
  onComplete: () => void;
  completing?: boolean;
  completeDisabled?: boolean;
  completeDisabledReason?: string | null;
}) {
  const booked = isBookedFollowUpSummaryLine(followUpSummaryLine);

  return (
    <View className="gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <View className="flex-row items-center gap-3">
        <View className="flex-row flex-wrap items-center gap-2">
          <Pressable
            onPress={onFollowUp}
            className="relative rounded-xl border border-neutral-300 bg-white px-4 py-2.5 active:bg-neutral-100"
          >
            <Text className="text-sm font-semibold text-neutral-900">
              Follow-up
            </Text>
            {booked ? (
              <View className="absolute -right-1.5 -top-1.5 h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1">
                <Text className="text-[10px] font-bold text-white">1</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            onPress={onInvoice}
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 active:bg-neutral-100"
          >
            <Text className="text-sm font-semibold text-neutral-900">
              Invoice
            </Text>
          </Pressable>
        </View>

        <View className="flex-1" />

        <View className="min-w-[160px]">
          <Button
            label="Complete"
            size="md"
            onPress={onComplete}
            loading={completing}
            disabled={completeDisabled}
          />
        </View>
      </View>

      {completeDisabled && completeDisabledReason ? (
        <Text className="text-xs text-amber-700">{completeDisabledReason}</Text>
      ) : null}
      {booked && followUpSummaryLine ? (
        <Text className="text-xs text-neutral-500">{followUpSummaryLine}</Text>
      ) : null}
    </View>
  );
}
