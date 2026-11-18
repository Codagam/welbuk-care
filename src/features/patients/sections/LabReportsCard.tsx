import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/ui";
import { describeError } from "@/lib/api/errors";
import type { PatientLabReport } from "@/lib/api/endpoints/lab-reports";
import {
  labReportHasViewableFiles,
  labReportSourceLabel,
} from "@/features/consult/labReports";
import { SectionChrome } from "@/features/consult/components/SectionChrome";
import { useLabReportViewer } from "@/features/consult/components/LabReportViewer";
import { usePatientLabReports } from "../hooks";
import { LabReportUploadSheet } from "../LabReportUploadSheet";

function formatDate(value?: string | Date | null): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function LabReportsCard({
  mongoPatientId,
  patientName,
}: {
  mongoPatientId: string;
  patientName?: string;
}) {
  const q = usePatientLabReports(mongoPatientId);
  const rows = q.data ?? [];
  const [uploadOpen, setUploadOpen] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const viewer = useLabReportViewer(patientName);

  const openReport = async (row: PatientLabReport) => {
    setOpeningId(row.id);
    try {
      await viewer.openReport({
        id: row.id,
        test: row.test ?? undefined,
        result: row.result ?? undefined,
        reportPayload: row.reportPayload ?? undefined,
      });
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <View className="gap-2">
      <SectionChrome
        title="Lab reports"
        icon="flask-outline"
        badge={rows.length}
        right={
          <Button
            label="Upload"
            variant="primary"
            size="md"
            className="shrink-0"
            onPress={() => setUploadOpen(true)}
            icon={<Ionicons name="add" size={16} color="#fff" />}
          />
        }
      >
        {q.isLoading && !q.data ? (
          <View className="items-center py-4">
            <ActivityIndicator color="#FD006A" />
          </View>
        ) : q.isError ? (
          <Text className="text-sm text-red-500">{describeError(q.error)}</Text>
        ) : rows.length === 0 ? (
          <Text className="text-xs italic text-neutral-500">
            No lab reports yet.
          </Text>
        ) : (
          <View className="gap-0">
            {rows.map((row, idx) => {
              const canView = labReportHasViewableFiles(row.reportPayload);
              const meta = [
                formatDate(row.date),
                row.status,
                labReportSourceLabel(row.source),
                row.facilityLabel,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <View
                  key={row.id}
                  className={`flex-row items-center gap-2 py-2.5 ${
                    idx < rows.length - 1 ? "border-b border-neutral-100" : ""
                  }`}
                >
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text
                      className="text-xs font-medium text-neutral-900"
                      numberOfLines={1}
                    >
                      {row.test || "Lab report"}
                    </Text>
                    <Text className="text-[10px] text-neutral-500">{meta}</Text>
                    {row.result ? (
                      <Text
                        className="text-[10px] text-neutral-500"
                        numberOfLines={2}
                      >
                        {row.result}
                      </Text>
                    ) : null}
                  </View>
                  {canView ? (
                    <Pressable
                      onPress={() => void openReport(row)}
                      disabled={openingId === row.id}
                      accessibilityLabel={`View ${row.test || "lab report"}`}
                      className="h-7 flex-row items-center gap-0.5"
                    >
                      {openingId === row.id ? (
                        <ActivityIndicator size="small" color="#FD006A" />
                      ) : (
                        <>
                          <Ionicons name="eye-outline" size={14} color="#FD006A" />
                          <Text className="text-xs font-medium text-brand">
                            View
                          </Text>
                        </>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </SectionChrome>

      {viewer.error ? (
        <Text className="text-sm text-red-500">{viewer.error}</Text>
      ) : null}
      {viewer.modal}

      <LabReportUploadSheet
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        patientId={mongoPatientId}
        onSuccess={() => void q.refetch()}
      />
    </View>
  );
}
