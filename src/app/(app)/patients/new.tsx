import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";

import { Screen, TopBar } from "@/ui";
import { PatientForm } from "@/features/patients/PatientForm";
import { QuestionnaireSheet } from "@/features/patients/QuestionnaireSheet";
import type { Patient } from "@/features/patients/types";
import { SectionAccessGate } from "@/features/permissions";

/**
 * Full-screen patient registration — Practice web "Add patient".
 *
 * Same order as Practice (`components/patient/create-patient.tsx`): save the
 * patient → the medical-history questionnaire opens straight away → when it
 * closes (finished or skipped with ✕) the new patient's page opens.
 */
export default function NewPatientScreen() {
  const router = useRouter();
  const [created, setCreated] = useState<Patient | null>(null);
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);

  const openPatient = (id: string) =>
    router.replace({ pathname: "/patients/[id]", params: { id } });
  const createdRouteId = created ? String(created.patientId ?? created.id) : "";

  return (
    <Screen bgClassName="bg-neutral-50" edges={["left", "right"]}>
      <TopBar title="New patient" subtitle="Register at this facility" />
      {/* Same key Practice's POST /api/patient/crud checks: `patient.create`. */}
      <SectionAccessGate
        anyPermissionKeys={["patient.create"]}
        sectionLabel="Patient registration"
      >
        {created ? (
          // Registered — the form is done; the questionnaire sheet is on top.
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#FD006A" />
          </View>
        ) : (
          // The form scrolls its own cards and pins Cancel / Save to the
          // bottom of the screen.
          <PatientForm
            onSaved={(p) => {
              if (!p?.id) {
                openPatient(String(p?.patientId ?? ""));
                return;
              }
              setCreated(p);
              setQuestionnaireOpen(true);
            }}
            onOpenExisting={openPatient}
            onCancel={() => router.back()}
          />
        )}
      </SectionAccessGate>

      {created?.id ? (
        <QuestionnaireSheet
          open={questionnaireOpen}
          onOpenChange={(isOpen) => {
            setQuestionnaireOpen(isOpen);
            if (!isOpen) openPatient(createdRouteId);
          }}
          patientId={createdRouteId || created.id}
          mongoPatientId={created.id}
          patientName={
            [created.firstName, created.lastName].filter(Boolean).join(" ") ||
            undefined
          }
          patientDisplayId={created.patientId ?? undefined}
        />
      ) : null}
    </Screen>
  );
}
