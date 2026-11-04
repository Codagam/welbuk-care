import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
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
  labReportHasViewableFiles,
} from "@/features/consult/labReports";
import {
  FileViewerActions,
  ImagePreviewWithFullView,
  ModalSafeArea,
} from "@/features/consult/components/ImagePreview";

import {
  filterLabReports,
  resultLabel,
  type ReferralTableRow,
} from "../labsTable";

type LocalFile = { storageUrl: string; localUri: string };

/** Header aside, about two rows: the card stays short, and the list scrolls inside it. */
const REPORT_ROWS_MAX_HEIGHT = 100;
const DATE_COLUMN = 76;
const ACTION_COLUMN = 48;
/** Below this the Result column is dropped, as on a phone in Practice. */
const RESULT_COLUMN_MIN_WIDTH = 480;

const REFERRAL_COLUMNS = [
  { label: "Date", flex: 1.3 },
  { label: "Type", flex: 0.8 },
  { label: "Mode", flex: 0.8 },
  { label: "Tests", flex: 1.6 },
  { label: "Status", flex: 0.8 },
];

export function LabsCard({
  labReports,
  referrals = [],
  onRefer,
  patientName,
}: {
  labReports: LabReportItem[];
  referrals?: ReferralTableRow[];
  onRefer: () => void;
  patientName?: string;
}) {
  const [query, setQuery] = useState("");
  const [width, setWidth] = useState(0);
  const reportRows = useMemo(
    () => filterLabReports(labReports, query),
    [labReports, query]
  );
  const showResult = width >= RESULT_COLUMN_MIN_WIDTH;
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
      <View className="flex-row flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3">
        <View className="flex-row items-center gap-2">
          <Ionicons name="flask-outline" size={20} color="#FD006A" />
          <Text className="text-lg font-semibold text-brand">Labs</Text>
        </View>
        <Pressable
          onPress={onRefer}
          accessibilityRole="button"
          accessibilityLabel="Refer"
          style={{ flexShrink: 0 }}
          className="h-11 flex-row items-center justify-center gap-1.5 rounded-xl bg-brand px-4 active:bg-brand-600"
        >
          <Ionicons name="send-outline" size={15} color="#fff" />
          <Text numberOfLines={1} className="text-sm font-semibold text-white">
            Refer
          </Text>
        </Pressable>
      </View>

      {labReports.length > 0 ? (
        <View
          className="gap-2"
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        >
          <View className="h-11 flex-row items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3">
            <Ionicons name="search-outline" size={15} color="#6b7280" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search date, test, result..."
              placeholderTextColor="#9ca3af"
              autoCorrect={false}
              accessibilityLabel="Search lab reports"
              className="min-w-0 flex-1 text-sm text-neutral-900"
              style={{ height: 44, paddingVertical: 0 }}
            />
          </View>

          <View className="overflow-hidden rounded-lg border border-neutral-200">
            <View className="flex-row gap-2 border-b border-neutral-200 bg-neutral-100 px-2.5 py-2">
              <Text
                className="text-xs font-medium text-neutral-500"
                style={{ width: DATE_COLUMN }}
              >
                Date
              </Text>
              <Text className="min-w-0 flex-1 text-xs font-medium text-neutral-500">
                Test
              </Text>
              {showResult ? (
                <Text className="min-w-0 flex-1 text-xs font-medium text-neutral-500">
                  Result
                </Text>
              ) : null}
              <Text
                className="text-right text-xs font-medium text-neutral-500"
                style={{ width: ACTION_COLUMN }}
              >
                Action
              </Text>
            </View>

            <ScrollView
              style={{ maxHeight: REPORT_ROWS_MAX_HEIGHT }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {reportRows.length === 0 ? (
                <Text className="px-3 py-4 text-center text-xs text-neutral-500">
                  No lab reports.
                </Text>
              ) : (
                reportRows.map((r, i) => (
                  <View
                    key={r.id ?? `${r.date}-${r.test}-${i}`}
                    className={`flex-row items-center gap-2 px-2.5 py-1.5 ${
                      i < reportRows.length - 1
                        ? "border-b border-neutral-100"
                        : ""
                    }`}
                  >
                    <Text
                      className="text-xs text-neutral-800"
                      style={{ width: DATE_COLUMN }}
                    >
                      {r.date || "—"}
                    </Text>
                    <Text
                      numberOfLines={2}
                      className="min-w-0 flex-1 text-xs text-neutral-800"
                    >
                      {r.test || "Lab report"}
                    </Text>
                    {showResult ? (
                      <Text
                        numberOfLines={2}
                        className="min-w-0 flex-1 text-xs text-neutral-500"
                      >
                        {resultLabel(r.test, r.result)}
                      </Text>
                    ) : null}
                    <View
                      className="items-end"
                      style={{ width: ACTION_COLUMN }}
                    >
                      {labReportHasViewableFiles(r.reportPayload) ? (
                        <Pressable
                          onPress={() => void openLabReport(r)}
                          hitSlop={6}
                          accessibilityLabel={`View ${r.test || "lab report"}`}
                          className="h-8 w-8 items-center justify-center rounded-md bg-brand active:bg-brand-600"
                        >
                          <Ionicons name="eye-outline" size={16} color="#fff" />
                        </Pressable>
                      ) : (
                        <Text className="text-xs text-neutral-400">—</Text>
                      )}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      ) : referrals.length === 0 ? (
        <Text className="text-sm text-neutral-500">
          No patient lab reports on file.
        </Text>
      ) : null}

      {referrals.length > 0 ? (
        <View
          className={`overflow-hidden rounded-lg border border-neutral-200 ${
            labReports.length > 0 ? "mt-1" : ""
          }`}
        >
          <View className="flex-row gap-2 border-b border-neutral-200 bg-neutral-100 px-3 py-2">
            {REFERRAL_COLUMNS.map((c) => (
              <Text
                key={c.label}
                className="min-w-0 text-xs font-medium text-neutral-600"
                style={{ flex: c.flex }}
              >
                {c.label}
              </Text>
            ))}
          </View>
          {referrals.map((r, i) => (
            <View
              key={r.id}
              className={`flex-row gap-2 px-3 py-2 ${
                i < referrals.length - 1 ? "border-b border-neutral-100" : ""
              }`}
            >
              <Text
                className="min-w-0 text-sm text-neutral-500"
                style={{ flex: REFERRAL_COLUMNS[0]!.flex }}
              >
                {r.date}
              </Text>
              <Text
                className="min-w-0 text-sm text-neutral-900"
                style={{ flex: REFERRAL_COLUMNS[1]!.flex }}
              >
                {r.type}
              </Text>
              <Text
                className="min-w-0 text-sm text-neutral-900"
                style={{ flex: REFERRAL_COLUMNS[2]!.flex }}
              >
                {r.mode}
              </Text>
              <Text
                className="min-w-0 text-sm text-neutral-900"
                style={{ flex: REFERRAL_COLUMNS[3]!.flex }}
              >
                {r.tests}
              </Text>
              <Text
                className="min-w-0 text-sm text-neutral-900"
                style={{ flex: REFERRAL_COLUMNS[4]!.flex }}
              >
                {r.status}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {error ? <Text className="text-sm text-red-500">{error}</Text> : null}

      <AppModal
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
      </AppModal>
    </View>
  );
}
