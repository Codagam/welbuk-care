import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { fetchProxiedFileToCache } from "@/lib/api/fetchProxiedFile";
import type { PatientLabReport } from "@/lib/api/endpoints/lab-reports";
import { isImageUrl } from "@/features/consult/labReports";
import { SectionChrome } from "@/features/consult/components/SectionChrome";
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

function fileUrlOf(row: PatientLabReport): string | null {
  const u = (row.fileUrl || row.result || "").trim();
  return u || null;
}

export function LabReportsCard({
  mongoPatientId,
}: {
  mongoPatientId: string;
}) {
  const q = usePatientLabReports(mongoPatientId);
  const rows = q.data ?? [];
  const [uploadOpen, setUploadOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const openReport = async (row: PatientLabReport) => {
    const url = fileUrlOf(row);
    if (!url) return;
    setError(null);
    setOpening(row.id);
    try {
      const { localUri } = await fetchProxiedFileToCache(url);
      if (isImageUrl(url)) {
        await Linking.openURL(localUri);
      } else {
        await Linking.openURL(localUri);
      }
    } catch (e) {
      setError(describeError(e));
    } finally {
      setOpening(null);
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
              const url = fileUrlOf(row);
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
                    <Text className="text-[10px] text-neutral-500">
                      {formatDate(row.date)}
                      {row.status ? ` · ${row.status}` : ""}
                    </Text>
                  </View>
                  {url ? (
                    <Pressable
                      onPress={() => void openReport(row)}
                      disabled={opening === row.id}
                      className="h-7 flex-row items-center gap-0.5"
                    >
                      {opening === row.id ? (
                        <ActivityIndicator size="small" color="#FD006A" />
                      ) : (
                        <>
                          <Ionicons
                            name="eye-outline"
                            size={14}
                            color="#FD006A"
                          />
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

      {error ? <Text className="text-sm text-red-500">{error}</Text> : null}

      <LabReportUploadSheet
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        patientId={mongoPatientId}
        onSuccess={() => void q.refetch()}
      />
    </View>
  );
}
