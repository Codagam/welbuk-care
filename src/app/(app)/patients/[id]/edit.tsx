import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Screen, TopBar } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { usePatient } from "@/features/patients/hooks";
import { PatientForm } from "@/features/patients/PatientForm";

export default function EditPatientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = usePatient(id);

  return (
    <Screen bgClassName="bg-white">
      <TopBar title="Edit patient" />
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            <View className="mx-auto w-full max-w-2xl p-6">
              <PatientForm patient={q.data} onSaved={() => router.back()} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}
