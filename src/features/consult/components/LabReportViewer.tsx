import { useState, type ReactNode } from "react";
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
type ResultRow = { name: string; display: string };

/**
 * `payload.results` is `{ "Haemoglobin": "13.2" }` or
 * `{ "Haemoglobin": { value, unit, interpretation } }` — same rendering as
 * Practice's lab-report-view-dialog.
 */
function labResultRows(results: unknown): ResultRow[] {
  if (!results || typeof results !== "object" || Array.isArray(results)) {
    return [];
  }
  return Object.entries(results as Record<string, unknown>).map(
    ([name, value]) => {
      if (
        value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        "value" in value
      ) {
        const o = value as {
          value?: unknown;
          unit?: unknown;
          interpretation?: unknown;
        };
        const v = o.value != null ? String(o.value) : "—";
        const u = o.unit != null ? ` ${String(o.unit)}` : "";
        const i = o.interpretation != null ? ` (${String(o.interpretation)})` : "";
        return { name, display: `${v}${u}${i}`.trim() };
      }
      return { name, display: value != null ? String(value) : "—" };
    }
  );
}

function formatGeneratedAt(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReportBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-semibold text-neutral-900">{title}</Text>
      {children}
    </View>
  );
}

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
  const [radiology, setRadiology] = useState<string | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openReport = async (item: LabReportItem) => {
    const payload = item.reportPayload;
    const urls = labReportFileUrls(payload);
    const noteText = payload?.reportNote?.trim() || null;
    const radiologyText = payload?.radiologyReport?.trim() || null;
    const resultRows = labResultRows(payload?.results);
    const text = noteText || radiologyText || resultRows.length > 0;
    if (urls.length === 0 && !text) return;

    setError(null);
    setTitle(item.test?.trim() || "Lab report");
    setNote(noteText);
    setRadiology(radiologyText);
    setResults(resultRows);
    setGeneratedAt(payload?.reportGeneratedAt ?? null);
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
          {generatedAt && formatGeneratedAt(generatedAt) ? (
            <Text className="text-xs text-neutral-500">
              Report generated {formatGeneratedAt(generatedAt)}
            </Text>
          ) : null}
          {results.length > 0 ? (
            <ReportBlock title="Lab results">
              <View className="overflow-hidden rounded-xl border border-neutral-200">
                <View className="flex-row border-b border-neutral-200 bg-neutral-50 px-3 py-2">
                  <Text className="w-2/5 text-xs font-semibold text-neutral-600">
                    Test / parameter
                  </Text>
                  <Text className="flex-1 text-xs font-semibold text-neutral-600">
                    Result
                  </Text>
                </View>
                {results.map((r, i) => (
                  <View
                    key={r.name}
                    className={`flex-row px-3 py-2 ${
                      i < results.length - 1 ? "border-b border-neutral-100" : ""
                    }`}
                  >
                    <Text className="w-2/5 pr-2 text-sm font-medium text-neutral-900">
                      {r.name}
                    </Text>
                    <Text className="flex-1 text-sm text-neutral-800">
                      {r.display}
                    </Text>
                  </View>
                ))}
              </View>
            </ReportBlock>
          ) : null}
          {radiology ? (
            <ReportBlock title="Radiology report">
              <Text className="text-sm text-neutral-700">{radiology}</Text>
            </ReportBlock>
          ) : null}
          {note ? (
            <ReportBlock title="Report note">
              <Text className="text-sm text-neutral-700">{note}</Text>
            </ReportBlock>
          ) : null}
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
