import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";

import { AppAlert, AppModal, DateField, TextField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { createPatientLabReport } from "@/lib/api/endpoints/consult-data";
import { uploadFile } from "@/lib/api/endpoints/recording";
import {
  usePatchReportAttachments,
  useInvalidatePatientHistory,
} from "../hooks";
import {
  ErrorBanner,
  FieldError,
  FileDropZone,
  FormSection,
  PickedFileRow,
  UploadSheetFooter,
  UploadSheetHeader,
  type PickedFile,
} from "./upload/UploadKit";

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
const FORMATS = ["PDF", "JPG", "PNG", "WEBP"];
const REPORT_STATUSES = ["PENDING", "COMPLETED", "REVIEWED"] as const;
type ReportStatus = (typeof REPORT_STATUSES)[number];

const STATUS_STYLE: Record<
  ReportStatus,
  { label: string; dot: string; active: string; text: string }
> = {
  PENDING: {
    label: "Pending",
    dot: "bg-amber-500",
    active: "border-amber-300 bg-amber-50",
    text: "text-amber-800",
  },
  COMPLETED: {
    label: "Completed",
    dot: "bg-emerald-500",
    active: "border-emerald-300 bg-emerald-50",
    text: "text-emerald-800",
  },
  REVIEWED: {
    label: "Reviewed",
    dot: "bg-blue-500",
    active: "border-blue-300 bg-blue-50",
    text: "text-blue-800",
  },
};

/** One-tap fill for the most common orders. */
const COMMON_TESTS = [
  "CBC",
  "Lipid profile",
  "HbA1c",
  "LFT",
  "KFT",
  "Thyroid profile",
  "Urine routine",
  "X-ray",
];

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
      error: `You can attach up to ${opts.maxFiles} more file${opts.maxFiles === 1 ? "" : "s"}.`,
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

function TabCard({
  active,
  icon,
  title,
  description,
  onPress,
  disabled,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="tab"
      accessibilityState={{ selected: active, disabled }}
      className={`flex-1 gap-1.5 rounded-2xl border p-3 ${
        active
          ? "border-brand bg-brand-50/60"
          : "border-neutral-200 bg-white active:bg-neutral-50"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <View className="flex-row items-center gap-2">
        <View
          className={`h-8 w-8 items-center justify-center rounded-lg ${
            active ? "bg-brand" : "bg-neutral-100"
          }`}
        >
          <Ionicons name={icon} size={16} color={active ? "#fff" : "#525252"} />
        </View>
        <Text
          className={`flex-1 text-sm font-semibold ${
            active ? "text-brand-700" : "text-neutral-800"
          }`}
        >
          {title}
        </Text>
        {active ? (
          <Ionicons name="checkmark-circle" size={18} color="#FD006A" />
        ) : null}
      </View>
      <Text className="text-xs leading-4 text-neutral-500">{description}</Text>
    </Pressable>
  );
}

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
  const [status, setStatus] = useState<ReportStatus>("PENDING");
  const [notes, setNotes] = useState("");
  /** Picker problems (wrong type / too big) — shown under the file field. */
  const [fileError, setFileError] = useState<string | null>(null);
  /** Request failures — shown as a banner above the footer. */
  const [error, setError] = useState<string | null>(null);
  /** Field errors appear only after the first submit attempt. */
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  const patchAttach = usePatchReportAttachments(consultationId, patientId);
  const invalidateHistory = useInvalidatePatientHistory(
    patientId,
    consultationId
  );

  useEffect(() => {
    if (!open) return;
    setTab("visit");
    setVisitFiles([]);
    setLabFile(null);
    setDate(new Date().toISOString().split("T")[0]);
    setTest("");
    setStatus("PENDING");
    setNotes("");
    setFileError(null);
    setError(null);
    setSubmitted(false);
    setBusy(false);
  }, [open]);

  const close = () => onOpenChange(false);

  const switchTab = (next: Tab) => {
    setTab(next);
    setFileError(null);
    setError(null);
    setSubmitted(false);
  };

  const labErrors = {
    test: !test.trim() ? "Enter the test name" : null,
    file: !labFile ? "Attach the report file (image or PDF)" : null,
    date: !date.trim() ? "Pick the report date" : null,
  };
  const visitError =
    visitFiles.length === 0 ? "Choose at least one file to attach" : null;

  const pickVisitFiles = async () => {
    setFileError(null);
    try {
      const remaining = MAX_VISIT_FILES - visitFiles.length;
      if (remaining <= 0) {
        setFileError(`You can attach up to ${MAX_VISIT_FILES} files.`);
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
        setFileError(err);
        return;
      }
      const merged = [...visitFiles, ...ok].slice(0, MAX_VISIT_FILES);
      setVisitFiles(merged);
    } catch (e) {
      setFileError(describeError(e));
    }
  };

  const pickLabFile = async () => {
    setFileError(null);
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
        setFileError(err);
        return;
      }
      setLabFile(ok[0] ?? null);
    } catch (e) {
      setFileError(describeError(e));
    }
  };

  /** Pipeline A — Visit Documents: upload files, then PATCH full URL list */
  const handleVisitAttach = async () => {
    setSubmitted(true);
    setError(null);
    if (!consultationId?.trim()) {
      setError("This consultation could not be found. Reopen it and try again.");
      return;
    }
    if (visitError) return;
    setBusy(true);
    try {
      // 1) POST /api/upload purpose=consult_report (get storage URLs)
      const uploaded: string[] = [];
      for (const file of visitFiles) {
        const urls = await uploadFile(
          file.uri,
          file.name,
          file.mimeType,
          "consult_report",
          { consultationId }
        );
        if (urls[0]) uploaded.push(urls[0]);
      }
      if (uploaded.length === 0) {
        setError("No files were uploaded. Check your connection and try again.");
        return;
      }

      // 2) PATCH /api/consult/report/attachments with FULL list (existing + new)
      const attachmentUrls = [
        ...existingAttachmentUrls.filter(
          (u) => typeof u === "string" && u.trim().length > 0
        ),
        ...uploaded,
      ];
      await patchAttach.mutateAsync(attachmentUrls);

      await invalidateHistory();
      AppAlert.success(
        uploaded.length === 1
          ? "File attached to visit"
          : `${uploaded.length} files attached to visit`
      );
      onSuccess?.();
      close();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  /** Pipeline B — Lab report: POST upload (patient_lab_report) → POST lab-reports FormData */
  const handleLabSave = async () => {
    setSubmitted(true);
    setError(null);
    if (!patientId || !facilityId) {
      setError("Patient and facility are required to upload a lab report.");
      return;
    }
    if (labErrors.test || labErrors.file || labErrors.date || !labFile) return;

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
        setError("The file could not be uploaded. Please try again.");
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
      AppAlert.success("Lab report saved", test.trim());
      onSuccess?.();
      close();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const showVisitError = submitted && visitError;

  return (
    <AppModal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        className="flex-1 bg-white"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <UploadSheetHeader
          title="Upload document"
          subtitle="Add a file to this visit or save a lab report"
          onClose={close}
          disabled={busy}
        />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 32 }}
        >
          <View className="flex-row gap-3" accessibilityRole="tablist">
            <TabCard
              active={tab === "visit"}
              icon="attach"
              title="Visit file"
              description="Attach scans or photos to this consultation"
              onPress={() => switchTab("visit")}
              disabled={busy}
            />
            <TabCard
              active={tab === "lab"}
              icon="flask-outline"
              title="Lab report"
              description={
                canUploadLab
                  ? "Save a test result to the patient's history"
                  : "Needs a patient and facility"
              }
              onPress={() => switchTab("lab")}
              disabled={!canUploadLab || busy}
            />
          </View>

          {tab === "visit" ? (
            <FormSection
              label="Files"
              required
              aside={
                visitFiles.length > 0 ? (
                  <Text className="text-xs text-neutral-500">
                    {visitFiles.length} / {MAX_VISIT_FILES}
                  </Text>
                ) : null
              }
            >
              <View className="gap-2.5">
                {visitFiles.map((f, i) => (
                  <PickedFileRow
                    key={`${f.uri}-${i}`}
                    file={f}
                    disabled={busy}
                    onRemove={() =>
                      setVisitFiles((prev) =>
                        prev.filter((_, idx) => idx !== i)
                      )
                    }
                  />
                ))}
                {visitFiles.length < MAX_VISIT_FILES ? (
                  <FileDropZone
                    title={
                      visitFiles.length ? "Add more files" : "Tap to choose files"
                    }
                    hint={`Up to ${MAX_VISIT_FILES} files, ${MAX_SIZE_MB} MB each`}
                    formats={FORMATS}
                    onPress={() => void pickVisitFiles()}
                    disabled={busy || !consultationId}
                    error={Boolean(fileError || showVisitError)}
                    compact={visitFiles.length > 0}
                  />
                ) : null}
              </View>
              {fileError ? (
                <FieldError message={fileError} />
              ) : showVisitError ? (
                <FieldError message={visitError} />
              ) : null}
            </FormSection>
          ) : null}

          {tab === "lab" && canUploadLab ? (
            <View className="gap-5">
              <View className="gap-2">
                <TextField
                  label="Test name"
                  required
                  value={test}
                  onChangeText={setTest}
                  placeholder="e.g. CBC, Lipid profile"
                  editable={!busy}
                  autoCapitalize="words"
                  returnKeyType="done"
                  error={submitted ? (labErrors.test ?? undefined) : undefined}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ gap: 6 }}
                >
                  {COMMON_TESTS.map((name) => {
                    const active = test.trim().toLowerCase() === name.toLowerCase();
                    return (
                      <Pressable
                        key={name}
                        onPress={() => setTest(name)}
                        disabled={busy}
                        className={`rounded-full border px-3 py-1.5 ${
                          active
                            ? "border-brand bg-brand-50"
                            : "border-neutral-200 bg-white active:bg-neutral-50"
                        }`}
                      >
                        <Text
                          className={`text-xs font-medium ${
                            active ? "text-brand-700" : "text-neutral-600"
                          }`}
                        >
                          {name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <FormSection
                label="Report file"
                required
                error={
                  fileError ?? (submitted ? labErrors.file : null)
                }
              >
                {labFile ? (
                  <PickedFileRow
                    file={labFile}
                    disabled={busy}
                    onReplace={() => void pickLabFile()}
                    onRemove={() => setLabFile(null)}
                  />
                ) : (
                  <FileDropZone
                    hint={`One file, up to ${MAX_SIZE_MB} MB`}
                    formats={FORMATS}
                    onPress={() => void pickLabFile()}
                    disabled={busy}
                    error={Boolean(fileError || (submitted && labErrors.file))}
                  />
                )}
              </FormSection>

              <DateField
                label="Report date"
                required
                value={date}
                onChange={setDate}
                maximumDate={new Date().toISOString().split("T")[0]}
                disabled={busy}
                error={submitted ? (labErrors.date ?? undefined) : undefined}
              />

              <FormSection label="Status" required>
                <View className="flex-row gap-2">
                  {REPORT_STATUSES.map((s) => {
                    const active = status === s;
                    const style = STATUS_STYLE[s];
                    return (
                      <Pressable
                        key={s}
                        onPress={() => setStatus(s)}
                        disabled={busy}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        className={`h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border ${
                          active
                            ? style.active
                            : "border-neutral-200 bg-white active:bg-neutral-50"
                        }`}
                      >
                        <View className={`h-2 w-2 rounded-full ${style.dot}`} />
                        <Text
                          className={`text-sm font-medium ${
                            active ? style.text : "text-neutral-600"
                          }`}
                        >
                          {style.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </FormSection>

              <FormSection label="Notes" optional>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Key findings or observations…"
                  placeholderTextColor="#9ca3af"
                  multiline
                  editable={!busy}
                  className="min-h-[88px] rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900"
                  textAlignVertical="top"
                />
              </FormSection>
            </View>
          ) : null}

          {error ? <ErrorBanner message={error} /> : null}
        </ScrollView>

        <UploadSheetFooter
          primaryLabel={
            tab === "lab"
              ? "Save report"
              : visitFiles.length > 1
                ? `Attach ${visitFiles.length} files`
                : "Attach file"
          }
          icon={tab === "lab" ? "checkmark" : "attach"}
          onPrimary={() =>
            void (tab === "lab" ? handleLabSave() : handleVisitAttach())
          }
          onCancel={close}
          busy={busy}
          primaryDisabled={tab === "visit" && !consultationId}
          showRequiredHint
        />
      </KeyboardAvoidingView>
    </AppModal>
  );
}
