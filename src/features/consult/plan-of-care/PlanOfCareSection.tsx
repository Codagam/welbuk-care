import { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import {
  useInvalidatePatientHistory,
  usePatientHistory,
  useSaveSummary,
  useSummary,
} from "@/features/consult/hooks";
import { useDentalFlushOptional } from "@/features/dental/DentalConsultContext";
import { describeError } from "@/lib/api/errors";
import { useAuthUser, useFacilityId } from "@/lib/auth/store";
import { config } from "@/lib/config";

import { CompleteBar } from "./components/CompleteBar";
import { FollowUpSheet } from "./components/FollowUpSheet";
import { LabsCard } from "./components/LabsCard";
import {
  ConversationSummaryCard,
  DoctorNotesCard,
} from "./components/NotesCards";
import { PrescriptionCard } from "./components/PrescriptionCard";
import { ReferSheet } from "./components/ReferSheet";
import {
  useAllergyGate,
  useCompletePrescription,
  useDrugCatalog,
  usePrescriptionDraft,
} from "./hooks/usePrescriptionDraft";
import type { AllergyRecordLike } from "./types";

function normalizeAllergies(
  raw: unknown
): Array<{ name: string; severity?: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => {
      if (typeof a === "string") return { name: a };
      if (a && typeof a === "object" && "name" in a) {
        const o = a as AllergyRecordLike;
        return {
          name: String(o.name ?? ""),
          severity: o.severity ?? undefined,
        };
      }
      return null;
    })
    .filter((a): a is { name: string; severity?: string } => !!a?.name?.trim());
}

function isMongoId(id: string | undefined | null): boolean {
  return !!id && /^[a-f\d]{24}$/i.test(id.trim());
}

export function PlanOfCareSection({
  consultationId,
  appointmentId,
  patientId,
  patientName,
  patientAge,
  patientGender,
  patientPhone,
  doctorId,
  doctorName,
}: {
  consultationId: string;
  appointmentId?: string;
  patientId?: string;
  patientName?: string;
  patientAge?: number | string;
  patientGender?: string;
  patientPhone?: string;
  doctorId?: string;
  doctorName?: string;
}) {
  const { width } = useWindowDimensions();
  /** Tablet / landscape: notes share a horizontal row */
  const tablet = width >= 700;

  const facilityId = useFacilityId() ?? "";
  const user = useAuthUser();
  const resolvedDoctorId = doctorId || user?.id || "";
  const resolvedDoctorName =
    doctorName || user?.name || user?.email || "Doctor";

  const summaryQ = useSummary(consultationId);
  const historyQ = usePatientHistory(patientId, consultationId);
  const invalidateHistory = useInvalidatePatientHistory(
    patientId,
    consultationId
  );
  const saveSummary = useSaveSummary(consultationId);

  const draft = usePrescriptionDraft(consultationId);
  const drugsQ = useDrugCatalog(true);
  const allergies = useMemo(
    () => normalizeAllergies(historyQ.data?.allergies),
    [historyQ.data?.allergies]
  );
  const allergy = useAllergyGate(draft.prescriptions, allergies, drugsQ.data);

  const complete = useCompletePrescription(consultationId);
  const flushDental = useDentalFlushOptional();

  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [referOpen, setReferOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const labReports = historyQ.data?.labReports ?? [];
  const followUpLine = summaryQ.data?.followUp ?? null;

  const patientLine =
    patientName ||
    (patientId ? `Patient ${patientId.slice(-6)}` : "Patient");

  const openInvoice = () => {
    const base = config.practiceUrl.replace(/\/$/, "");
    const pid = (patientId ?? "").trim();
    const url = isMongoId(pid)
      ? `${base}/billing?patientId=${encodeURIComponent(pid)}`
      : `${base}/billing`;
    void Linking.openURL(url);
  };

  const runComplete = async () => {
    setError(null);
    setDone(null);
    if (allergy.allergyPrintBlocked) {
      setError("Acknowledge allergy warnings before completing.");
      return;
    }

    const hasMeds = draft.prescriptions.some(
      (p) => (p.name ?? "").trim().length > 0
    );
    const hasAttach = draft.attachedImages.some(
      (i) => (i.url ?? "").trim().length > 0
    );

    const proceed = async () => {
      try {
        if (flushDental) {
          const ok = await flushDental();
          if (!ok) {
            setError("Could not flush dental chart/plan before complete.");
            return;
          }
        }
        const res = await complete.mutateAsync({
          appointmentId,
          patientId,
          prescriptions: draft.prescriptions,
          attachmentUrls: draft.attachedImages
            .map((i) => i.url)
            .filter(Boolean),
          allergyOverrideAck: allergy.allergyOverrideAck,
        });
        setDone(
          res.consultationNumber
            ? `Completed · ${res.consultationNumber}`
            : "Visit completed."
        );
      } catch (e) {
        setError(describeError(e));
      }
    };

    if (!hasMeds && !hasAttach) {
      Alert.alert(
        "Complete without prescription?",
        "No medicines or attachments. Complete this visit anyway?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Complete", onPress: () => void proceed() },
        ]
      );
      return;
    }
    await proceed();
  };

  return (
    <View style={styles.stack}>
      <CompleteBar
        followUpSummaryLine={followUpLine}
        onFollowUp={() => setFollowUpOpen(true)}
        onInvoice={openInvoice}
        onComplete={() => void runComplete()}
        completing={complete.isPending}
        completeDisabled={allergy.allergyPrintBlocked}
        completeDisabledReason={
          allergy.allergyPrintBlocked
            ? "Acknowledge allergy warnings to unlock Complete."
            : null
        }
      />

      {draft.isLoading || summaryQ.isLoading ? (
        <Text className="text-sm text-neutral-400">Loading plan of care…</Text>
      ) : null}

      {/* 1. Prescription */}
      <View style={styles.block}>
        <PrescriptionCard
          consultationId={consultationId}
          prescriptions={draft.prescriptions}
          onAdd={draft.addPrescription}
          onRemove={draft.removePrescription}
          onApplyTemplate={draft.applyTemplateMeds}
          attachedImages={draft.attachedImages}
          onAttachedImagesChange={draft.setAttachedImages}
          allergyWarnings={allergy.warnings}
          allergyOverrideAck={allergy.allergyOverrideAck}
          onAllergyOverrideChange={allergy.setAllergyOverrideAck}
          drugs={drugsQ.data ?? []}
          tabletLayout={tablet}
        />
      </View>

      {/* 2. Labs — full width, never shares a row with notes */}
      <View style={styles.block}>
        <LabsCard labReports={labReports} onRefer={() => setReferOpen(true)} />
      </View>

      {/* 3. Doctor Notes + Conversation Summary */}
      {tablet ? (
        <View style={styles.notesRow}>
          <View style={styles.notesCol}>
            <DoctorNotesCard
              consultationId={consultationId}
              initialNotes={summaryQ.data?.doctorNotes}
            />
          </View>
          <View style={styles.notesCol}>
            <ConversationSummaryCard
              consultationId={consultationId}
              initialSummary={summaryQ.data?.summary}
              isAIGenerated={!!summaryQ.data?.isAIGenerated}
            />
          </View>
        </View>
      ) : (
        <View style={styles.stackTight}>
          <DoctorNotesCard
            consultationId={consultationId}
            initialNotes={summaryQ.data?.doctorNotes}
          />
          <ConversationSummaryCard
            consultationId={consultationId}
            initialSummary={summaryQ.data?.summary}
            isAIGenerated={!!summaryQ.data?.isAIGenerated}
          />
        </View>
      )}

      {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
      {done ? <Text className="text-sm text-emerald-600">{done}</Text> : null}

      <FollowUpSheet
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        facilityId={facilityId}
        consultationId={consultationId}
        patientId={patientId ?? ""}
        doctorId={resolvedDoctorId}
        patientLine={patientLine}
        doctorLine={resolvedDoctorName}
        followUpSummaryLine={followUpLine}
        onBooked={async (line) => {
          await saveSummary.mutateAsync({ followUp: line });
        }}
      />

      <ReferSheet
        open={referOpen}
        onClose={() => setReferOpen(false)}
        patientId={patientId}
        patientName={patientName || patientLine}
        patientAge={patientAge ?? "—"}
        patientGender={patientGender}
        patientPhone={patientPhone}
        doctorId={resolvedDoctorId}
        doctorName={resolvedDoctorName}
        onCreated={() => invalidateHistory()}
      />
    </View>
  );
}

/** Explicit RN styles — NativeWind `gap` alone can become CSS flex-row on web and overlay Labs on notes. */
const styles = StyleSheet.create({
  stack: {
    width: "100%",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 20,
  },
  stackTight: {
    width: "100%",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 16,
  },
  block: {
    width: "100%",
    flexDirection: "column",
    alignItems: "stretch",
  },
  notesRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "stretch",
    gap: 16,
  },
  notesCol: {
    flex: 1,
    minWidth: 0,
  },
});
