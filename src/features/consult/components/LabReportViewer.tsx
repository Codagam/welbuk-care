import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppModal, Button } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { fetchProxiedFileToCache } from "@/lib/api/fetchProxiedFile";
import type { LabReportItem } from "@/features/consult/types";
import {
  isImageUrl,
  isReportAttachmentPdf,
  labReportFileUrls,
} from "@/features/consult/labReports";
import {
  FileViewerActions,
  ImagePreviewWithFullView,
  ModalSafeArea,
} from "@/features/consult/components/ImagePreview";

type LocalFile = { storageUrl: string; localUri: string };

/**
 * Open a lab report: its note and every file in `reportPayload`.
 *
 * Practice's `/api/patient/lab-reports` keeps the files in
 * `reportPayload.reportImageUrls` / `labReportAttachmentUrls`; `result` is
 * only a display summary (empty, a file NAME, or note text) — never a URL.
 * Opening `result` is what produced the 404 on the patient page.
 */
export function useLabReportViewer(patientName?: string) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Lab report");
  const [note, setNote] = useState<string | null>(null);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openReport = async (item: LabReportItem) => {
    const urls = labReportFileUrls(item.reportPayload);
    const text =
      item.reportPayload?.reportNote?.trim() ||
      item.reportPayload?.radiologyReport?.trim() ||
      null;
    if (urls.length === 0 && !text) return;

    setError(null);
    setTitle(item.test?.trim() || "Lab report");
    setNote(text);
    setFiles([]);
    setOpen(true);
    setLoading(true);
    try {
      const locals: LocalFile[] = [];
      for (const url of urls) {
        const { localUri } = await fetchProxiedFileToCache(url);
        locals.push({ storageUrl: url, localUri });
      }
      setFiles(locals);
    } catch (e) {
      setError(describeError(e));
      if (!text) setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const modal = (
    <AppModal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setOpen(false)}
    >
      <ModalSafeArea>
        <View className="flex-row items-center justify-between border-b border-neutral-200 px-4 py-3">
          <Text
            className="mr-3 flex-1 text-base font-semibold text-neutral-900"
            numberOfLines={1}
          >
            {patientName ? `${patientName} — ${title}` : title}
          </Text>
          <Pressable onPress={() => setOpen(false)} hitSlop={12}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {loading ? (
            <View className="items-center py-10">
              <ActivityIndicator color="#FD006A" />
              <Text className="mt-2 text-xs text-neutral-500">Loading file…</Text>
            </View>
          ) : null}
          {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
          {note ? <Text className="text-sm text-neutral-700">{note}</Text> : null}
          {files.map((file) => {
            const name =
              file.storageUrl.split("/").pop()?.split("?")[0] || "lab-report";
            if (isImageUrl(file.storageUrl)) {
              return (
                <ImagePreviewWithFullView
                  key={file.storageUrl}
                  uri={file.localUri}
                  title={title}
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
                  title={title}
                />
              </View>
            );
          })}
        </ScrollView>
      </ModalSafeArea>
    </AppModal>
  );

  return { openReport, modal, error, loading };
}
