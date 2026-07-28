import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/ui";
import { describeError } from "@/lib/api/errors";
import type { PatientDocumentItem } from "@/lib/api/endpoints/documents";
import { fetchProxiedFileToCache } from "@/lib/api/fetchProxiedFile";
import { isImageUrl } from "../labReports";
import { usePatientDocuments } from "../hooks";
import { DocumentUploadSheet } from "./DocumentUploadSheet";
import { SectionChrome } from "./SectionChrome";

function formatDocDate(value?: string | Date | null): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function shortType(fileType?: string | null): string {
  if (!fileType) return "—";
  if (fileType.includes("pdf")) return "PDF";
  if (fileType.includes("jpeg") || fileType.includes("jpg")) return "JPEG";
  if (fileType.includes("png")) return "PNG";
  if (fileType.includes("wordprocessingml") || fileType.includes("docx"))
    return "DOCX";
  if (fileType.includes("msword") || fileType.includes("doc")) return "DOC";
  return fileType.split("/").pop()?.toUpperCase() ?? fileType;
}

/**
 * Patient Documents ledger — list + upload + proxy view.
 * Distinct from visit files (consult attachments) and lab reports.
 */
export function DocumentsCard({ patientId }: { patientId: string }) {
  const docsQ = usePatientDocuments(patientId);
  const documents = docsQ.data?.documents ?? [];

  const [uploadOpen, setUploadOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLocalUri, setViewLocalUri] = useState<string | null>(null);
  const [viewTitle, setViewTitle] = useState("Document");
  const [viewIsImage, setViewIsImage] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);

  const openDocument = async (doc: PatientDocumentItem) => {
    setError(null);
    const storageUrl = doc.url?.trim();
    if (!storageUrl) return;
    const title = doc.displayName || doc.fileName || "Document";
    const asImage =
      isImageUrl(storageUrl) || (doc.fileType ?? "").startsWith("image/");

    setViewTitle(title);
    setViewIsImage(asImage);
    setViewLocalUri(null);
    setViewLoading(true);
    setViewOpen(true);

    try {
      const { localUri } = await fetchProxiedFileToCache(storageUrl);
      if (asImage) {
        setViewLocalUri(localUri);
      } else {
        setViewOpen(false);
        await Linking.openURL(localUri);
      }
    } catch (e) {
      setError(describeError(e));
      setViewOpen(false);
    } finally {
      setViewLoading(false);
    }
  };

  return (
    <View className="gap-2">
      <SectionChrome
        title="Documents"
        icon="document-text-outline"
        badge={documents.length}
        right={
          <Button
            label="Upload"
            variant="primary"
            size="md"
            className="shrink-0"
            onPress={() => setUploadOpen(true)}
            icon={<Ionicons name="add" size={16} color="#fff" />}
          />
        }
      >
        {docsQ.isLoading && !docsQ.data ? (
          <View className="items-center py-6">
            <ActivityIndicator color="#FD006A" />
          </View>
        ) : docsQ.isError && !docsQ.data ? (
          <Text className="text-sm text-red-500">
            {describeError(docsQ.error)}
          </Text>
        ) : documents.length === 0 ? (
          <Text className="text-xs italic text-neutral-500">
            No documents yet. Upload insurance cards, referral scans, or other
            patient files.
          </Text>
        ) : (
          <View className="gap-0">
            <View className="mb-1.5 flex-row gap-2 border-b border-neutral-100 pb-1.5">
              <Text className="w-[72px] text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                Date
              </Text>
              <Text className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                Document
              </Text>
              <Text className="w-14 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                Type
              </Text>
              <Text className="w-14 text-right text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                View
              </Text>
            </View>
            {documents.map((doc, idx) => {
              const key = doc.patientDocumentId || doc.id || String(idx);
              const name = doc.displayName || doc.fileName || "—";
              return (
                <View
                  key={key}
                  className={`flex-row items-start gap-2 py-2.5 ${
                    idx < documents.length - 1
                      ? "border-b border-neutral-100"
                      : ""
                  }`}
                >
                  <Text className="w-[72px] text-xs text-neutral-500">
                    {formatDocDate(doc.createdAt)}
                  </Text>
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text
                      className="text-xs font-medium text-neutral-900"
                      numberOfLines={2}
                    >
                      {name}
                    </Text>
                    {doc.uploadedByPatient ? (
                      <Text className="text-[10px] text-neutral-500">
                        Uploaded by patient
                      </Text>
                    ) : null}
                  </View>
                  <View className="w-14">
                    <View className="self-start rounded-full border border-neutral-200 px-1.5 py-0.5">
                      <Text
                        className="text-[10px] font-medium text-neutral-600"
                        numberOfLines={1}
                      >
                        {shortType(doc.fileType)}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => void openDocument(doc)}
                    className="h-7 w-14 flex-row items-center justify-end gap-0.5"
                    accessibilityLabel={`View ${name}`}
                  >
                    <Ionicons name="eye-outline" size={14} color="#FD006A" />
                    <Text className="text-xs font-medium text-brand">View</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </SectionChrome>

      {error ? <Text className="text-sm text-red-500">{error}</Text> : null}

      <DocumentUploadSheet
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        patientId={patientId}
        onSuccess={() => void docsQ.refetch()}
      />

      <Modal
        visible={viewOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setViewOpen(false)}
      >
        <View className="flex-1 bg-white">
          <View className="flex-row items-center justify-between border-b border-neutral-200 px-4 py-3">
            <Text
              className="mr-3 flex-1 text-base font-semibold text-neutral-900"
              numberOfLines={1}
            >
              {viewTitle}
            </Text>
            <Pressable onPress={() => setViewOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {viewLoading ? (
              <View className="items-center py-10">
                <ActivityIndicator color="#FD006A" />
                <Text className="mt-2 text-xs text-neutral-500">
                  Loading file…
                </Text>
              </View>
            ) : viewLocalUri && viewIsImage ? (
              <Image
                source={{ uri: viewLocalUri }}
                style={{ width: "100%", height: 420, borderRadius: 8 }}
                resizeMode="contain"
              />
            ) : viewLocalUri ? (
              <Button
                label="Open file"
                variant="outline"
                onPress={() => void Linking.openURL(viewLocalUri)}
              />
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
