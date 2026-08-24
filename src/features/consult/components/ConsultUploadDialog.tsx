import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";

import { AppModal, Button, DateField, TextField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { createPatientLabReport } from "@/lib/api/endpoints/consult-data";
import { uploadFile } from "@/lib/api/endpoints/recording";
import {
  usePatchReportAttachments,
  useInvalidatePatientHistory,
} from "../hooks";

const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const MAX_VISIT_FILES = 10;
const ACCEPT_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const ACCEPT_EXT = /\.(jpe?g|png|webp|pdf)$/i;
const REPORT_STATUSES = ["PENDING", "COMPLETED", "REVIEWED"] as const;

type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

function mimeOf(asset: {
  name?: string | null;
  mimeType?: string | null;
}): string {
  const mime = (asset.mimeType ?? "").toLowerCase();
  if (ACCEPT_MIME.has(mime)) return mime;
  const name = asset.name ?? "";
  if (/\.pdf$/i.test(name)) return "application/pdf";
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.webp$/i.test(name)) return "image/webp";
  if (/\.jpe?g$/i.test(name)) return "image/jpeg";
  return mime || "application/octet-stream";
}

function validatePicked(
  assets: DocumentPicker.DocumentPickerAsset[],
  opts: { maxFiles: number }
): { ok: PickedFile[]; error: string | null } {
  if (assets.length > opts.maxFiles) {
    return {
      ok: [],
      error: `You can attach up to ${opts.maxFiles} file${opts.maxFiles === 1 ? "" : "s"}.`,
    };
  }
  const ok: PickedFile[] = [];
  for (const a of assets) {
    const mime = mimeOf(a);
    const name = a.name || "file";
    if (!ACCEPT_MIME.has(mime) && !ACCEPT_EXT.test(name)) {
      return {
        ok: [],
        error: "Only JPG, PNG, WEBP, or PDF are allowed.",
      };
    }
    if (typeof a.size === "number" && a.size > MAX_SIZE_BYTES) {
      return {
        ok: [],
        error: `Each file must be ${MAX_SIZE_MB} MB or smaller.`,
      };
    }
    ok.push({
      uri: a.uri,
      name,
      mimeType: ACCEPT_MIME.has(mime) ? mime : mimeOf({ name, mimeType: mime }),
      size: a.size,
    });
  }
  return { ok, error: null };
}

function toast(title: string, message?: string) {
  Alert.alert(title, message);
}

type Tab = "visit" | "lab";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultationId: string;
  patientId?: string;
  facilityId?: string | null;
  /** Existing visit document storage URLs (full list required for PATCH). */
  existingAttachmentUrls: string[];
  onSuccess?: () => void;
};

/**
 * Practice-parity "Upload document" dialog — Visit file | Lab report tabs.
 */
export function ConsultUploadDialog({
  open,
  onOpenChange,
  consultationId,
  patientId,
  facilityId,
  existingAttachmentUrls,
  onSuccess,
}: Props) {
  const canUploadLab = Boolean(patientId && facilityId);
  const [tab, setTab] = useState<Tab>("visit");
  const [visitFiles, setVisitFiles] = useState<PickedFile[]>([]);
  const [labFile, setLabFile] = useState<PickedFile | null>(null);
  const [date, setDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [test, setTest] = useState("");
  const [status, setStatus] =
    useState<(typeof REPORT_STATUSES)[number]>("PENDING");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patchAttach = usePatchReportAttachments(consultationId, patientId);
  const invalidateHistory = useInvalidatePatientHistory(
    patientId,
    consultationId
  );

  useEffect(() => {
    if (!open) return;
    setTab(canUploadLab ? "visit" : "visit");
    setVisitFiles([]);
    setLabFile(null);
    setDate(new Date().toISOString().split("T")[0]);
    setTest("");
    setStatus("PENDING");
    setNotes("");
    setError(null);
    setBusy(false);
  }, [open, canUploadLab]);

  const close = () => onOpenChange(false);

  const pickVisitFiles = async () => {
    setError(null);
    try {
      const remaining = MAX_VISIT_FILES - visitFiles.length;
      if (remaining <= 0) {
        setError(`You can attach up to ${MAX_VISIT_FILES} files.`);
        return;
      }
      const picked = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: true,
        type: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf",
        ],
      });
      if (picked.canceled || !picked.assets?.length) return;
      const { ok, error: err } = validatePicked(picked.assets, {
        maxFiles: remaining,
      });
      if (err) {
        setError(err);
        return;
      }
      const merged = [...visitFiles, ...ok].slice(0, MAX_VISIT_FILES);
      setVisitFiles(merged);
    } catch (e) {
      setError(describeError(e));
    }
  };

  const pickLabFile = async () => {
    setError(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf",
        ],
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const { ok, error: err } = validatePicked(picked.assets, {
        maxFiles: 1,
      });
      if (err) {
        setError(err);
        return;
      }
      setLabFile(ok[0] ?? null);
    } catch (e) {
      setError(describeError(e));
    }
  };

  /** Pipeline A — Visit Documents: upload files, then PATCH full URL list */
  const handleVisitAttach = async () => {
    if (!consultationId?.trim()) {
      setError("consultationId is required");
      return;
    }
    if (visitFiles.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      // 1) POST /api/upload purpose=consult_report (get storage URLs)
      const uploaded: string[] = [];
      for (const file of visitFiles) {
        console.log("[visit-attach] POST /api/upload consult_report", {
          consultationId,
          name: file.name,
          mimeType: file.mimeType,
        });
        const urls = await uploadFile(
          file.uri,
          file.name,
          file.mimeType,
          "consult_report",
          { consultationId }
        );
        console.log("[visit-attach] upload urls", urls);
        if (urls[0]) uploaded.push(urls[0]);
      }
      if (uploaded.length === 0) {
        setError("Upload failed");
        toast("Upload failed", "No files were uploaded.");
        return;
      }

      // 2) PATCH /api/consult/report/attachments with FULL list (existing + new)
      const attachmentUrls = [
        ...existingAttachmentUrls.filter(
          (u) => typeof u === "string" && u.trim().length > 0
        ),
        ...uploaded,
      ];
      console.log("[visit-attach] PATCH attachments", {
        consultationId,
        count: attachmentUrls.length,
        attachmentUrls,
      });
      const saved = await patchAttach.mutateAsync(attachmentUrls);
      console.log("[visit-attach] PATCH saved", saved);

      await invalidateHistory();
      toast(
        "File attached to visit",
        uploaded.length === 1
          ? undefined
          : `${uploaded.length} files attached`
      );
      onSuccess?.();
      close();
    } catch (e) {
      const msg = describeError(e);
      console.log("[visit-attach] failed", e);
      setError(msg);
      toast("Upload failed", msg);
    } finally {
      setBusy(false);
    }
  };

  /** Pipeline B — Lab report: POST upload (patient_lab_report) → POST lab-reports FormData */
  const handleLabSave = async () => {
    setError(null);
    if (!patientId || !facilityId) {
      setError("Patient and facility are required to upload a lab report.");
      return;
    }
    if (!test.trim()) {
      setError("Test name is required");
      return;
    }
    if (!date.trim()) {
      setError("Date is required");
      return;
    }
    if (!status) {
      setError("Status is required");
      return;
    }
    if (!labFile) {
      setError("Please upload a lab report file (image or PDF)");
      return;
    }

    setBusy(true);
    try {
      const urls = await uploadFile(
        labFile.uri,
        labFile.name,
        labFile.mimeType,
        "patient_lab_report",
        { patientId, facilityId }
      );
      const fileUrl = urls[0];
      if (!fileUrl) {
        setError("Upload failed");
        toast("Upload failed");
        return;
      }

      const form = new FormData();
      form.append("patientId", patientId);
      form.append("date", new Date(date).toISOString());
      form.append("test", test.trim());
      form.append("status", status.toUpperCase());
      if (notes.trim()) form.append("notes", notes.trim());
      form.append("fileUrl", fileUrl);

      await createPatientLabReport(facilityId, form);
      await invalidateHistory();
      toast("Lab report uploaded");
      onSuccess?.();
      close();
    } catch (e) {
      const msg = describeError(e);
      setError(msg);
      toast("Failed to save lab report", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppModal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between border-b border-neutral-200 px-4 py-3">
          <Text className="text-lg font-semibold text-neutral-900">
            Upload document
          </Text>
          <Pressable onPress={close} hitSlop={12} disabled={busy}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
        >
          {/* Tabs */}
          <View className="flex-row rounded-xl border border-neutral-200 bg-neutral-50 p-1">
            <Pressable
              onPress={() => setTab("visit")}
              disabled={busy}
              className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2.5 ${
                tab === "visit" ? "bg-white" : ""
              }`}
            >
              <Ionicons
                name="attach"
                size={14}
                color={tab === "visit" ? "#FD006A" : "#6b7280"}
              />
              <Text
                className={`text-sm font-medium ${
                  tab === "visit" ? "text-brand" : "text-neutral-600"
                }`}
              >
                Visit file
              </Text>
            </Pressable>
            <Pressable
              onPress={() => canUploadLab && setTab("lab")}
              disabled={!canUploadLab || busy}
              className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2.5 ${
                tab === "lab" ? "bg-white" : ""
              } ${!canUploadLab ? "opacity-40" : ""}`}
            >
              <Ionicons
                name="flask-outline"
                size={14}
                color={tab === "lab" ? "#FD006A" : "#6b7280"}
              />
              <Text
                className={`text-sm font-medium ${
                  tab === "lab" ? "text-brand" : "text-neutral-600"
                }`}
              >
                Lab report
              </Text>
            </Pressable>
          </View>

          {tab === "visit" ? (
            <View className="gap-4">
              <Text className="text-xs text-neutral-500">
                Attach an image or PDF to this consultation only (no test
                metadata).
              </Text>

              <Pressable
                onPress={() => void pickVisitFiles()}
                disabled={busy || !consultationId}
                className="items-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 px-4 py-8 active:border-brand"
              >
                <Ionicons name="cloud-upload-outline" size={28} color="#FD006A" />
                <Text className="text-sm font-medium text-neutral-800">
                  Choose files
                </Text>
                <Text className="text-center text-xs text-neutral-500">
                  JPG, PNG, WEBP, or PDF — up to {MAX_SIZE_MB} MB each (max{" "}
                  {MAX_VISIT_FILES})
                </Text>
              </Pressable>

              {visitFiles.length > 0 ? (
                <View className="gap-2">
                  {visitFiles.map((f, i) => (
                    <View
                      key={`${f.uri}-${i}`}
                      className="flex-row items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2"
                    >
                      <Ionicons
                        name={
                          f.mimeType === "application/pdf"
                            ? "document-text-outline"
                            : "image-outline"
                        }
                        size={18}
                        color="#6b7280"
                      />
                      <Text
                        className="flex-1 text-sm text-neutral-800"
                        numberOfLines={1}
                      >
                        {f.name}
                      </Text>
                      <Pressable
                        onPress={() =>
                          setVisitFiles((prev) =>
                            prev.filter((_, idx) => idx !== i)
                          )
                        }
                        disabled={busy}
                        hitSlop={8}
                      >
                        <Ionicons name="close-circle" size={20} color="#9ca3af" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}

              {error && tab === "visit" ? (
                <Text className="text-sm text-red-500">{error}</Text>
              ) : null}

              <View className="flex-row justify-end gap-2 pt-2">
                <Button
                  label="Cancel"
                  variant="outline"
                  size="md"
                  onPress={close}
                  disabled={busy}
                />
                <Button
                  label={
                    visitFiles.length > 1
                      ? `Attach (${visitFiles.length})`
                      : "Attach"
                  }
                  size="md"
                  onPress={() => void handleVisitAttach()}
                  loading={busy}
                  disabled={visitFiles.length === 0 || !consultationId}
                  icon={
                    busy ? null : (
                      <Ionicons name="attach" size={16} color="#fff" />
                    )
                  }
                />
              </View>
            </View>
          ) : null}

          {tab === "lab" ? (
            <View className="gap-4">
              {!canUploadLab ? (
                <Text className="text-sm text-neutral-500">
                  Patient and facility are required to upload a lab report.
                </Text>
              ) : (
                <>
                  <DateField
                    label="Date"
                    value={date}
                    onChange={setDate}
                    disabled={busy}
                  />

                  <TextField
                    label="Test name"
                    value={test}
                    onChangeText={setTest}
                    placeholder="e.g. CBC, Lipid profile"
                    editable={!busy}
                  />

                  <View className="gap-1.5">
                    <Text className="text-sm font-medium text-neutral-700">
                      Report file
                    </Text>
                    <Pressable
                      onPress={() => void pickLabFile()}
                      disabled={busy}
                      className="items-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 px-4 py-6 active:border-brand"
                    >
                      {labFile ? (
                        <>
                          <Ionicons
                            name={
                              labFile.mimeType === "application/pdf"
                                ? "document-text-outline"
                                : "image-outline"
                            }
                            size={24}
                            color="#FD006A"
                          />
                          <Text
                            className="text-sm font-medium text-neutral-800"
                            numberOfLines={1}
                          >
                            {labFile.name}
                          </Text>
                          <Text className="text-xs text-brand">Tap to change</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons
                            name="cloud-upload-outline"
                            size={24}
                            color="#FD006A"
                          />
                          <Text className="text-sm font-medium text-neutral-800">
                            Choose file
                          </Text>
                          <Text className="text-xs text-neutral-500">
                            Image or PDF — up to {MAX_SIZE_MB} MB
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>

                  <View className="gap-1.5">
                    <Text className="text-sm font-medium text-neutral-700">
                      Status
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {REPORT_STATUSES.map((s) => {
                        const active = status === s;
                        return (
                          <Pressable
                            key={s}
                            onPress={() => setStatus(s)}
                            disabled={busy}
                            className={`rounded-full px-3 py-1.5 ${
                              active ? "bg-brand" : "bg-neutral-100"
                            }`}
                          >
                            <Text
                              className={`text-xs font-medium ${
                                active
                                  ? "text-brand-foreground"
                                  : "text-neutral-600"
                              }`}
                            >
                              {s.charAt(0) + s.slice(1).toLowerCase()}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <View className="gap-1.5">
                    <Text className="text-sm font-medium text-neutral-700">
                      Notes (optional)
                    </Text>
                    <TextInput
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Additional observations…"
                      placeholderTextColor="#9ca3af"
                      multiline
                      editable={!busy}
                      className="min-h-[80px] rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900"
                      textAlignVertical="top"
                    />
                  </View>

                  {error ? (
                    <Text className="text-sm text-red-500">{error}</Text>
                  ) : null}

                  <View className="flex-row justify-end gap-2 pt-2">
                    <Button
                      label="Cancel"
                      variant="outline"
                      size="md"
                      onPress={close}
                      disabled={busy}
                    />
                    <Button
                      label="Save report"
                      size="md"
                      onPress={() => void handleLabSave()}
                      loading={busy}
                      disabled={busy}
                    />
                  </View>
                </>
              )}
            </View>
          ) : null}

          {busy ? (
            <View className="items-center py-2">
              <ActivityIndicator color="#FD006A" />
              <Text className="mt-2 text-xs text-neutral-500">Uploading…</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </AppModal>
  );
}
