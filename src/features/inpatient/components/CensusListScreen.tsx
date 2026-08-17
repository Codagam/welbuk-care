import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { Screen, TextField, TopBar } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { useCanAccessInpatient } from "@/features/permissions/hooks";
import {
  useInpatientAdmissions,
  useInpatientRooms,
  type InpatientStatusFilter,
} from "../hooks";
import type { InpatientListRow } from "../types";
import {
  formatInr,
  formatPersonNameTitleCase,
  inpatientRouteSegment,
  ipDaysBetween,
  ratePerDayFromRoom,
  toDisplayDateDdMmYyyy,
} from "../utils";
import { PatientAvatar } from "./PatientAvatar";

const FILTERS = [
  { id: "admitted" as const, label: "Admitted" },
  { id: "all" as const, label: "All" },
];

export function CensusListScreen() {
  const router = useRouter();
  const { canAccess, isLoading: accessLoading } = useCanAccessInpatient();
  const [filter, setFilter] = useState<InpatientStatusFilter>("admitted");
  const [search, setSearch] = useState("");
  const q = useInpatientAdmissions(filter);
  const roomsQ = useInpatientRooms();

  const openStay = (row: InpatientListRow) => {
    router.push({
      pathname: "/inpatient/[id]",
      params: { id: inpatientRouteSegment(row) },
    });
  };

  const rooms = roomsQ.data ?? [];
  const avail = rooms.filter((r) => r.available).length;
  const totalRooms = rooms.length;
  const runningTotal = useMemo(
    () =>
      (q.data ?? [])
        .filter((a) => a.status !== "DISCHARGED")
        .reduce((sum, a) => {
          const days = ipDaysBetween(a.admitDate, a.dischargeDate);
          return sum + days * ratePerDayFromRoom(a.room);
        }, 0),
    [q.data]
  );

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return q.rows;
    return q.rows.filter((r) =>
      [r.patientName, r.patientCode, r.roomLabel, r.roomNumber, r.doctorShort, r.diagnosis]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [q.rows, search]);

  if (accessLoading) {
    return (
      <Screen>
        <TopBar title="Inpatient" variant="brand" titleCentered backLabel="Back" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FD006A" />
        </View>
      </Screen>
    );
  }

  if (!canAccess) {
    return (
      <Screen>
        <TopBar title="Inpatient" variant="brand" titleCentered backLabel="Back" />
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
    /permission|access denied|inpatient|MODULE_NOT_ENABLED/i.test(
      describeError(q.error)
    );

  return (
    <Screen>
      <TopBar
        title="Inpatient"
        subtitle={`${q.admittedCount} Currently Admitted`}
        variant="brand"
        titleCentered
        backLabel="Back"
      />

      <View className="flex-row gap-2 px-3 pt-3">
        <Kpi
          label="Current Admissions"
          value={String(q.admittedCount)}
          sub={
            roomsQ.isLoading
              ? "Loading rooms…"
              : `${avail}/${totalRooms} rooms free`
          }
        />
        <Kpi
          label="Rooms"
          value={`Available: ${avail}`}
          sub={`Occupied: ${Math.max(0, totalRooms - avail)}`}
        />
        <Kpi
          label="Running Charges"
          value={formatInr(runningTotal)}
          sub="across active admissions"
        />
      </View>

      <View className="border-b border-neutral-200 bg-white px-3 pb-2 pt-2">
        <TextField
          placeholder="Search admissions…"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        <View className="mt-2 flex-row items-center gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                accessibilityRole="button"
                accessibilityLabel={`Show ${f.label}`}
                className={`rounded-full px-4 py-2.5 ${
                  active ? "bg-brand" : "bg-neutral-100"
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    active ? "text-brand-foreground" : "text-neutral-600"
                  }`}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
          data={filteredRows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 32,
            gap: 10,
            flexGrow: 1,
          }}
          renderItem={({ item }) => (
            <AdmissionRow row={item} onOpen={() => openStay(item)} />
          )}
          ListEmptyComponent={
            <Text className="mt-16 text-center text-xs italic text-neutral-500">
              {filter === "admitted"
                ? "No admitted patients."
                : "No admissions yet — use Admission."}
            </Text>
          }
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
        />
      )}
    </Screen>
  );
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <View className="min-w-0 flex-1 rounded-2xl border border-neutral-200 bg-white px-2.5 py-2.5">
      <Text
        className="text-[10px] font-medium uppercase tracking-wide text-neutral-500"
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        className="mt-1 text-sm font-bold text-neutral-900"
        numberOfLines={1}
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
      <Text className="mt-0.5 text-[10px] text-neutral-500" numberOfLines={2}>
        {sub}
      </Text>
    </View>
  );
}

function AdmissionRow({
  row,
  onOpen,
}: {
  row: InpatientListRow;
  onOpen: () => void;
}) {
  const name = formatPersonNameTitleCase(row.patientName);
  const admitted = row.statusKey === "admitted";

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open stay for ${name}`}
      className="overflow-hidden rounded-2xl border border-neutral-200 bg-white px-3.5 py-3 active:bg-neutral-50"
    >
      <View className="flex-row items-center gap-2.5">
        <PatientAvatar name={name} size={36} />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <Text
              className="min-w-0 flex-1 text-base font-bold text-neutral-900"
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
                className={`text-[10px] font-semibold ${
                  admitted ? "text-neutral-700" : "text-emerald-800"
                }`}
              >
                {admitted ? "Admitted" : "Discharged"}
              </Text>
            </View>
          </View>
          <Text className="mt-0.5 text-xs text-neutral-500" numberOfLines={1}>
            #{row.patientCode}
          </Text>
        </View>
      </View>

      <View className="mt-2.5 flex-row items-start justify-between gap-3 border-t border-neutral-100 pt-2.5">
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-neutral-900" numberOfLines={1}>
            {row.roomLabel}
          </Text>
          <Text className="mt-0.5 text-xs text-neutral-500">
            Admitted {toDisplayDateDdMmYyyy(row.admitDateLabel)} · {row.days} day
            {row.days === 1 ? "" : "s"}
          </Text>
          <Text className="text-xs text-neutral-500" numberOfLines={1}>
            {row.doctorShort}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Running
          </Text>
          <Text
            className="mt-0.5 font-mono text-sm font-semibold text-neutral-900"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {formatInr(row.running)}
          </Text>
        </View>
      </View>

      {row.diagnosis ? (
        <Text className="mt-2 text-xs text-neutral-500" numberOfLines={2}>
          {row.diagnosis}
        </Text>
      ) : null}
    </Pressable>
  );
}
