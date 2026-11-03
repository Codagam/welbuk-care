import { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  followUpPrintDetail,
  formatFollowUpForPrint,
  isBookedFollowUpSummaryLine,
} from "../followUp";
import type { PickerAnchor } from "./regimen/pickerPlacement";

/**
 * Plan-of-care action bar: Follow-up aligned to the top-right.
 * Complete lives in CompleteFooter at the bottom of the screen.
 */
export function CompleteBar({
  followUpSummaryLine,
  onFollowUp,
  locked = false,
}: {
  followUpSummaryLine?: string | null;
  /** Gets where the button is on screen, so the panel can open under it. */
  onFollowUp: (anchor: PickerAnchor) => void;
  locked?: boolean;
}) {
  const booked = isBookedFollowUpSummaryLine(followUpSummaryLine);
  const detail = followUpPrintDetail(followUpSummaryLine);
  const anchorRef = useRef<View>(null);

  return (
    <View className="gap-2.5 rounded-2xl border border-neutral-200 bg-white px-4 py-3.5">
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 pr-2">
          <Text className="text-base font-semibold text-brand">Follow-up</Text>
          {booked ? (
            <>
              <Text className="mt-0.5 text-sm text-neutral-800">
                <Text className="text-neutral-500">Next visit: </Text>
                <Text className="font-semibold">
                  {formatFollowUpForPrint(followUpSummaryLine)}
                </Text>
              </Text>
              {detail ? (
                <Text className="text-xs text-neutral-500">{detail}</Text>
              ) : null}
            </>
          ) : (
            <Text className="mt-0.5 text-sm text-neutral-500">
              Schedule a return visit if needed
            </Text>
          )}
        </View>

        <View ref={anchorRef} collapsable={false}>
          <Pressable
            onPress={() => {
              anchorRef.current?.measureInWindow((x, y, width, height) =>
                onFollowUp({ x, y, width, height })
              );
            }}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel={
              booked ? "Change follow-up" : "Book follow-up"
            }
            style={{ flexShrink: 0 }}
            className={`min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl px-5 py-3 ${
              locked ? "bg-brand opacity-50" : "bg-brand active:bg-brand-600"
            }`}
          >
            <Ionicons
              name={booked ? "checkmark" : "calendar-outline"}
              size={18}
              color="#fff"
            />
            <Text
              numberOfLines={1}
              className="text-base font-semibold text-white"
            >
              Follow-up
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
