import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { Button, Screen, TextField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { usePatientSearch } from "@/features/patients/hooks";
import type { Patient } from "@/features/patients/types";
import {
  calcAge,
  fullName,
  initials,
  normalizeGender,
} from "@/features/patients/utils";

export default function PatientsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const q = usePatientSearch(search);

  const patients = q.data?.pages.flatMap((p) => p.patients) ?? [];
  const total = q.data?.pages[0]?.totalCount ?? 0;

  return (
    <Screen>
      <View className="gap-3 border-b border-neutral-200 bg-white px-6 pb-4 pt-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-neutral-900">Patients</Text>
          <Button
            label="+ New"
            size="md"
            onPress={() => router.push("/patients/new")}
          />
        </View>
        <TextField
          placeholder="Search name, phone, ABHA…"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {total ? (
          <Text className="text-xs text-neutral-500">
            {total} patient{total === 1 ? "" : "s"}
          </Text>
        ) : null}
      </View>

      {q.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FD006A" />
        </View>
      ) : q.isError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-red-500">
            {describeError(q.error)}
          </Text>
        </View>
      ) : (
        <FlatList
          data={patients}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => (
            <PatientRow
              patient={item}
              onPress={() =>
                router.push({
                  pathname: "/patients/[id]",
                  params: { id: item.id },
                })
              }
            />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
          }}
          ListEmptyComponent={
            <Text className="mt-10 text-center text-sm text-neutral-500">
              No patients found.
            </Text>
          }
          ListFooterComponent={
            q.isFetchingNextPage ? (
              <ActivityIndicator className="my-4" color="#FD006A" />
            ) : null
          }
          refreshing={q.isRefetching && !q.isFetchingNextPage}
          onRefresh={() => q.refetch()}
        />
      )}
    </Screen>
  );
}

function PatientRow({
  patient,
  onPress,
}: {
  patient: Patient;
  onPress: () => void;
}) {
  const age = calcAge(patient.dob);
  const meta = [
    normalizeGender(patient.gender),
    age != null ? `${age}y` : null,
    patient.phone,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 active:bg-neutral-50"
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-50">
        <Text className="text-sm font-bold text-brand-700">
          {initials(patient)}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-neutral-900">
          {fullName(patient)}
        </Text>
        {meta ? <Text className="text-xs text-neutral-500">{meta}</Text> : null}
      </View>
      {patient.abhaNumber ? (
        <View className="rounded-full bg-emerald-50 px-2 py-0.5">
          <Text className="text-[10px] font-medium text-emerald-700">ABHA</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
