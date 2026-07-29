import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";

import { Button, Screen, TopBar } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { useFacilityId } from "@/lib/auth/store";
import { usePatient } from "@/features/patients/hooks";
import { PatientHeaderCard } from "@/features/patients/sections/PatientHeaderCard";
import { AppointmentsCard } from "@/features/patients/sections/AppointmentsCard";
import { MedicalHistoryCard } from "@/features/patients/sections/MedicalHistoryCard";
import { ReferralsCard } from "@/features/patients/sections/ReferralsCard";
import { LabReportsCard } from "@/features/patients/sections/LabReportsCard";
import { DocumentsCard } from "@/features/consult/components/DocumentsCard";
import { QuestionnaireSheet } from "@/features/patients/QuestionnaireSheet";
import { UnlinkPatientDialog } from "@/features/patients/UnlinkPatientDialog";

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const facilityId = useFacilityId();
  const qc = useQueryClient();
  const q = usePatient(id);

  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const mongoId = q.data?.id;
  const routeId = id ?? "";

  const refreshAll = async () => {
    await q.refetch();
    if (!mongoId) return;
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["patient-questionnaire"] }),
      qc.invalidateQueries({ queryKey: ["patient-appointments", mongoId] }),
      qc.invalidateQueries({ queryKey: ["patient-referrals", mongoId] }),
      qc.invalidateQueries({ queryKey: ["patient-lab-reports", mongoId] }),
      qc.invalidateQueries({ queryKey: ["patient-documents", mongoId] }),
    ]);
  };

  return (
    <Screen>
      <TopBar
        title="Patient"
        right={
          q.data ? (
            <View className="flex-row items-center gap-2">
              <Button
                label="Edit"
                size="md"
                variant="outline"
                onPress={() =>
                  router.push({
                    pathname: "/patients/[id]/edit",
                    params: { id: routeId },
                  })
                }
              />
              <Pressable
                onPress={() => setMenuOpen((v) => !v)}
                hitSlop={10}
                className="h-10 w-10 items-center justify-center rounded-full border border-neutral-200"
                accessibilityLabel="More actions"
              >
                <Ionicons name="ellipsis-vertical" size={18} color="#404040" />
              </Pressable>
            </View>
          ) : undefined
        }
      />

      {menuOpen && q.data ? (
        <View className="absolute right-4 top-16 z-20 min-w-[180px] rounded-xl border border-neutral-200 bg-white shadow-lg">
          <Pressable
            onPress={() => {
              setMenuOpen(false);
              setUnlinkOpen(true);
            }}
            className="px-4 py-3 active:bg-neutral-50"
          >
            <Text className="text-sm text-red-600">Remove from facility</Text>
          </Pressable>
        </View>
      ) : null}

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
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={q.isRefetching}
              onRefresh={() => void refreshAll()}
              tintColor="#FD006A"
            />
          }
        >
          <View className="mx-auto w-full max-w-3xl gap-4 p-6 pb-10">
            <PatientHeaderCard patient={q.data} />
            {mongoId ? (
              <AppointmentsCard mongoPatientId={mongoId} routePatientId={routeId} />
            ) : null}
            <MedicalHistoryCard
              patientId={routeId || mongoId!}
              onEdit={() => setQuestionnaireOpen(true)}
            />
            {mongoId ? <ReferralsCard mongoPatientId={mongoId} /> : null}
            {mongoId ? <LabReportsCard mongoPatientId={mongoId} /> : null}
            {mongoId ? <DocumentsCard patientId={mongoId} /> : null}
            {!facilityId ? (
              <Text className="text-xs text-amber-700">
                Select a facility to load chart sections.
              </Text>
            ) : null}
          </View>
        </ScrollView>
      )}

      {q.data && mongoId ? (
        <>
          <QuestionnaireSheet
            open={questionnaireOpen}
            onOpenChange={setQuestionnaireOpen}
            patientId={routeId || mongoId}
            mongoPatientId={mongoId}
            onSaved={() => void refreshAll()}
          />
          <UnlinkPatientDialog
            open={unlinkOpen}
            onOpenChange={setUnlinkOpen}
            patient={q.data}
            onUnlinked={() => router.replace("/(app)/(tabs)/patients")}
          />
        </>
      ) : null}
    </Screen>
  );
}
