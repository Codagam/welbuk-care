import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";

import { Screen, TopBar } from "@/ui";
import { PatientForm } from "@/features/patients/PatientForm";

export default function NewPatientScreen() {
  const router = useRouter();
  return (
    <Screen bgClassName="bg-white">
      <TopBar title="New patient" subtitle="Walk-in registration" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          <View className="mx-auto w-full max-w-2xl p-6">
            <PatientForm
              onSaved={(p) =>
                router.replace({
                  pathname: "/patients/[id]",
                  params: { id: String(p.patientId ?? p.id) },
                })
              }
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
