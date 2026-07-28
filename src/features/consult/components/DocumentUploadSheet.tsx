import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";

import { Button } from "@/ui";
import { describeError } from "@/lib/api/errors";
import {
  PATIENT_DOCUMENT_MAX_BYTES,
  PATIENT_DOCUMENT_MIME,
} from "@/lib/api/endpoints/documents";
import { useUploadPatientDocument } from "../hooks";

const MAX_SIZE_MB = 10;
const ACCEPT_EXT = /\.(jpe?g|png|pdf|docx?)$/i;

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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setError(null);
    setBusy(false);
  }, [open]);

  const close = () => onOpenChange(false);

  const pickFile = async () => {
    setError(null);
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
        setError("Only JPG, PNG, PDF, DOC, or DOCX are allowed.");
        return;
      }
      if (
        typeof a.size === "number" &&
        a.size > PATIENT_DOCUMENT_MAX_BYTES
      ) {
        setError(`File must be ${MAX_SIZE_MB} MB or smaller.`);
        return;
      }
      setFile({
        uri: a.uri,
        name,
        mimeType: PATIENT_DOCUMENT_MIME.has(mime) ? mime : mimeOf({ name }),
        size: a.size,
      });
    } catch (e) {
      setError(describeError(e));
    }
  };

  const handleUpload = async () => {
    if (!file || !patientId) return;
    setBusy(true);
    setError(null);
    try {
      await upload.mutateAsync({
        uri: file.uri,
        fileName: file.name,
        mimeType: file.mimeType,
      });
      Alert.alert("Document uploaded");
      onSuccess?.();
      close();
    } catch (e) {
      const msg = describeError(e);
      setError(msg);
      Alert.alert("Upload failed", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
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

        <View className="gap-4 p-4">
          <Text className="text-xs text-neutral-500">
            Attach an insurance card, referral scan, or other patient file
            (JPG, PNG, PDF, DOC, DOCX — up to {MAX_SIZE_MB} MB).
          </Text>

          <Pressable
            onPress={() => void pickFile()}
            disabled={busy}
            className="items-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 px-4 py-8 active:border-brand"
          >
            {file ? (
              <>
                <Ionicons
                  name={
                    file.mimeType === "application/pdf" ||
                    file.mimeType.includes("word")
                      ? "document-text-outline"
                      : "image-outline"
                  }
                  size={28}
                  color="#FD006A"
                />
                <Text
                  className="text-sm font-medium text-neutral-800"
                  numberOfLines={1}
                >
                  {file.name}
                </Text>
                <Text className="text-xs text-brand">Tap to change</Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="cloud-upload-outline"
                  size={28}
                  color="#FD006A"
                />
                <Text className="text-sm font-medium text-neutral-800">
                  Choose file
                </Text>
                <Text className="text-center text-xs text-neutral-500">
                  JPG, PNG, PDF, DOC, or DOCX — up to {MAX_SIZE_MB} MB
                </Text>
              </>
            )}
          </Pressable>

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
              label="Upload"
              size="md"
              onPress={() => void handleUpload()}
              loading={busy}
              disabled={!file || busy}
            />
          </View>

          {busy ? (
            <View className="items-center py-2">
              <ActivityIndicator color="#FD006A" />
              <Text className="mt-2 text-xs text-neutral-500">Uploading…</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
