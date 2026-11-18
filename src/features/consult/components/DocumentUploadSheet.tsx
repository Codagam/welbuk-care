import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";

import { AppAlert, AppModal } from "@/ui";
import { describeError } from "@/lib/api/errors";
import {
  PATIENT_DOCUMENT_MAX_BYTES,
  PATIENT_DOCUMENT_MIME,
} from "@/lib/api/endpoints/documents";
import { useUploadPatientDocument } from "../hooks";
import {
  ErrorBanner,
  FileDropZone,
  FormSection,
  PickedFileRow,
  UploadSheetFooter,
  UploadSheetHeader,
  type PickedFile,
} from "./upload/UploadKit";

const MAX_SIZE_MB = 10;
const ACCEPT_EXT = /\.(jpe?g|png|pdf|docx?)$/i;
const FORMATS = ["PDF", "JPG", "PNG", "DOC", "DOCX"];

function mimeOf(asset: {
  name?: string | null;
  mimeType?: string | null;
}): string {
  const mime = (asset.mimeType ?? "").toLowerCase();
  if (PATIENT_DOCUMENT_MIME.has(mime)) return mime;
  const name = asset.name ?? "";
  if (/\.pdf$/i.test(name)) return "application/pdf";
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.jpe?g$/i.test(name)) return "image/jpeg";
  if (/\.docx$/i.test(name)) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (/\.doc$/i.test(name)) return "application/msword";
  return mime || "application/octet-stream";
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onSuccess?: () => void;
};

/**
 * Staff patient-document upload sheet — file only (patient context known).
 * POST /api/documents/upload with type=patient.
 */
export function DocumentUploadSheet({
  open,
  onOpenChange,
  patientId,
  onSuccess,
}: Props) {
  const upload = useUploadPatientDocument(patientId);
  const [file, setFile] = useState<PickedFile | null>(null);
  /** Picker problems (wrong type / too big) — shown under the file field. */
  const [fileError, setFileError] = useState<string | null>(null);
  /** Request failures — shown as a banner above the footer. */
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setFileError(null);
    setError(null);
    setSubmitted(false);
    setBusy(false);
  }, [open]);

  const close = () => onOpenChange(false);

  const pickFile = async () => {
    setFileError(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: [
          "image/jpeg",
          "image/png",
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const a = picked.assets[0];
      const mime = mimeOf(a);
      const name = a.name || "file";
      if (!PATIENT_DOCUMENT_MIME.has(mime) && !ACCEPT_EXT.test(name)) {
        setFileError("Only JPG, PNG, PDF, DOC, or DOCX are allowed.");
        return;
      }
      if (
        typeof a.size === "number" &&
        a.size > PATIENT_DOCUMENT_MAX_BYTES
      ) {
        setFileError(`File must be ${MAX_SIZE_MB} MB or smaller.`);
        return;
      }
      setFile({
        uri: a.uri,
        name,
        mimeType: PATIENT_DOCUMENT_MIME.has(mime) ? mime : mimeOf({ name }),
        size: a.size,
      });
    } catch (e) {
      setFileError(describeError(e));
    }
  };

  const handleUpload = async () => {
    setSubmitted(true);
    setError(null);
    if (!file || !patientId) return;
    setBusy(true);
    try {
      await upload.mutateAsync({
        uri: file.uri,
        fileName: file.name,
        mimeType: file.mimeType,
      });
      AppAlert.success("Document uploaded", file.name);
      onSuccess?.();
      close();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const missingFile = submitted && !file;

  return (
    <AppModal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <View className="flex-1 bg-white">
        <UploadSheetHeader
          title="Upload document"
          subtitle="Insurance card, referral letter, ID or other patient file"
          icon="folder-open-outline"
          onClose={close}
          disabled={busy}
        />

        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 32 }}
        >
          <FormSection
            label="Document file"
            required
            error={
              fileError ?? (missingFile ? "Choose a file to upload" : null)
            }
          >
            {file ? (
              <PickedFileRow
                file={file}
                disabled={busy}
                onReplace={() => void pickFile()}
                onRemove={() => setFile(null)}
              />
            ) : (
              <FileDropZone
                hint={`One file, up to ${MAX_SIZE_MB} MB`}
                formats={FORMATS}
                onPress={() => void pickFile()}
                disabled={busy}
                error={Boolean(fileError || missingFile)}
              />
            )}
          </FormSection>

          {error ? <ErrorBanner message={error} /> : null}
        </ScrollView>

        <UploadSheetFooter
          primaryLabel="Upload"
          onPrimary={() => void handleUpload()}
          onCancel={close}
          busy={busy}
          showRequiredHint
        />
      </View>
    </AppModal>
  );
}
