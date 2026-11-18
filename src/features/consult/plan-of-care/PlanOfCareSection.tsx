﻿import { useRouter } from "expo-router";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Keyboard,
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

import { CONSULT_LOCKED_COMPLETE_REASON } from "@/features/consult/consultLock";

import { CompleteBar } from "./components/CompleteBar";
import { CompleteFooter } from "./components/CompleteFooter";
import { FollowUpSheet } from "./components/FollowUpSheet";
import {
  ConversationSummaryCard,
  FinalSummaryCard,
} from "./components/NotesCards";
import { PrescriptionCard } from "./components/PrescriptionCard";
import type { PickerAnchor } from "./components/regimen/pickerPlacement";
import {
  useAllergyGate,
  useCompletePrescription,
  useDrugCatalog,
  usePrescriptionDraft,
} from "./hooks/usePrescriptionDraft";
import type { AllergyRecordLike } from "./types";
import { AppAlert } from "@/ui/AppAlert";
import { useInvalidateConsultOrders } from "@/features/consult/orders/hooks";
import { sendAllConsultOrders } from "@/lib/api/endpoints/orders";

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

export function PlanOfCareSection({
  consultationId,
  appointmentId,
  patientId,
  patientName,
  patientAgeYears,
  doctorId,
  onStickyFooter,
  locked = false,
  flushNotes,
}: {
  consultationId: string;
  appointmentId?: string;
  patientId?: string;
  patientName?: string;
  patientAge?: number | string;
  /** Whole years, or null when unknown. Drives the child dose check. */
  patientAgeYears?: number | null;
  patientGender?: string;
  patientPhone?: string;
  doctorId?: string;
  doctorName?: string;
  /** Renders the Complete CTA as a sticky screen footer (UI placement only). */
  onStickyFooter?: (footer: ReactNode | null) => void;
  locked?: boolean;
  /** Writes unsaved SOAP notes. Complete waits on it: a locked consult refuses them. */
  flushNotes?: () => Promise<boolean>;
}) {
  const { width } = useWindowDimensions();
  /** Tablet / landscape: notes share a horizontal row */
  const tablet = width >= 700;

  const router = useRouter();
  const facilityId = useFacilityId() ?? "";
  const user = useAuthUser();
  const resolvedDoctorId = doctorId || user?.id || "";

  const summaryQ = useSummary(consultationId);
  const historyQ = usePatientHistory(patientId, consultationId);
  const invalidateHistory = useInvalidatePatientHistory(
    patientId,
    consultationId
  );
  const invalidateOrders = useInvalidateConsultOrders(consultationId);
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
  const [followUpAnchor, setFollowUpAnchor] = useState<PickerAnchor>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const followUpLine = summaryQ.data?.followUp ?? null;


  const goToQueueAfterComplete = (detail?: string | null) => {
    const message = detail?.trim()
      ? detail
      : "The appointment has been completed.";
    AppAlert.alert("Appointment completed", message, [
      {
        text: "OK",
        onPress: () => router.replace("/queue"),
      },
    ]);
  };

  /**
   * Busy from the first tap. Complete flushes the dental chart and the notes
   * and sends orders BEFORE the complete call, and the spinner used to follow
   * only that last call, so the button looked dead for seconds and invited a
   * second tap.
   */
  const [completeBusy, setCompleteBusy] = useState(false);
  const completeBusyRef = useRef(false);

  /** The Final Summary box's current text (saved or not), for Complete. */
  const finalDraftRef = useRef<{ consultationId: string; text: string } | null>(null);
  const onFinalDraftChange = useCallback(
    (text: string) => {
      finalDraftRef.current = { consultationId, text };
    },
    [consultationId]
  );

  const runComplete = async () => {
    if (completeBusyRef.current) return;
    Keyboard.dismiss();
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
      if (completeBusyRef.current) return;
      completeBusyRef.current = true;
      setCompleteBusy(true);
      try {
        if (locked) {
          setError(CONSULT_LOCKED_COMPLETE_REASON);
          return;
        }
        // The two flushes write different records, so they run together.
        // Flush would 409 on a completed consult — skip when already locked.
        const [dentalOk, notesOk] = await Promise.all([
          flushDental && !locked ? flushDental() : Promise.resolve(true),
          flushNotes ? flushNotes() : Promise.resolve(true),
        ]);
        if (!dentalOk) {
          setError("Could not flush dental chart/plan before complete.");
          return;
        }
        if (!notesOk) {
          setError(
            "Could not save the clinical notes. Check the connection and try Complete again."
          );
          return;
        }
        // FINAL SUMMARY, as in Practice: saved as shown when it differs from
        // what is saved (the doctor's unsaved edit, or the AI prefill). A
        // failure stops Complete: once locked it cannot be added without
        // reopening. After the notes flush, which writes the same record.
        const savedFinal = summaryQ.data?.doctorNotes ?? "";
        const draftFinal = finalDraftRef.current;
        const finalText =
          draftFinal && draftFinal.consultationId === consultationId
            ? draftFinal.text
            : savedFinal.trim()
              ? savedFinal
              : (summaryQ.data?.summary ?? "");
        if (finalText.trim() && finalText !== savedFinal) {
          try {
            await saveSummary.mutateAsync({ doctorNotes: finalText });
          } catch (e) {
            setError(
              describeError(e) ||
                "Could not save the Final Summary. Try Complete again."
            );
            return;
          }
        }
        // Complete sends every Orders tab that holds unsent lines and a
        // destination. A failed send stops Complete and names the tab: a
        // silently dropped lab order is worse than a refused Complete.
        // Tabs on "Print only" are not sent; the prescription is their order.
        try {
          const sentRes = await sendAllConsultOrders(consultationId);
          if (sentRes.sent.length > 0) {
            await invalidateOrders();
            invalidateHistory();
          }
        } catch (e) {
          await invalidateOrders();
          setError(
            describeError(e) ||
              "Could not send the orders. Fix them in Orders & referrals, or set them to Print only."
          );
          return;
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
        const doneLabel = res.consultationNumber
          ? `Completed · ${res.consultationNumber}`
          : "Visit completed.";
        setDone(doneLabel);
        goToQueueAfterComplete(doneLabel);
      } catch (e) {
        setError(describeError(e));
      } finally {
        completeBusyRef.current = false;
        setCompleteBusy(false);
      }
    };

    if (!hasMeds && !hasAttach) {
      AppAlert.alert(
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

  const completeDisabled = allergy.allergyPrintBlocked || locked;
  const completeDisabledReason = locked
    ? CONSULT_LOCKED_COMPLETE_REASON
    : completeDisabled
      ? "Acknowledge allergy warnings to unlock Complete."
      : null;

  const runCompleteRef = useRef(runComplete);
  runCompleteRef.current = runComplete;

  useLayoutEffect(() => {
    if (!onStickyFooter) return;
    onStickyFooter(
      <CompleteFooter
        onComplete={() => void runCompleteRef.current()}
        completing={completeBusy || complete.isPending}
        completeDisabled={completeDisabled}
        completeDisabledReason={completeDisabledReason}
        error={error}
        done={done}
      />
    );
    return () => onStickyFooter(null);
  }, [
    onStickyFooter,
    completeBusy,
    complete.isPending,
    completeDisabled,
    completeDisabledReason,
    error,
    done,
    locked,
  ]);

  return (
    <View style={styles.stack}>
      <CompleteBar
        followUpSummaryLine={followUpLine}
        onFollowUp={(anchor) => {
          setFollowUpAnchor(anchor);
          setFollowUpOpen(true);
        }}
        onPrintPrescription={
          patientId
            ? () =>
                router.push({
                  pathname: "/patients/[id]/report",
                  params: { id: patientId, consultationId, appointmentId: appointmentId ?? "" },
                })
            : undefined
        }
        locked={locked}
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
          onUpdate={draft.setPrescriptions}
          onApplyTemplate={draft.applyTemplateMeds}
          attachedImages={draft.attachedImages}
          onAttachedImagesChange={draft.setAttachedImages}
          allergyWarnings={allergy.warnings}
          allergyOverrideAck={allergy.allergyOverrideAck}
          onAllergyOverrideChange={allergy.setAllergyOverrideAck}
          patientAgeYears={patientAgeYears}
          tabletLayout={tablet}
          locked={locked}
        />
      </View>

      {/* Labs, orders and referrals moved to their own section after this one
          (OrdersReferralsSection), as in Practice. */}

      {/* 3. Conversation Summary (AI, read-only) + Final Summary, as in Practice */}
      {tablet ? (
        <View style={styles.notesRow}>
          <View style={styles.notesCol}>
            <ConversationSummaryCard
              summary={summaryQ.data?.summary}
              isAIGenerated={!!summaryQ.data?.isAIGenerated}
              fill
            />
          </View>
          <View style={styles.notesCol}>
            <FinalSummaryCard
              key={consultationId}
              consultationId={consultationId}
              savedNotes={summaryQ.data?.doctorNotes}
              aiSummary={summaryQ.data?.summary}
              fill
              locked={locked}
              onDraftChange={onFinalDraftChange}
            />
          </View>
        </View>
      ) : (
        <View style={styles.stackTight}>
          <ConversationSummaryCard
            summary={summaryQ.data?.summary}
            isAIGenerated={!!summaryQ.data?.isAIGenerated}
          />
          <FinalSummaryCard
            key={consultationId}
            consultationId={consultationId}
            savedNotes={summaryQ.data?.doctorNotes}
            aiSummary={summaryQ.data?.summary}
            locked={locked}
            onDraftChange={onFinalDraftChange}
          />
        </View>
      )}

      {!onStickyFooter ? (
        <CompleteFooter
          onComplete={() => void runComplete()}
          completing={complete.isPending}
          completeDisabled={completeDisabled}
          completeDisabledReason={completeDisabledReason}
          error={error}
          done={done}
        />
      ) : null}

      <FollowUpSheet
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        anchor={followUpAnchor}
        facilityId={facilityId}
        consultationId={consultationId}
        patientId={patientId ?? ""}
        doctorId={resolvedDoctorId}
        followUpSummaryLine={followUpLine}
        onBooked={async (summary) => {
          await saveSummary.mutateAsync(summary);
        }}
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
    gap: 24,
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
    gap: 20,
  },
  notesCol: {
    flex: 1,
    minWidth: 0,
  },
});