import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";

import { AppModal, Button, DateField, TextField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { useFacilityId } from "@/lib/auth/store";
import { uploadFile } from "@/lib/api/endpoints/recording";
import { createPatientLabReport } from "@/lib/api/endpoints/lab-reports";

const LAB_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onSuccess?: () => void;
};

/**
 * Lab report upload: POST /api/upload (patient_lab_report) → POST /api/patient/lab-reports.
 * Requires patient.update on some roles (Practice gap vs patient.write).
 */
export function LabReportUploadSheet({
  open,
  onOpenChange,
  patientId,
  onSuccess,
}: Props) {
  const facilityId = useFacilityId();
  const [test, setTest] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("COMPLETED");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<PickedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTest("");
    setDate(new Date().toISOString().slice(0, 10));
    setStatus("COMPLETED");
    setNotes("");
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
        type: ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"],
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const a = picked.assets[0];
      const mime = (a.mimeType ?? "").toLowerCase();
      const name = a.name || "lab-report";
      let resolved = mime;
      if (!LAB_MIME.has(resolved)) {
        if (/\.pdf$/i.test(name)) resolved = "application/pdf";
        else if (/\.png$/i.test(name)) resolved = "image/png";
        else if (/\.jpe?g$/i.test(name)) resolved = "image/jpeg";
      }
      if (!LAB_MIME.has(resolved)) {
        setError("Only JPG, PNG, WEBP, GIF, or PDF are allowed.");
        return;
      }
      setFile({ uri: a.uri, name, mimeType: resolved });
    } catch (e) {
      setError(describeError(e));
    }
  };

  const save = async () => {
    setError(null);
    if (!facilityId) {
      setError("No facility selected.");
      return;
    }
    if (!test.trim()) {
      setError("Test name is required.");
      return;
    }
    if (!date.trim()) {
      setError("Date is required.");
      return;
    }
    if (!file) {
      setError("Please choose a lab report file.");
      return;
    }

    setBusy(true);
    try {
      const urls = await uploadFile(
        file.uri,
        file.name,
        file.mimeType,
        "patient_lab_report",
        { patientId, facilityId }
      );
      const fileUrl = urls[0];
      if (!fileUrl) throw new Error("Upload failed");

      const form = new FormData();
      form.append("patientId", patientId);
      form.append("date", new Date(date).toISOString());
      form.append("test", test.trim());
      form.append("status", status.toUpperCase());
      if (notes.trim()) form.append("notes", notes.trim());
      form.append("fileUrl", fileUrl);

      await createPatientLabReport(facilityId, form);
      onSuccess?.();
      close();
    } catch (e) {
      setError(describeError(e));
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
            Upload lab report
          </Text>
          <Pressable onPress={close} hitSlop={12} disabled={busy}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        >
          <TextField
            label="Test name"
            value={test}
            onChangeText={setTest}
            placeholder="e.g. CBC, HbA1c"
          />
          <DateField label="Date" value={date} onChange={setDate} />
          <TextField
            label="Status"
            value={status}
            onChangeText={setStatus}
            placeholder="COMPLETED"
            autoCapitalize="characters"
          />
          <TextField
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <Pressable
            onPress={() => void pickFile()}
            disabled={busy}
            className="flex-row items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-4"
          >
            <Ionicons name="document-attach-outline" size={22} color="#FD006A" />
            <View className="flex-1">
              <Text className="text-sm font-medium text-neutral-900">
                {file ? file.name : "Choose image or PDF"}
              </Text>
              <Text className="text-xs text-neutral-500">Max 10 MB</Text>
            </View>
          </Pressable>

          {error ? (
            <Text className="text-sm text-red-500">{error}</Text>
          ) : null}

          <Button
            label="Upload"
            onPress={() => void save()}
            loading={busy}
            disabled={busy}
            icon={
              busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
              )
            }
          />
        </ScrollView>
      </View>
    </AppModal>
  );
}
