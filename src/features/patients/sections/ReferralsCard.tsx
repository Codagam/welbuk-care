import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { describeError } from "@/lib/api/errors";
import { SectionChrome } from "@/features/consult/components/SectionChrome";
import { usePatientReferrals } from "../hooks";

export function ReferralsCard({
  mongoPatientId,
}: {
  mongoPatientId: string;
}) {
  const [mode, setMode] = useState<"incoming" | "outgoing">("outgoing");
  const q = usePatientReferrals(mongoPatientId, mode);
  const rows = q.data ?? [];

  return (
    <SectionChrome
      title="Referrals"
      icon="git-compare-outline"
      badge={rows.length}
      collapsible
      defaultOpen={false}
    >
      <View className="mb-3 flex-row gap-2">
        {(["outgoing", "incoming"] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            className={`rounded-full px-3 py-1.5 ${
              mode === m ? "bg-brand" : "bg-neutral-100"
            }`}
          >
            <Text
              className={`text-xs font-medium capitalize ${
                mode === m ? "text-white" : "text-neutral-700"
              }`}
            >
              {m}
            </Text>
          </Pressable>
        ))}
      </View>

      {q.isLoading && !q.data ? (
        <View className="items-center py-4">
          <ActivityIndicator color="#FD006A" />
        </View>
      ) : q.isError ? (
        <Text className="text-sm text-red-500">{describeError(q.error)}</Text>
      ) : rows.length === 0 ? (
        <Text className="text-xs italic text-neutral-500">
          No {mode} referrals.
        </Text>
      ) : (
        <View className="gap-0">
          {rows.map((row, idx) => (
            <View
              key={row.id ?? String(idx)}
              className={`gap-0.5 py-2.5 ${
                idx < rows.length - 1 ? "border-b border-neutral-100" : ""
              }`}
            >
              <Text className="text-xs font-medium text-neutral-900">
                {row.referralType || "Referral"}
                {row.priority ? ` · ${row.priority}` : ""}
              </Text>
              <Text className="text-[10px] text-neutral-500">
                {[row.status, row.toFacilityName || row.fromFacilityName]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </Text>
            </View>
          ))}
        </View>
      )}
    </SectionChrome>
  );
}
