import { useState } from "react";
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
import { SectionChrome } from "@/features/consult/components/SectionChrome";
import {
  FileViewerActions,
  ImagePreviewWithFullView,
  ModalSafeArea,
} from "@/features/consult/components/ImagePreview";
import { usePatientQuestionnaire } from "../hooks";
import { buildInsuranceSummary, type InsuranceSummary } from "../medicalHistory";
import type { Patient } from "../types";
import {
  calcAge,
  formatDob,
  fullName,
  initials,
  normalizeGender,
} from "../utils";
import { BRAND, formatShortDate } from "../components/kit";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="w-1/2 gap-0.5 py-1.5 pr-3">
      <Text className="text-[11px] uppercase tracking-wide text-neutral-400">
        {label}
      </Text>
      <Text className="text-sm text-neutral-900">{value || "—"}</Text>
    </View>
  );
}

const isImagePath = (s: string) =>
  s.startsWith("data:image") ||
  /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(s.split("?")[0] ?? s);
const isPdfPath = (s: string) =>
  s.startsWith("data:application/pdf") ||
  /\.pdf$/i.test(s.split("?")[0] ?? s);
/** A document name alone (no uri was saved) cannot be opened. */
const isOpenable = (s: string) =>
  s.startsWith("data:") || s.startsWith("/") || /^https?:\/\//i.test(s);

function validTillText(raw: string): string {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : formatShortDate(raw);
}

function InsuranceRow({
  insurance,
  patientName,
}: {
  insurance: InsuranceSummary;
  patientName: string;
}) {
  const [open, setOpen] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const doc = insurance.documentUrl;
  const docName = insurance.documentName || "Insurance document";

  const openDocument = async () => {
    setError(null);
    setOpen(true);
    // A data: URI is already the file; anything else is private storage.
    if (doc.startsWith("data:")) {
      setLocalUri(doc);
      return;
    }
    setLocalUri(null);
    setLoading(true);
    try {
      const { localUri: uri } = await fetchProxiedFileToCache(doc);
      setLocalUri(uri);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  const parts = [
    insurance.insuranceName || "—",
    insurance.typeLabel || null,
    insurance.validTill ? `Valid till: ${validTillText(insurance.validTill)}` : null,
  ].filter(Boolean);

  return (
    <View className="mt-2 flex-row flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
      <View className="h-7 w-7 items-center justify-center rounded-md bg-brand-50">
        <Ionicons name="shield-checkmark-outline" size={15} color={BRAND} />
      </View>
      <Text className="min-w-0 flex-1 text-sm text-neutral-800">
        <Text className="text-neutral-500">Insurance: </Text>
        {parts.join(" · ")}
      </Text>
      {doc && isOpenable(doc) ? (
        <Pressable
          onPress={() => void openDocument()}
          accessibilityLabel="View insurance card"
          className="h-8 flex-row items-center gap-1 rounded-lg border border-neutral-300 px-2.5"
        >
          <Ionicons name="eye-outline" size={14} color={BRAND} />
          <Text className="text-xs font-medium text-brand">View</Text>
        </Pressable>
      ) : null}

      <AppModal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <ModalSafeArea>
          <View className="flex-row items-center justify-between border-b border-neutral-200 px-4 py-3">
            <View className="mr-3 min-w-0 flex-1">
              <Text
                className="text-base font-semibold text-neutral-900"
                numberOfLines={1}
              >
                Insurance card
              </Text>
              <Text className="text-xs text-neutral-500" numberOfLines={1}>
                {patientName ? `${patientName} — ${docName}` : docName}
              </Text>
            </View>
            <Pressable onPress={() => setOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {loading ? (
              <View className="items-center py-10">
                <ActivityIndicator color={BRAND} />
                <Text className="mt-2 text-xs text-neutral-500">
                  Loading file…
                </Text>
              </View>
            ) : null}
            {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
            {localUri && isImagePath(doc) ? (
              <ImagePreviewWithFullView
                uri={localUri}
                title="Insurance card"
                fileName={docName}
                height={360}
              />
            ) : null}
            {localUri && !isImagePath(doc) ? (
              <View className="items-center gap-3">
                <Button
                  label={isPdfPath(doc) ? "Open PDF" : "Open document"}
                  variant="outline"
                  onPress={() => void Linking.openURL(localUri)}
                />
                {!localUri.startsWith("data:") ? (
                  <FileViewerActions
                    localUri={localUri}
                    fileName={docName}
                    title="Insurance card"
                  />
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </ModalSafeArea>
      </AppModal>
    </View>
  );
}

export function PatientHeaderCard({
  patient,
  questionnairePatientId,
}: {
  patient: Patient;
  /** Pass the same id as the Medical history card so both share one query. */
  questionnairePatientId: string;
}) {
  const questionnaire = usePatientQuestionnaire(questionnairePatientId);
  const insurance = buildInsuranceSummary(questionnaire.data);
  const mrd =
    patient.mrdNumber != null && String(patient.mrdNumber).trim() !== ""
      ? String(patient.mrdNumber)
      : null;

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-50">
          <Text className="text-base font-bold text-brand-700">
            {initials(patient)}
          </Text>
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <Text
            className="text-xl font-semibold tracking-tight text-neutral-900"
            numberOfLines={1}
          >
            {fullName(patient)}
          </Text>
          {/* MRD is the clinic's file number — what staff work with — so it
              leads, as in Practice. The universal patient ID stays beside it. */}
          <View className="flex-row flex-wrap items-center gap-2">
            {mrd ? (
              <View className="flex-row items-center gap-1 rounded-md border border-brand/40 bg-brand-50 px-2 py-0.5">
                <Text className="text-xs text-neutral-500">MRD</Text>
                <Text className="text-sm font-semibold text-neutral-900">
                  {mrd}
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-center gap-1 rounded-md border border-neutral-200 px-2 py-0.5">
              <Text className="text-xs text-neutral-500">Patient ID</Text>
              <Text className="text-xs font-medium text-neutral-900">
                {String(patient.patientId)}
              </Text>
            </View>
            {patient.abhaNumber ? (
              <View className="flex-row items-center gap-1 rounded-md border border-neutral-200 px-2 py-0.5">
                <Ionicons name="card-outline" size={12} color={BRAND} />
                <Text className="text-xs text-neutral-900">
                  ABHA: {patient.abhaNumber}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <SectionChrome title="Demographics" icon="person-outline">
        <View className="flex-row flex-wrap">
          <Field label="Gender" value={normalizeGender(patient.gender)} />
          <Field
            label="Age"
            value={
              calcAge(patient.dob) != null
                ? `${calcAge(patient.dob)} years`
                : "—"
            }
          />
          <Field label="Date of birth" value={formatDob(patient.dob)} />
          <Field label="Blood group" value={patient.bloodGroup} />
          <Field label="Mobile" value={patient.phone} />
          <Field label="Email" value={patient.email} />
          <Field label="Guardian" value={patient.parentOrGuardianName} />
        </View>
        {patient.address ? (
          <View className="mt-2 gap-0.5 border-t border-neutral-100 pt-3">
            <Text className="text-xs uppercase tracking-wide text-neutral-400">
              Address
            </Text>
            <Text className="text-base text-neutral-900">{patient.address}</Text>
          </View>
        ) : null}
        {insurance ? (
          <InsuranceRow insurance={insurance} patientName={fullName(patient)} />
        ) : null}
      </SectionChrome>
    </View>
  );
}
