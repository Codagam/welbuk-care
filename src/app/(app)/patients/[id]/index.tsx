import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button, Screen, TopBar } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { usePatient } from "@/features/patients/hooks";
import {
  calcAge,
  formatDob,
  fullName,
  initials,
  normalizeGender,
} from "@/features/patients/utils";
import { PatientCareActions } from "@/features/care/PatientCareActions";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="w-1/2 gap-0.5 py-2 pr-4">
      <Text className="text-xs uppercase tracking-wide text-neutral-400">
        {label}
      </Text>
      <Text className="text-base text-neutral-900">{value || "—"}</Text>
    </View>
  );
}

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = usePatient(id);

  return (
    <Screen>
      <TopBar
        title="Patient"
        right={
          q.data ? (
            <Button
              label="Edit"
              size="md"
              variant="outline"
              onPress={() =>
                router.push({ pathname: "/patients/[id]/edit", params: { id } })
              }
            />
          ) : undefined
        }
      />
      {q.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FD006A" />
        </View>
      ) : q.isError || !q.data ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-red-500">
            {q.error ? describeError(q.error) : "Patient not found."}
          </Text>
        </View>
      ) : (
        <ScrollView>
          <View className="mx-auto w-full max-w-2xl gap-5 p-6">
            <View className="flex-row items-center gap-4">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-50">
                <Text className="text-xl font-bold text-brand-700">
                  {initials(q.data)}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-2xl font-bold text-neutral-900">
                  {fullName(q.data)}
                </Text>
                <Text className="text-sm text-neutral-500">
                  #{String(q.data.patientId)}
                  {q.data.abhaNumber ? "  ·  ABHA linked" : ""}
                </Text>
              </View>
            </View>

            <View className="flex-row flex-wrap rounded-2xl border border-neutral-200 bg-white px-4 py-2">
              <Field label="Gender" value={normalizeGender(q.data.gender)} />
              <Field
                label="Age"
                value={
                  calcAge(q.data.dob) != null ? `${calcAge(q.data.dob)} years` : "—"
                }
              />
              <Field label="Date of birth" value={formatDob(q.data.dob)} />
              <Field label="Blood group" value={q.data.bloodGroup} />
              <Field label="Mobile" value={q.data.phone} />
              <Field label="Email" value={q.data.email} />
              <Field label="ABHA" value={q.data.abhaNumber} />
              <Field label="Guardian" value={q.data.parentOrGuardianName} />
            </View>

            {q.data.address ? (
              <View className="gap-0.5 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                <Text className="text-xs uppercase tracking-wide text-neutral-400">
                  Address
                </Text>
                <Text className="text-base text-neutral-900">
                  {q.data.address}
                </Text>
              </View>
            ) : null}

            <View className="gap-3 pt-2">
              <Text className="text-lg font-semibold text-neutral-900">Care</Text>
              <PatientCareActions patientId={q.data.id} />
            </View>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
