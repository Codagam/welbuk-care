import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import { DocumentsCard } from "@/features/consult/components/DocumentsCard";
import { usePatient } from "@/features/patients/hooks";
import { QuestionnaireSheet } from "@/features/patients/QuestionnaireSheet";
import { AppointmentsCard } from "@/features/patients/sections/AppointmentsCard";
import { LabReportsCard } from "@/features/patients/sections/LabReportsCard";
import { MedicalHistoryCard } from "@/features/patients/sections/MedicalHistoryCard";
import { PatientHeaderCard } from "@/features/patients/sections/PatientHeaderCard";
import { ReferralsCard } from "@/features/patients/sections/ReferralsCard";
import { describeError } from "@/lib/api/errors";
import { useFacilityId } from "@/lib/auth/store";
import { Button, Screen, TopBar } from "@/ui";

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const facilityId = useFacilityId();
  const qc = useQueryClient();
  const q = usePatient(id);

  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);

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
        title=""
        backLabel="Back"
        right={
          q.data ? (
            <Button
              label="Edit"
              size="md"
              variant="primary"
              className="rounded-md"
              onPress={() =>
                router.push({
                  pathname: "/patients/[id]/edit",
                  params: { id: routeId },
                })
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
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={q.isRefetching}
              onRefresh={() => void refreshAll()}
              tintColor="#FD006A"
            />
          }
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 32,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 1152,
              alignSelf: "center",
              flexDirection: "column",
              gap: 12,
            }}
            className="mx-auto w-full max-w-6xl flex-col gap-3"
          >
            <PatientHeaderCard patient={q.data} />
            {mongoId ? (
              <AppointmentsCard
                mongoPatientId={mongoId}
                routePatientId={routeId}
              />
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
        <QuestionnaireSheet
          open={questionnaireOpen}
          onOpenChange={setQuestionnaireOpen}
          patientId={routeId || mongoId}
          mongoPatientId={mongoId}
          onSaved={() => void refreshAll()}
        />
      ) : null}
    </Screen>
  );
}
