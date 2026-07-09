import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";

import { Screen, TopBar } from "@/ui";
import { useActiveFacility } from "@/lib/auth/store";
import { usePatient } from "@/features/patients/hooks";
import { fullName } from "@/features/patients/utils";
import { VitalsSection } from "@/features/consult/sections/VitalsSection";
import { NotesSection } from "@/features/consult/sections/NotesSection";
import { PrescriptionsSection } from "@/features/consult/sections/PrescriptionsSection";
import { HistorySection } from "@/features/consult/sections/HistorySection";
import { RecordingSection } from "@/features/consult/sections/RecordingSection";
import { DentalChartSection } from "@/features/dental/sections/DentalChartSection";
import { DentalPlanSection } from "@/features/dental/sections/DentalPlanSection";
import { EyeSection } from "@/features/eye/sections/EyeSection";

const BASE_SECTIONS = ["Vitals", "Notes", "Rx", "History", "Audio"];

function sectionsFor(consultationType?: string | null): string[] {
  const t = (consultationType ?? "").toLowerCase();
  if (t.includes("dent")) return ["Chart", "Plan", ...BASE_SECTIONS];
  if (t.includes("eye") || t.includes("ophthal") || t.includes("optom")) {
    return ["Eye", ...BASE_SECTIONS];
  }
  return BASE_SECTIONS;
}

export default function ConsultScreen() {
  const { id, patientId, appointmentId } = useLocalSearchParams<{
    id: string;
    patientId?: string;
    appointmentId?: string;
  }>();
  const facility = useActiveFacility();
  const patient = usePatient(patientId);
  const SECTIONS = sectionsFor(facility?.consultationType);
  const [active, setActive] = useState<string>(SECTIONS[0]);

  return (
    <Screen>
      <TopBar
        title={patient.data ? fullName(patient.data) : "Consultation"}
        subtitle="Consultation"
      />

      <View className="border-b border-neutral-200 bg-white">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
        >
          {SECTIONS.map((s) => {
            const isActive = s === active;
            return (
              <Pressable
                key={s}
                onPress={() => setActive(s)}
                className={`rounded-full px-4 py-2 ${
                  isActive ? "bg-brand" : "bg-neutral-100"
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    isActive ? "text-brand-foreground" : "text-neutral-600"
                  }`}
                >
                  {s}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
        keyboardVerticalOffset={90}
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          <View className="mx-auto w-full max-w-3xl gap-4 p-4 pb-20">
            {active === "Chart" && <DentalChartSection consultationId={id} />}
            {active === "Plan" && <DentalPlanSection consultationId={id} />}
            {active === "Eye" && (
              <EyeSection consultationId={id} appointmentId={appointmentId} />
            )}
            {active === "Vitals" && <VitalsSection consultationId={id} />}
            {active === "Notes" && <NotesSection consultationId={id} />}
            {active === "Rx" && (
              <PrescriptionsSection
                consultationId={id}
                appointmentId={appointmentId}
                patientId={patientId}
              />
            )}
            {active === "History" && (
              <HistorySection consultationId={id} patientId={patientId} />
            )}
            {active === "Audio" && (
              <RecordingSection
                consultationId={id}
                patientId={patientId}
                appointmentId={appointmentId}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
