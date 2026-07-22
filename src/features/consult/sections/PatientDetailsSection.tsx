import { ActivityIndicator, Text, View } from "react-native";

import { describeError } from "@/lib/api/errors";
import { AppointmentIntakeCard } from "../components/AppointmentIntakeCard";
import { LiveConversationPanel } from "../components/LiveConversationPanel";
import { PatientHeaderCard } from "../components/PatientHeaderCard";
import { PatientRecordsCard } from "../components/PatientRecordsCard";
import { ReportsPanel } from "../components/ReportsPanel";
import { VitalsCard } from "../components/VitalsCard";
import type { ConsultAppointment } from "../consultPatient";
import { useAiEnable, usePatientHistory, useVitals } from "../hooks";
import type { PatientHeaderProps } from "../patientHeader";
import type { DoctorNote, LabReportItem } from "../types";
import { mergeDisplayVitals } from "../vitalsFormat";

/**
 * Vertical Patient Details stack matching Practice web modules:
 * Identity → Vitals | Appointment Intake (half/half) → Patient Records →
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
  const vitalsQ = useVitals(consultationId);
  const historyQ = usePatientHistory(patientId, consultationId);
  const aiEnableQ = useAiEnable();
  console.log("aiEnableQ", aiEnableQ.data);
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
      <PatientHeaderCard
        header={header}
        loading={headerLoading}
        error={headerError}
      />

      <View className="flex-row items-stretch gap-3">
        <View className="min-w-0 flex-1">
          {vitalsQ.isLoading && !vitalsQ.data ? (
            <View className="items-center py-6">
              <ActivityIndicator color="#FD006A" />
            </View>
          ) : vitalsQ.isError && !vitalsQ.data ? (
            <Text className="px-1 text-sm text-red-500">
              {describeError(vitalsQ.error)}
            </Text>
          ) : (
            <VitalsCard
              consultationId={consultationId}
              vitals={displayVitals}
              onVitalsUpdate={() => void vitalsQ.refetch()}
            />
          )}
        </View>

        <View className="min-w-0 flex-1">
          <AppointmentIntakeCard
            symptoms={appointment?.symptoms}
            reason={appointment?.reason}
          />
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
