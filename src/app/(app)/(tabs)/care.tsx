import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import type { UseQueryResult } from "@tanstack/react-query";

import { Button, Screen, Segmented } from "@/ui";
import { describeError } from "@/lib/api/errors";
import {
  useFacilityCalls,
  useMyAssignments,
  useUpdateCall,
} from "@/features/care/hooks";
import type { Assignment, PatientCall } from "@/features/care/types";

const TABS = ["Calls", "My Patients"] as const;

function priorityChip(priority: string): { bg: string; text: string } {
  switch (priority.toUpperCase()) {
    case "URGENT":
      return { bg: "bg-red-100", text: "text-red-700" };
    case "HIGH":
      return { bg: "bg-orange-100", text: "text-orange-700" };
    case "LOW":
      return { bg: "bg-neutral-100", text: "text-neutral-500" };
    default:
      return { bg: "bg-blue-50", text: "text-blue-700" };
  }
}

export default function CareScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Calls");
  const calls = useFacilityCalls();
  const assignments = useMyAssignments();
  const updateCall = useUpdateCall();

  const openPatient = (id: string) =>
    router.push({ pathname: "/patients/[id]", params: { id } });

  return (
    <Screen>
      <View className="gap-3 border-b border-neutral-200 bg-white px-6 pb-3 pt-6">
        <Text className="text-2xl font-bold text-neutral-900">Care</Text>
        <Segmented options={TABS} value={tab} onChange={setTab} />
      </View>

      {tab === "Calls" ? (
        <CallsList
          q={calls}
          busy={updateCall.isPending}
          onAck={(id) => updateCall.mutate({ id, action: "acknowledge" })}
          onResolve={(id) => updateCall.mutate({ id, action: "resolve" })}
          onOpen={openPatient}
        />
      ) : (
        <AssignmentsList q={assignments} onOpen={openPatient} />
      )}
    </Screen>
  );
}

function CallsList({
  q,
  busy,
  onAck,
  onResolve,
  onOpen,
}: {
  q: UseQueryResult<PatientCall[]>;
  busy: boolean;
  onAck: (id: string) => void;
  onResolve: (id: string) => void;
  onOpen: (patientId: string) => void;
}) {
  if (q.isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#FD006A" />
      </View>
    );
  }
  if (q.isError) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-center text-sm text-red-500">
          {describeError(q.error)}
        </Text>
      </View>
    );
  }
  return (
    <FlatList
      data={q.data ?? []}
      keyExtractor={(c) => c.id}
      contentContainerStyle={{ padding: 16, gap: 8 }}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      ListEmptyComponent={
        <Text className="mt-10 text-center text-sm text-neutral-500">
          No active care requests.
        </Text>
      }
      renderItem={({ item }) => {
        const chip = priorityChip(item.priority);
        const acknowledged = item.status === "ACKNOWLEDGED" || item.status === "IN_PROGRESS";
        return (
          <View className="gap-2 rounded-2xl border border-neutral-200 bg-white p-4">
            <View className="flex-row items-center justify-between">
              <Pressable onPress={() => onOpen(item.patientId)} className="flex-1">
                <Text className="text-base font-semibold text-neutral-900">
                  {item.patientName ?? "Patient"}
                </Text>
                <Text className="text-xs text-neutral-500">
                  {item.type.toLowerCase()} · {new Date(item.createdAt).toLocaleTimeString()}
                </Text>
              </Pressable>
              <View className={`rounded-full px-2.5 py-1 ${chip.bg}`}>
                <Text className={`text-[11px] font-medium ${chip.text}`}>
                  {item.priority}
                </Text>
              </View>
            </View>
            {item.note ? (
              <Text className="text-sm text-neutral-700">{item.note}</Text>
            ) : null}
            <View className="flex-row gap-2">
              {!acknowledged ? (
                <Button
                  label="Acknowledge"
                  size="md"
                  variant="outline"
                  className="flex-1"
                  onPress={() => onAck(item.id)}
                  disabled={busy}
                />
              ) : null}
              <Button
                label="Resolve"
                size="md"
                className="flex-1"
                onPress={() => onResolve(item.id)}
                disabled={busy}
              />
            </View>
          </View>
        );
      }}
    />
  );
}

function AssignmentsList({
  q,
  onOpen,
}: {
  q: UseQueryResult<Assignment[]>;
  onOpen: (patientId: string) => void;
}) {
  if (q.isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#FD006A" />
      </View>
    );
  }
  return (
    <FlatList
      data={q.data ?? []}
      keyExtractor={(a) => a.id}
      contentContainerStyle={{ padding: 16, gap: 8 }}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      ListEmptyComponent={
        <Text className="mt-10 text-center text-sm text-neutral-500">
          No patients assigned to you.
        </Text>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onOpen(item.patientId)}
          className="flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 active:bg-neutral-50"
        >
          <View>
            <Text className="text-base font-semibold text-neutral-900">
              {item.patientName ?? "Patient"}
            </Text>
            <Text className="text-xs text-neutral-500">
              {[item.role, item.scope.toLowerCase()].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <Text className="text-neutral-300">›</Text>
        </Pressable>
      )}
    />
  );
}
