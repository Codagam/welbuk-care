import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { fetchProxiedFileToCache } from "@/lib/api/fetchProxiedFile";
import type { LabReportItem } from "@/features/consult/types";
import {
  isImageUrl,
  isReportAttachmentPdf,
  labReportFileUrls,
  labReportHasViewableFiles,
  labReportSourceLabel,
} from "@/features/consult/labReports";
import {
  FileViewerActions,
  ImagePreviewWithFullView,
  ModalSafeArea,
} from "@/features/consult/components/ImagePreview";

type LocalFile = { storageUrl: string; localUri: string };

export function LabsCard({
  labReports,
  onRefer,
  patientName,
}: {
  labReports: LabReportItem[];
  onRefer: () => void;
  patientName?: string;
}) {
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTitle, setViewTitle] = useState("Lab report");
  const [viewNote, setViewNote] = useState<string | null>(null);
  const [viewFiles, setViewFiles] = useState<LocalFile[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openLabReport = async (item: LabReportItem) => {
    const urls = labReportFileUrls(item.reportPayload);
    const note =
      item.reportPayload?.reportNote?.trim() ||
      item.reportPayload?.radiologyReport?.trim() ||
      null;
    if (urls.length === 0 && !note) return;

    setError(null);
    setViewTitle(item.test?.trim() || "Lab report");
    setViewNote(note);
    setViewFiles([]);
    setViewOpen(true);
    setViewLoading(true);
    try {
      const locals: LocalFile[] = [];
      for (const url of urls) {
        const { localUri } = await fetchProxiedFileToCache(url);
        locals.push({ storageUrl: url, localUri });
      }
      setViewFiles(locals);
    } catch (e) {
      setError(describeError(e));
      if (!note) setViewOpen(false);
    } finally {
      setViewLoading(false);
    }
  };

  return (
    <View
      style={{ width: "100%", flexDirection: "column" }}
      className="w-full flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5"
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-lg font-semibold tracking-tight text-brand">
            Labs
          </Text>
          <Text className="text-sm text-neutral-500">
            Patient lab reports on file
          </Text>
        </View>
        <Pressable
          onPress={onRefer}
          accessibilityRole="button"
          accessibilityLabel="Refer"
          className="min-h-[48px] min-w-[96px] items-center justify-center rounded-xl bg-brand px-5 py-3 active:bg-brand-600"
        >
          <Text className="text-base font-semibold text-white">Refer</Text>
        </Pressable>
      </View>

      {labReports.length === 0 ? (
        <View className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6">
          <Text className="text-center text-sm text-neutral-400">
            No patient lab reports on file.
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {labReports.map((r, i) => {
            const canView = labReportHasViewableFiles(r.reportPayload);
            return (
              <View
                key={r.id ?? `${r.date}-${r.test}-${i}`}
                className="flex-row items-start gap-2 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5"
              >
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold text-neutral-900">
                    {r.test || "Lab report"}
                  </Text>
                  <Text className="mt-0.5 text-xs text-neutral-500">
                    {[r.date, r.status, labReportSourceLabel(r.source)]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                  {r.result ? (
                    <Text
                      className="mt-0.5 text-xs text-neutral-500"
                      numberOfLines={2}
                    >
                      {r.result}
                    </Text>
                  ) : null}
                </View>
                {canView ? (
                  <Pressable
                    onPress={() => void openLabReport(r)}
                    className="h-8 w-8 items-center justify-center rounded-md bg-brand/10"
                    accessibilityLabel={`View ${r.test || "lab report"}`}
                  >
                    <Ionicons name="eye-outline" size={18} color="#FD006A" />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {error ? <Text className="text-sm text-red-500">{error}</Text> : null}

      <Modal
        visible={viewOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setViewOpen(false)}
      >
        <ModalSafeArea>
          <View className="flex-row items-center justify-between border-b border-neutral-200 px-4 py-3">
            <Text
              className="mr-3 flex-1 text-base font-semibold text-neutral-900"
              numberOfLines={1}
            >
              {patientName ? `${patientName} — ${viewTitle}` : viewTitle}
            </Text>
            <Pressable onPress={() => setViewOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {viewLoading ? (
              <View className="items-center py-10">
                <ActivityIndicator color="#FD006A" />
                <Text className="mt-2 text-xs text-neutral-500">
                  Loading file…
                </Text>
              </View>
            ) : null}
            {viewNote ? (
              <Text className="text-sm text-neutral-700">{viewNote}</Text>
            ) : null}
            {viewFiles.map((file) => {
              const name =
                file.storageUrl.split("/").pop()?.split("?")[0] || "lab-report";
              if (isImageUrl(file.storageUrl)) {
                return (
                  <ImagePreviewWithFullView
                    key={file.storageUrl}
                    uri={file.localUri}
                    title={viewTitle}
                    fileName={name}
                    height={320}
                  />
                );
              }
              return (
                <View key={file.storageUrl} className="items-center gap-3">
                  <Button
                    label={
                      isReportAttachmentPdf(file.storageUrl)
                        ? "Open PDF"
                        : "Open attachment"
                    }
                    variant="outline"
                    onPress={() => void Linking.openURL(file.localUri)}
                  />
                  <FileViewerActions
                    localUri={file.localUri}
                    fileName={name}
                    title={viewTitle}
                  />
                </View>
              );
            })}
          </ScrollView>
        </ModalSafeArea>
      </Modal>
    </View>
  );
}
