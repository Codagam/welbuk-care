import {
  ActivityIndicator,
  Platform,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { describeError } from "@/lib/api/errors";
import { AppointmentIntakeCard } from "../components/AppointmentIntakeCard";
import { LiveConversationPanel } from "../components/LiveConversationPanel";
import { PatientRecordsCard } from "../components/PatientRecordsCard";
import { ReportsPanel } from "../components/ReportsPanel";
import { VitalsCard } from "../components/VitalsCard";
import type { ConsultAppointment } from "../consultPatient";
import { useAiEnable, usePatientHistory, useVitals } from "../hooks";
import type { PatientHeaderProps } from "../patientHeader";
import type { DoctorNote, LabReportItem } from "../types";
import { mergeDisplayVitals } from "../vitalsFormat";

/**
 * Compact Patient Details stack:
 * Unified patient/appointment | vitals card → Patient Records →
 * Live Conversation (audio, when ai_enable) → Reports.
 */
export function PatientDetailsSection({
  consultationId,
  patientId,
  header,
  headerLoading,
  headerError,
  appointment,
}: {
  consultationId: string;
  patientId?: string;
  header?: PatientHeaderProps | null;
  headerLoading?: boolean;
  headerError?: unknown;
  appointment?: ConsultAppointment | null;
}) {
  const { width } = useWindowDimensions();
  const sideBySide = width >= 700;

  const vitalsQ = useVitals(consultationId);
  const historyQ = usePatientHistory(patientId, consultationId);
  const aiEnableQ = useAiEnable();
  const aiEnabled = aiEnableQ.data === true;

  const displayVitals = mergeDisplayVitals(
    vitalsQ.data,
    historyQ.data?.patient ?? null
  );

  const medicalHistory = historyQ.data?.medicalHistory;
  const medications = historyQ.data?.medications;
  const allergies = historyQ.data?.allergies;
  const labReports: LabReportItem[] = Array.isArray(historyQ.data?.labReports)
    ? historyQ.data!.labReports!
    : [];
  const doctorNotes: DoctorNote[] = Array.isArray(historyQ.data?.doctorNotes)
    ? historyQ.data!.doctorNotes!
    : [];

  const refreshHistory = () => {
    void historyQ.refetch();
    void vitalsQ.refetch();
  };

  return (
    <View className="gap-3">
      <View
        className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
        style={
          Platform.OS === "ios"
            ? {
                shadowColor: "#0f172a",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
              }
            : { elevation: 2 }
        }
      >
        <View className={sideBySide ? "flex-row items-stretch" : "flex-col"}>
          <View className={sideBySide ? "min-w-0 flex-1" : "w-full"}>
            <AppointmentIntakeCard
              symptoms={appointment?.symptoms}
              reason={appointment?.reason}
              header={header}
              headerLoading={headerLoading}
              headerError={headerError}
              embedded
            />
          </View>

          <View
            className={
              sideBySide
                ? "w-px self-stretch bg-neutral-100"
                : "h-px bg-neutral-100"
            }
          />

          <View className={sideBySide ? "min-w-0 flex-1" : "w-full"}>
            {vitalsQ.isLoading && !vitalsQ.data ? (
              <View className="items-center px-3.5 py-5">
                <ActivityIndicator color="#FD006A" />
              </View>
            ) : vitalsQ.isError && !vitalsQ.data ? (
              <Text className="px-3.5 py-3 text-sm text-red-500">
                {describeError(vitalsQ.error)}
              </Text>
            ) : (
              <VitalsCard
                consultationId={consultationId}
                vitals={displayVitals}
                onVitalsUpdate={() => void vitalsQ.refetch()}
                embedded
              />
            )}
          </View>
        </View>
      </View>

      {historyQ.isLoading && !historyQ.data ? (
        <View className="items-center py-6">
          <ActivityIndicator color="#FD006A" />
        </View>
      ) : historyQ.isError && !historyQ.data ? (
        <View className="rounded-lg border border-neutral-200 bg-white p-4">
          <Text className="text-sm text-red-500">
            {describeError(historyQ.error)}
          </Text>
        </View>
      ) : (
        <PatientRecordsCard
          medicalHistory={medicalHistory}
          medications={medications}
          allergies={allergies}
        />
      )}

      {aiEnabled ? (
        <LiveConversationPanel consultationId={consultationId} />
      ) : null}

      <ReportsPanel
        consultationId={consultationId}
        patientId={patientId}
        patientName={header?.name}
        labReports={labReports}
        doctorNotes={doctorNotes}
        onRefresh={refreshHistory}
      />
    </View>
  );
}
