import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useFacilityId } from "@/lib/auth/store";
import { useDeleteLabReport, useSummary } from "../hooks";
import {
  isImageUrl,
  isReportAttachmentPdf,
  labReportFileUrls,
  labReportForFileUrl,
  labReportHasViewableFiles,
  labReportSourceLabel,
} from "../labReports";
import type { DoctorNote, LabReportItem } from "../types";
import { ConsultUploadDialog } from "./ConsultUploadDialog";
import {
  ImagePreviewWithFullView,
  FileViewerActions,
  ModalSafeArea,
} from "./ImagePreview";
import { SectionChrome } from "./SectionChrome";

type LocalFile = { storageUrl: string; localUri: string };

export function ReportsPanel({
  consultationId,
  patientId,
  patientName,
  labReports,
  doctorNotes,
  onRefresh,
}: {
  consultationId: string;
  patientId?: string;
  patientName?: string;
  labReports: LabReportItem[];
  doctorNotes: DoctorNote[];
  onRefresh?: () => void;
}) {
  const facilityId = useFacilityId();
  const summaryQ = useSummary(consultationId);
  const deleteLab = useDeleteLabReport(patientId, consultationId);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewFiles, setViewFiles] = useState<LocalFile[]>([]);
  const [viewNote, setViewNote] = useState<string | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLocalUri, setPreviewLocalUri] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewReload, setPreviewReload] = useState(0);

  const attachedUrls = useMemo(() => {
    const urls = summaryQ.data?.reportAttachmentUrls ?? [];
    return Array.isArray(urls) ? urls.filter(Boolean) : [];
  }, [summaryQ.data?.reportAttachmentUrls]);

  const currentUrl = attachedUrls[previewIndex];
  const currentLab = currentUrl
    ? labReportForFileUrl(currentUrl, labReports)
    : undefined;
  const canDeleteCurrent = Boolean(currentLab?.canDelete);

  const refreshLists = () => {
    void summaryQ.refetch();
    onRefresh?.();
  };

  const openLabReport = async (item: LabReportItem) => {
    const payload = item.reportPayload;
    const urls = labReportFileUrls(payload);
    const note =
      payload?.reportNote?.trim() ||
      payload?.radiologyReport?.trim() ||
      null;
    if (urls.length === 0 && !note) return;

    setError(null);
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

  // Load visit-file preview with Bearer auth into a local cache URI.
  useEffect(() => {
    if (!previewOpen || !currentUrl) {
      setPreviewLocalUri(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewLocalUri(null);
    setError(null);
    void (async () => {
      try {
        const { localUri } = await fetchProxiedFileToCache(currentUrl);
        if (!cancelled) setPreviewLocalUri(localUri);
      } catch (e) {
        if (!cancelled) setError(describeError(e));
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [previewOpen, currentUrl, previewReload]);


  const confirmDelete = (opts: {
    title: string;
    message: string;
    onConfirm: () => void;
  }) => {
    Alert.alert(opts.title, opts.message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: opts.onConfirm },
    ]);
  };

  const handleDeleteLab = (item: LabReportItem) => {
    if (!item.canDelete) return;
    const fileUrl =
      item.reportPayload?.labReportAttachmentUrls?.[0] ??
      item.reportPayload?.reportImageUrls?.[0] ??
      item.result;
    if (!fileUrl) return;
    confirmDelete({
      title: "Delete this uploaded report?",
      message:
        "Only the facility or patient who uploaded this report can delete it.",
      onConfirm: async () => {
        setError(null);
        try {
          await deleteLab.mutateAsync({
            id: item.id,
            fileUrl,
            patientId,
            consultationId,
          });
          refreshLists();
        } catch (e) {
          setError(describeError(e));
        }
      },
    });
  };

  const handleDeleteVisitFile = () => {
    if (!currentUrl || !canDeleteCurrent) return;
    confirmDelete({
      title: "Delete this visit file?",
      message:
        "Only your facility can remove files it uploaded. Lab referral reports cannot be deleted here.",
      onConfirm: async () => {
        setError(null);
        try {
          await deleteLab.mutateAsync({
            id: currentLab?.id,
            fileUrl: currentUrl,
            patientId,
            consultationId,
          });
          setPreviewOpen(false);
          refreshLists();
        } catch (e) {
          setError(describeError(e));
        }
      },
    });
  };

  return (
    <View className="gap-3">
      <SectionChrome title="Reports">
        <View className="gap-2.5">
          <View className="flex-row items-center justify-between gap-2">
            <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-2">
              <Ionicons name="folder-outline" size={16} color="#FD006A" />
              <Text className="text-sm font-semibold text-neutral-900">
                Visit files
              </Text>
              {attachedUrls.length > 0 ? (
                <Text className="text-xs font-medium text-brand">
                  {attachedUrls.length} visit file
                  {attachedUrls.length !== 1 ? "s" : ""}
                </Text>
              ) : (
                <Text className="text-xs text-neutral-500">
                  No visit files yet
                </Text>
              )}
            </View>
            <Button
              label="Upload"
              variant="primary"
              size="md"
              className="shrink-0"
              onPress={() => setUploadOpen(true)}
              disabled={!consultationId}
              icon={<Ionicons name="add" size={16} color="#fff" />}
            />
          </View>

          {attachedUrls.length > 0 ? (
            <View className="flex-row flex-wrap gap-1.5">
              {attachedUrls.slice(0, 5).map((url, index) => (
                <Pressable
                  key={`${url}-${index}`}
                  onPress={() => {
                    setPreviewIndex(index);
                    setPreviewOpen(true);
                  }}
                  className="h-9 w-9 items-center justify-center overflow-hidden rounded-md bg-brand/10"
                >
                  {isReportAttachmentPdf(url) ? (
                    <Ionicons
                      name="document-text-outline"
                      size={16}
                      color="#FD006A"
                    />
                  ) : (
                    <Ionicons name="image-outline" size={16} color="#FD006A" />
                  )}
                </Pressable>
              ))}
              {attachedUrls.length > 5 ? (
                <Pressable
                  onPress={() => {
                    setPreviewIndex(5);
                    setPreviewOpen(true);
                  }}
                  className="h-9 w-9 items-center justify-center rounded-md bg-brand/10"
                >
                  <Text className="text-xs font-medium text-brand">
                    +{attachedUrls.length - 5}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </SectionChrome>

      <SectionChrome
        title="Lab Reports"
        icon="document-text-outline"
        badge={labReports.length}
        collapsible
        defaultOpen={false}
      >
        {labReports.length === 0 ? (
          <Text className="text-xs italic text-neutral-500">
            No lab reports yet. Use Upload above and choose Lab report.
          </Text>
        ) : (
          <View className="gap-0">
            <Text className="mb-2 text-xs text-neutral-500">
              Patient history from all facilities.
            </Text>
            {labReports.map((item, idx) => (
              <View
                key={item.id ?? idx}
                className={`py-2.5 ${
                  idx < labReports.length - 1
                    ? "border-b border-neutral-100"
                    : ""
                }`}
              >
                <View className="mb-1 flex-row items-start justify-between gap-2">
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text className="text-xs text-neutral-500">{item.date}</Text>
                    <Text className="text-[10px] text-neutral-500">
                      {labReportSourceLabel(item.source)}
                      {item.referralType ? ` · ${item.referralType}` : ""}
                      {item.facilityLabel ? ` · ${item.facilityLabel}` : ""}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    {labReportHasViewableFiles(item.reportPayload) ? (
                      <Pressable
                        onPress={() => void openLabReport(item)}
                        className="h-7 w-7 items-center justify-center rounded-md bg-brand/10"
                        accessibilityLabel={`View ${item.test || "lab report"}`}
                      >
                        <Ionicons name="eye-outline" size={16} color="#FD006A" />
                      </Pressable>
                    ) : null}
                    {item.canDelete ? (
                      <Pressable
                        onPress={() => handleDeleteLab(item)}
                        disabled={deleteLab.isPending}
                        className="h-7 w-7 items-center justify-center rounded-md"
                        accessibilityLabel="Delete report"
                      >
                        <Ionicons
                          name="trash-outline"
                          size={14}
                          color="#dc2626"
                        />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                <Text className="text-xs font-medium text-neutral-900">
                  {item.test}
                </Text>
                {item.result ? (
                  <Text
                    className="mt-0.5 text-xs text-neutral-500"
                    numberOfLines={2}
                  >
                    {item.result}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </SectionChrome>

      <SectionChrome
        title="Previous Notes"
        icon="calendar-outline"
        badge={doctorNotes.length}
        collapsible
        defaultOpen={false}
      >
        {doctorNotes.length === 0 ? (
          <Text className="text-xs italic text-neutral-500">
            No previous notes
          </Text>
        ) : (
          <View className="gap-0">
            {doctorNotes.map((item, idx) => (
              <View
                key={idx}
                className={`py-2.5 ${
                  idx < doctorNotes.length - 1
                    ? "border-b border-neutral-100"
                    : ""
                }`}
              >
                <View className="mb-1 flex-row items-start justify-between gap-2">
                  <Text className="text-xs text-neutral-500">{item.date}</Text>
                  <Text className="text-xs font-medium text-neutral-700">
                    {item.doctor}
                  </Text>
                </View>
                <Text className="text-xs leading-5 text-neutral-700">
                  {item.note}
                </Text>
              </View>
            ))}
          </View>
        )}
      </SectionChrome>

      {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
      {summaryQ.isLoading || deleteLab.isPending ? (
        <ActivityIndicator color="#FD006A" />
      ) : null}

      <ConsultUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        consultationId={consultationId}
        patientId={patientId}
        facilityId={facilityId}
        existingAttachmentUrls={attachedUrls}
        onSuccess={refreshLists}
      />

      {/* Visit file preview */}
      <AppModal
        visible={previewOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPreviewOpen(false)}
      >
        <ModalSafeArea>
          <View className="flex-row items-center justify-between border-b border-neutral-200 px-4 py-3">
            <Text className="text-sm font-medium text-neutral-900">
              {attachedUrls.length > 1
                ? `Visit file ${previewIndex + 1} of ${attachedUrls.length}`
                : "Visit file"}
            </Text>
            <Pressable onPress={() => setPreviewOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </Pressable>
          </View>
          <View className="flex-row items-center justify-between px-4 py-2">
            {attachedUrls.length > 1 ? (
              <View className="flex-row gap-1">
                <Pressable
                  disabled={previewIndex <= 0}
                  onPress={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                  className="h-8 w-8 items-center justify-center rounded-md border border-neutral-200"
                >
                  <Ionicons name="chevron-back" size={16} color="#374151" />
                </Pressable>
                <Pressable
                  disabled={previewIndex >= attachedUrls.length - 1}
                  onPress={() =>
                    setPreviewIndex((i) =>
                      Math.min(attachedUrls.length - 1, i + 1)
                    )
                  }
                  className="h-8 w-8 items-center justify-center rounded-md border border-neutral-200"
                >
                  <Ionicons name="chevron-forward" size={16} color="#374151" />
                </Pressable>
              </View>
            ) : (
              <View />
            )}
            {canDeleteCurrent ? (
              <Button
                label="Delete"
                variant="danger"
                size="md"
                onPress={handleDeleteVisitFile}
                icon={<Ionicons name="trash-outline" size={14} color="#fff" />}
              />
            ) : null}
          </View>
          <ScrollView
            contentContainerStyle={{
              padding: 16,
              flexGrow: 1,
              justifyContent: "center",
            }}
          >
            {previewLoading ? (
              <ActivityIndicator color="#FD006A" />
            ) : previewLocalUri && currentUrl && isImageUrl(currentUrl) ? (
              <ImagePreviewWithFullView
                uri={previewLocalUri}
                title={
                  attachedUrls.length > 1
                    ? `Visit file ${previewIndex + 1} of ${attachedUrls.length}`
                    : "Visit file"
                }
                fileName={
                  currentUrl.split("/").pop()?.split("?")[0] || "visit-file"
                }
                height={360}
              />
            ) : previewLocalUri && currentUrl ? (
              <View className="items-center gap-3">
                <Button
                  label={
                    isReportAttachmentPdf(currentUrl)
                      ? "Open PDF"
                      : "Open file"
                  }
                  onPress={() => void Linking.openURL(previewLocalUri)}
                />
                <FileViewerActions
                  localUri={previewLocalUri}
                  fileName={
                    currentUrl.split("/").pop()?.split("?")[0] || "visit-file"
                  }
                  title="Visit file"
                />
              </View>
            ) : currentUrl ? (
              <Button
                label="Retry"
                variant="outline"
                onPress={() => setPreviewReload((n) => n + 1)}
              />
            ) : null}
          </ScrollView>
        </ModalSafeArea>
      </AppModal>

      {/* Lab / content view */}
      <AppModal
        visible={viewOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setViewOpen(false)}
      >
        <ModalSafeArea>
          <View className="flex-row items-center justify-between border-b border-neutral-200 px-4 py-3">
            <Text className="text-base font-semibold text-neutral-900">
              {patientName ? `${patientName} — report` : "Lab report"}
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
                file.storageUrl.split("/").pop()?.split("?")[0] || "report";
              if (isImageUrl(file.storageUrl)) {
                return (
                  <ImagePreviewWithFullView
                    key={file.storageUrl}
                    uri={file.localUri}
                    title={
                      patientName ? `${patientName} — report` : "Lab report"
                    }
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
                    title="Lab report"
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
