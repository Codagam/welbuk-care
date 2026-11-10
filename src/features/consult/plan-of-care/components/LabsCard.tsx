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
import type { ConsultReferralRow } from "@/features/consult/orders/hooks";
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
  ordersPanel,
  referrals = [],
}: {
  labReports: LabReportItem[];
  /** Standalone Refer form. Hidden when `ordersPanel` is set (Practice parity). */
  onRefer?: () => void;
  patientName?: string;
  /** Consult Orders & referrals card. When set, it heads this card. */
  ordersPanel?: ReactNode;
  /** The patient's referrals at this facility, both directions, newest first. */
  referrals?: ConsultReferralRow[];
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
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <Ionicons name="flask-outline" size={22} color="#111827" />
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-lg font-semibold tracking-tight text-brand">
              {ordersPanel ? "Orders & referrals" : "Labs"}
            </Text>
            {!ordersPanel ? (
              <Text className="text-sm text-neutral-500">
                Patient lab reports on file
              </Text>
            ) : null}
          </View>
        </View>
        {onRefer && !ordersPanel ? (
          <Pressable
            onPress={onRefer}
            accessibilityRole="button"
            accessibilityLabel="Refer"
            className="min-h-[48px] min-w-[96px] items-center justify-center rounded-xl bg-brand px-5 py-3 active:bg-brand-600"
          >
            <Text className="text-base font-semibold text-white">Refer</Text>
          </Pressable>
        ) : null}
      </View>

      {ordersPanel}

      {ordersPanel && (labReports.length > 0 || referrals.length > 0) ? (
        <Text className="border-t border-neutral-200 pt-3 text-sm font-semibold text-neutral-900">
          Reports and earlier referrals
        </Text>
      ) : null}

      {labReports.length === 0 ? (
        ordersPanel ? null : (
        <View className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6">
          <Text className="text-center text-sm text-neutral-400">
            No patient lab reports on file.
          </Text>
        </View>
        )
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

      {referrals.length > 0 ? <ReferralsTable rows={referrals} /> : null}

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

/** Practice consult page "referralTableContent": Date / Type / Mode / Tests / Status. */
function ReferralsTable({ rows }: { rows: ConsultReferralRow[] }) {
  const dash = "—";
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View
        style={{ minWidth: "100%" }}
        className="overflow-hidden rounded-xl border border-neutral-200"
      >
        <View className="flex-row border-b border-neutral-200 bg-neutral-50">
          <Text style={COL.date} className={HEAD}>Date</Text>
          <Text style={COL.type} className={HEAD}>Type</Text>
          <Text style={COL.mode} className={HEAD}>Mode</Text>
          <Text style={COL.tests} className={HEAD}>Tests</Text>
          <Text style={COL.status} className={HEAD}>Status</Text>
        </View>
        {rows.map((r, i) => (
          <View
            key={r.id}
            className={`flex-row ${i < rows.length - 1 ? "border-b border-neutral-100" : ""}`}
          >
            <Text style={COL.date} className={`${CELL} text-neutral-500`}>
              {r.createdAt ? new Date(r.createdAt).toLocaleString() : dash}
            </Text>
            <Text style={COL.type} className={CELL}>
              {r.referralType || dash}
            </Text>
            <Text style={COL.mode} className={`${CELL} capitalize`}>
              {r.direction}
            </Text>
            <Text style={COL.tests} className={CELL}>
              {r.tests.length > 0 ? r.tests.join(", ") : dash}
            </Text>
            <Text style={COL.status} className={`${CELL} capitalize`}>
              {(r.status || dash).replace(/_/g, " ")}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const HEAD = "px-3 py-2.5 text-sm font-semibold text-neutral-800";
const CELL = "px-3 py-2.5 text-sm text-neutral-900";
const COL = {
  date: { width: 190 },
  type: { width: 110 },
  mode: { width: 110 },
  tests: { flex: 1, minWidth: 220 },
  status: { width: 130 },
} as const;
