import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";

import {
  buildConsultationReportPdf,
  uint8ToBase64,
} from "@/features/patients/buildConsultationReportPdf";
import { usePatient } from "@/features/patients/hooks";
import {
  useConsultation,
  usePrescriptions,
  useSummary,
} from "@/features/consult/hooks";
import { describeError } from "@/lib/api/errors";
import { shareLocalFileOrAlert } from "@/lib/api/shareLocalFile";
import { useActiveFacility } from "@/lib/auth/store";
import { Button, Screen, TopBar } from "@/ui";

function formatDateLabel(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Readable hours:minutes (e.g. 15:05 from ISO / raw time). */
function formatTimeLabel(value?: string | null): string {
  if (!value?.trim()) return "";
  const raw = value.trim();
  if (/^\d{1,2}:\d{2}(\s*[AaPp][Mm])?$/.test(raw)) {
    return raw;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${String(h).padStart(2, "0")}:${m}`;
}

function formatPatientAge(dob?: string | null): string {
  if (!dob) return "—";
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "—";
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  const dayDiff = now.getDate() - birth.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) years -= 1;
  return years >= 0 ? `${years} yrs` : "—";
}

function foodTimingLabel(value?: string | null): string | null {
  if (!value) return null;
  if (value === "AF") return "After Food";
  if (value === "BF") return "Before Food";
  return value;
}

export default function PatientAppointmentReportScreen() {
  const {
    id,
    consultationId,
    appointmentDate,
    appointmentTime,
  } = useLocalSearchParams<{
    id: string;
    consultationId: string;
    appointmentDate?: string;
    appointmentTime?: string;
  }>();

  const patientQ = usePatient(id);
  const consultQ = useConsultation(consultationId);
  const summaryQ = useSummary(consultationId);
  const rxQ = usePrescriptions(consultationId);
  const activeFacility = useActiveFacility();
  const [downloading, setDownloading] = useState(false);

  const loading =
    patientQ.isLoading ||
    consultQ.isLoading ||
    summaryQ.isLoading ||
    rxQ.isLoading;
  const firstError =
    patientQ.error || consultQ.error || summaryQ.error || rxQ.error;

  const patientName = useMemo(() => {
    const p = patientQ.data;
    if (!p) return "Patient";
    return [p.firstName, p.lastName].filter(Boolean).join(" ") || "Patient";
  }, [patientQ.data]);

  const prescriptionRows = (rxQ.data?.prescriptions ?? []).filter(
    (line) => !line.isAttachment
  );

  const consultLabel =
    consultQ.data?.consultation?.consultationNumber ||
    consultQ.data?.consultation?.id ||
    "—";
  const consultDateLabel = formatDateLabel(appointmentDate);
  const patientMeta = `${patientQ.data?.patientId ?? "—"} | ${
    formatPatientAge(patientQ.data?.dob) ?? "—"
  }`;
  const doctorLabel = consultQ.data?.doctor?.name?.trim() || "Doctor";
  const notes =
    summaryQ.data?.doctorNotes?.trim() || "No doctor notes available.";
  const diagnosis = (() => {
    const codes = summaryQ.data?.diagnosisCodes ?? [];
    if (Array.isArray(codes) && codes.length > 0) {
      return codes.map((c) => c.code).filter(Boolean).join(", ");
    }
    return summaryQ.data?.assessment?.trim() || "N/A";
  })();
  const timeLabel = formatTimeLabel(appointmentTime);
  const dateTimeLabel =
    consultDateLabel === "—"
      ? timeLabel || "—"
      : `${consultDateLabel}${timeLabel ? `, ${timeLabel}` : ""}`;

  const facilityName = activeFacility?.name || "Facility";
  const facilityAddress =
    activeFacility?.address?.trim() || "Address not available";

  const onDownloadPdf = async () => {
    setDownloading(true);
    try {
      const bytes = await buildConsultationReportPdf({
        facilityName,
        facilityAddress,
        dateTimeLabel,
        consultLabel: String(consultLabel),
        patientName,
        patientMeta,
        doctorLabel,
        diagnosis,
        notes,
        prescriptionRows,
      });

      const safeName = `prescription-${String(consultLabel)
        .replace(/[^\w.-]+/g, "-")
        .replace(/^-|-$/g, "") || "report"}.pdf`;

      const dir = FileSystem.cacheDirectory;
      if (!dir) {
        throw new Error("Could not access cache directory for PDF download.");
      }
      const dest = `${dir}${safeName}`;
      await FileSystem.writeAsStringAsync(dest, uint8ToBase64(bytes), {
        encoding: FileSystem.EncodingType.Base64,
      });

      await shareLocalFileOrAlert(dest, {
        fileName: safeName,
        dialogTitle: "Download PDF",
      });
    } catch (e) {
      Alert.alert("Download failed", describeError(e));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Screen>
      <TopBar title="Report" subtitle={patientName} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FD006A" />
        </View>
      ) : firstError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-red-500">
            {describeError(firstError)}
          </Text>
        </View>
      ) : (
        <ScrollView>
          <View className="mx-auto w-full max-w-5xl gap-4 p-6 pb-12">
            <View className="rounded-2xl border border-neutral-200 bg-white p-5">
              <View className="flex-row items-start justify-between gap-4 border-b border-neutral-200 pb-3">
                <View className="min-w-0 flex-1">
                  <Text className="text-[30px] font-bold text-neutral-900">
                    {facilityName}
                  </Text>
                  <Text className="mt-1 text-sm text-neutral-500">
                    {facilityAddress}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-sm text-neutral-500">{dateTimeLabel}</Text>
                  <Text className="text-sm text-neutral-500">
                    Prescription ID: {consultLabel}
                  </Text>
                </View>
              </View>

              <View className="mt-4 rounded-xl bg-neutral-50 px-4 py-3">
                <View className="flex-row items-start justify-between gap-4">
                  <View className="min-w-0 flex-1">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Patient
                    </Text>
                    <Text className="mt-1 text-lg font-semibold text-neutral-900">
                      {patientName}
                    </Text>
                    <Text className="text-sm text-neutral-600">
                      ID: {patientMeta}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Physician
                    </Text>
                    <Text className="mt-1 text-base font-semibold text-neutral-900">
                      {doctorLabel}
                    </Text>
                    <Text className="text-sm text-neutral-500">
                      General Medicine
                    </Text>
                  </View>
                </View>
              </View>

              <View className="mt-4 flex-row flex-wrap gap-3">
                <View className="min-h-[110px] min-w-[280px] flex-1 rounded-xl bg-blue-50 p-4">
                  <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-800">
                    Diagnosis
                  </Text>
                  <Text className="text-base text-neutral-800">{diagnosis}</Text>
                </View>
                <View className="min-h-[110px] min-w-[280px] flex-1 rounded-xl bg-amber-50 p-4">
                  <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                    Doctor Notes
                  </Text>
                  <Text className="text-base leading-6 text-neutral-800">
                    {notes}
                  </Text>
                </View>
              </View>

              <Text className="mt-4 text-2xl font-semibold tracking-wide text-neutral-900">
                Rx Prescription
              </Text>
              <View className="overflow-hidden rounded-xl border border-neutral-200">
                <View className="flex-row bg-neutral-900 px-4 py-3">
                  <Text className="flex-[1.7] text-sm font-semibold text-white">
                    Medicine
                  </Text>
                  <Text className="flex-[1.3] text-sm font-semibold text-white">
                    Dosage & Frequency
                  </Text>
                  <Text className="w-14 text-right text-sm font-semibold text-white">
                    Days
                  </Text>
                </View>

                {prescriptionRows.length === 0 ? (
                  <Text className="px-4 py-6 text-sm text-neutral-500">
                    No medicines in this prescription.
                  </Text>
                ) : (
                  prescriptionRows.map((line, idx) => (
                    <View
                      key={line.id}
                      className={`flex-row items-start bg-white px-4 py-3 ${
                        idx < prescriptionRows.length - 1
                          ? "border-b border-neutral-100"
                          : ""
                      }`}
                    >
                      <Text className="flex-[1.7] text-base text-neutral-900">
                        {line.name || "—"}
                      </Text>
                      <Text className="flex-[1.3] text-base text-neutral-700">
                        {[
                          line.dosePattern,
                          foodTimingLabel(line.foodTiming),
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </Text>
                      <Text className="w-14 text-right text-base text-neutral-700">
                        {line.duration ? String(line.duration) : "—"}
                      </Text>
                    </View>
                  ))
                )}
              </View>

              <View className="mt-5 flex-row items-end justify-between gap-4 border-t border-neutral-200 pt-4">
                <View className="shrink-0 gap-1.5">
                  <Text className="text-xs uppercase tracking-wide text-neutral-500">
                    Next Visit
                  </Text>
                  <View className="self-start rounded-xl bg-emerald-50 px-4 py-2">
                    <Text
                      className="text-base font-medium text-emerald-800"
                      numberOfLines={1}
                    >
                      As advised
                    </Text>
                  </View>
                </View>
                <View className="min-w-0 flex-1 items-end gap-1.5">
                  <Text className="text-xs uppercase tracking-wide text-neutral-500">
                    Authorized by
                  </Text>
                  <Text
                    className="text-base font-semibold text-neutral-800"
                    numberOfLines={1}
                  >
                    {doctorLabel}
                  </Text>
                </View>
              </View>
            </View>

            <Text className="text-center text-xs tracking-wide text-neutral-400">
              Powered by Welbuk
            </Text>

            <Button
              label="Download PDF"
              variant="outline"
              loading={downloading}
              onPress={() => void onDownloadPdf()}
              icon={
                downloading ? undefined : (
                  <Ionicons name="download-outline" size={18} color="#171717" />
                )
              }
            />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
