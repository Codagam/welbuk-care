import { Pressable, Text, View } from "react-native";

import type { LabReportItem } from "@/features/consult/types";

export function LabsCard({
  labReports,
  onRefer,
}: {
  labReports: LabReportItem[];
  onRefer: () => void;
}) {
  return (
    <View
      style={{ width: "100%", flexDirection: "column" }}
      className="w-full flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5"
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-lg font-semibold tracking-tight text-brand">
            Labs
          </Text>
          <Text className="text-sm text-neutral-500">
            Patient lab reports on file
          </Text>
        </View>
        <Pressable
          onPress={onRefer}
          accessibilityRole="button"
          accessibilityLabel="Refer"
          className="min-h-[48px] min-w-[96px] items-center justify-center rounded-xl bg-brand px-5 py-3 active:bg-brand-600"
        >
          <Text className="text-base font-semibold text-white">Refer</Text>
        </Pressable>
      </View>

      {labReports.length === 0 ? (
        <View className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6">
          <Text className="text-center text-sm text-neutral-400">
            No patient lab reports on file.
          </Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {labReports.map((r, i) => (
            <View
              key={r.id ?? `${r.date}-${r.test}-${i}`}
              className="min-w-[200px] flex-1 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5"
            >
              <Text className="text-sm font-semibold text-neutral-900">
                {r.test || "Lab report"}
              </Text>
              <Text className="mt-0.5 text-xs text-neutral-500">
                {[r.date, r.result, r.status].filter(Boolean).join(" · ")}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
