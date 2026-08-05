import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Screen, Segmented, TopBar } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { useCanAccessInpatient } from "@/features/permissions/hooks";
import {
  useInpatientAdmissions,
  type InpatientStatusFilter,
} from "@/features/inpatient/hooks";
import type { InpatientListRow } from "@/features/inpatient/types";
import {
  formatInr,
  formatPersonNameTitleCase,
  inpatientRouteSegment,
  personInitials,
  toDisplayDateDdMmYyyy,
} from "@/features/inpatient/utils";

const FILTER_OPTIONS = ["Admitted", "All"] as const;

function filterFromLabel(
  label: (typeof FILTER_OPTIONS)[number]
): InpatientStatusFilter {
  return label === "All" ? "all" : "admitted";
}

export default function InpatientListScreen() {
  const router = useRouter();
  const { canAccess, isLoading: accessLoading } = useCanAccessInpatient();
  const [filterLabel, setFilterLabel] =
    useState<(typeof FILTER_OPTIONS)[number]>("Admitted");
  const filter = filterFromLabel(filterLabel);
  const q = useInpatientAdmissions(filter);

  const openBill = (row: InpatientListRow) => {
    router.push({
      pathname: "/inpatient/[id]",
      params: { id: inpatientRouteSegment(row) },
    });
  };

  if (accessLoading) {
    return (
      <Screen>
        <TopBar title="Inpatients" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FD006A" />
        </View>
      </Screen>
    );
  }

  if (!canAccess) {
    return (
      <Screen>
        <TopBar title="Inpatients" />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-neutral-600">
            You do not have permission to view inpatient admissions, or this
            facility does not include the in-patient plan feature.
          </Text>
        </View>
      </Screen>
    );
  }

  const permissionDenied =
    q.isError &&
    /permission|access denied|inpatient/i.test(describeError(q.error));

  return (
    <Screen>
      <TopBar title="Inpatients" subtitle="IP census" />
      <View className="gap-2 border-b border-neutral-200 bg-white px-4 pb-3 pt-2">
        <Segmented
          options={FILTER_OPTIONS}
          value={filterLabel}
          onChange={setFilterLabel}
        />
        <Text className="text-xs text-neutral-500">
          {filter === "admitted"
            ? `${q.admittedCount} admitted`
            : `${q.totalCount} admission${q.totalCount === 1 ? "" : "s"}`}
        </Text>
      </View>

      {q.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FD006A" />
        </View>
      ) : q.isError ? (
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-center text-sm text-red-500">
            {permissionDenied
              ? "You do not have permission to view inpatient admissions."
              : describeError(q.error)}
          </Text>
        </View>
      ) : (
        <FlatList
          data={q.rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 24,
            gap: 8,
          }}
          renderItem={({ item }) => (
            <AdmissionRow row={item} onOpenBill={() => openBill(item)} />
          )}
          ListEmptyComponent={
            <Text className="mt-10 text-center text-sm text-neutral-500">
              {filter === "admitted"
                ? "No admitted patients."
                : "No admissions found."}
            </Text>
          }
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
        />
      )}
    </Screen>
  );
}

function AdmissionRow({
  row,
  onOpenBill,
}: {
  row: InpatientListRow;
  onOpenBill: () => void;
}) {
  const name = formatPersonNameTitleCase(row.patientName);
  const roomMeta = [
    row.roomType,
    row.roomNumber !== "—" ? `#${row.roomNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const meta = [
    row.ipSerial != null ? `IP-${row.ipSerial}` : null,
    `#${row.patientCode}`,
    `${row.days}d`,
    row.doctorShort,
  ]
    .filter(Boolean)
    .join(" · ");

  const admitted = row.statusKey === "admitted";

  return (
    <View className="rounded-2xl border border-neutral-200 bg-white">
      <View className="flex-row items-stretch">
        <Pressable
          onPress={onOpenBill}
          accessibilityRole="button"
          accessibilityLabel={`View billing for ${name}`}
          className="min-w-0 flex-1 px-4 py-3 active:bg-neutral-50"
        >
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-50">
              <Text className="text-sm font-bold text-brand-700">
                {personInitials(name)}
              </Text>
            </View>
            <View className="min-w-0 flex-1">
              <View className="flex-row items-center gap-2">
                <Text
                  className="min-w-0 flex-1 text-base font-semibold text-neutral-900"
                  numberOfLines={1}
                >
                  {name}
                </Text>
                <View
                  className={`rounded-full px-2 py-0.5 ${
                    admitted ? "bg-neutral-100" : "bg-emerald-50"
                  }`}
                >
                  <Text
                    className={`text-[10px] font-medium ${
                      admitted ? "text-neutral-700" : "text-emerald-700"
                    }`}
                  >
                    {admitted ? "Admitted" : "Discharged"}
                  </Text>
                </View>
              </View>
              {meta ? (
                <Text className="text-xs text-neutral-500" numberOfLines={1}>
                  {meta}
                </Text>
              ) : null}
            </View>
          </View>

          <View className="mt-2 flex-row items-start justify-between gap-3 border-t border-neutral-100 pt-2">
            <View className="min-w-0 flex-1">
              <Text className="text-sm text-neutral-800" numberOfLines={1}>
                {row.roomLabel}
              </Text>
              {roomMeta ? (
                <Text className="text-xs text-neutral-500">{roomMeta}</Text>
              ) : null}
              <Text className="mt-0.5 text-xs text-neutral-500">
                Admitted {toDisplayDateDdMmYyyy(row.admitDateLabel)}
              </Text>
            </View>
            <View className="items-end">
              <Text className="font-mono text-sm font-semibold text-neutral-900">
                {formatInr(row.running)}
              </Text>
              <Text className="text-[10px] text-neutral-500">Running</Text>
            </View>
          </View>

          {row.diagnosis ? (
            <Text className="mt-1.5 text-xs text-neutral-500" numberOfLines={2}>
              {row.diagnosis}
            </Text>
          ) : null}
        </Pressable>

        {/* Eye — View billing (web IPListClient actions parity) */}
        <Pressable
          onPress={onOpenBill}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="View billing"
          className="items-center justify-center border-l border-neutral-100 px-3 active:bg-brand-50"
        >
          <Ionicons name="eye-outline" size={22} color="#FD006A" />
        </Pressable>
      </View>
    </View>
  );
}
