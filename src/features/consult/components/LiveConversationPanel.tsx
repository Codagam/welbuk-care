import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { AppAlert, AppModal, Button } from "@/ui";
import { describeError, isConsultCompletedLock } from "@/lib/api/errors";
import { createConsultation } from "@/lib/api/endpoints/consult";
import {
  deleteConversationMessage,
  generateConversationNotes,
  patchConversationMessage,
  saveSpeakadocResult,
  type ConversationHistoryItem,
} from "@/lib/api/endpoints/speakadoc";
import { consultOrdersQueryKey } from "../orders/hooks";
import { readExtraction, sendMedicinesToDraft } from "../ai/aiMedicines";
import { AiConsentSheet } from "../ai/AiConsentSheet";
import {
  useAiCaptureConsent,
  useConversationHistory,
  usePreviousConversation,
} from "../ai/hooks";
import {
  SpeakadocRecorderSheet,
  type SpeakadocResultMeta,
} from "../ai/SpeakadocRecorderSheet";
import { useConversation } from "../hooks";
import type { ConversationMessage } from "../types";

type Role = "doctor" | "patient";
type Language = "en" | "ta";
/** What is being regenerated, for the busy labels. */
type Busy = null | "summarise" | "promote" | "remove";

const ROLE_WORD: Record<Role, string> = { doctor: "Doctor", patient: "Patient" };

const roleOf = (m: ConversationMessage): Role =>
  m.speaker === "doctor" ? "doctor" : "patient";

/** Configured speaker name, else the role word. */
const speakerLabel = (m: ConversationMessage) =>
  m.speakerName?.trim() || ROLE_WORD[roleOf(m)];

/** English by default; falls back to `text` (typed messages have no variants). */
function displayText(m: ConversationMessage, language: Language): string {
  const variant = language === "en" ? m.textEn : m.textTa;
  return variant?.trim() || m.text;
}

// ---- Message bubble -------------------------------------------------------

function RoleBadge({ role, name }: { role: Role; name: string }) {
  const showName = name && name !== ROLE_WORD[role];
  return (
    <View className="mb-1 flex-row items-center gap-1.5">
      <View
        className={`flex-row items-center gap-1 rounded-full px-2 py-0.5 ${
          role === "doctor" ? "bg-brand-50" : "bg-emerald-100"
        }`}
      >
        <Ionicons
          name={role === "doctor" ? "medkit-outline" : "person-outline"}
          size={11}
          color={role === "doctor" ? "#FD006A" : "#065f46"}
        />
        <Text
          className={`text-[11px] font-semibold ${
            role === "doctor" ? "text-brand" : "text-emerald-800"
          }`}
        >
          {ROLE_WORD[role]}
        </Text>
      </View>
      {showName ? (
        <Text className="text-[11px] font-semibold text-neutral-500">{name}</Text>
      ) : null}
    </View>
  );
}

function MessageBubble({
  msg,
  language,
  showBadge,
  editable,
  onSaved,
}: {
  msg: ConversationMessage;
  language: Language;
  showBadge: boolean;
  /** Edit / delete allowed (current, unlocked consult; English view). */
  editable: boolean;
  onSaved?: () => Promise<unknown> | void;
}) {
  const role = roleOf(msg);
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");
  const [draftText, setDraftText] = useState("");
  const [draftRole, setDraftRole] = useState<Role>(role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setDraftText(displayText(msg, "en"));
    setDraftRole(role);
    setError(null);
    setMode("edit");
  };

  const save = async () => {
    const text = draftText.trim();
    if (!text) {
      setError("The message cannot be empty. Use delete to remove it.");
      return;
    }
    const patch: { messageId: string; text?: string; speaker?: Role } = {
      messageId: msg.id,
    };
    if (text !== displayText(msg, "en").trim()) patch.text = text;
    if (draftRole !== role) patch.speaker = draftRole;
    if (!patch.text && !patch.speaker) {
      setMode("view");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await patchConversationMessage(patch);
      await onSaved?.();
      setMode("view");
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteConversationMessage(msg.id);
      await onSaved?.();
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };

  const isDoctor = role === "doctor";
  return (
    <View className={`mt-1 flex-row ${isDoctor ? "justify-end" : "justify-start"}`}>
      <View
        className={`rounded-2xl border px-3 py-2 ${
          isDoctor ? "border-brand/20 bg-brand-50" : "border-emerald-200 bg-neutral-100"
        } ${mode === "edit" ? "w-[85%]" : "max-w-[85%]"}`}
      >
        {showBadge || mode === "edit" ? (
          <RoleBadge role={role} name={speakerLabel(msg)} />
        ) : null}

        {mode === "edit" ? (
          <View className="gap-2">
            <TextInput
              value={draftText}
              onChangeText={setDraftText}
              multiline
              editable={!busy}
              textAlignVertical="top"
              accessibilityLabel="Message text"
              className="min-h-[72px] rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
            />
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-[11px] text-neutral-500">Said by</Text>
              {(["doctor", "patient"] as const).map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setDraftRole(r)}
                  disabled={busy}
                  accessibilityState={{ selected: draftRole === r }}
                  className={`rounded-full border px-2.5 py-0.5 ${
                    draftRole === r ? "border-brand bg-brand" : "border-neutral-300 bg-white"
                  }`}
                >
                  <Text
                    className={`text-[11px] font-semibold ${
                      draftRole === r ? "text-white" : "text-neutral-500"
                    }`}
                  >
                    {ROLE_WORD[r]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View className="flex-row justify-end gap-2">
              <Button
                label="Cancel"
                variant="outline"
                onPress={() => setMode("view")}
                disabled={busy}
              />
              <Button
                label={busy ? "Saving…" : "Save"}
                onPress={() => void save()}
                disabled={busy}
              />
            </View>
          </View>
        ) : (
          <Text className="text-sm leading-snug text-neutral-900">
            {displayText(msg, language)}
          </Text>
        )}

        {mode === "confirm-delete" ? (
          <View className="mt-2 flex-row flex-wrap items-center justify-end gap-2">
            <Text className="text-xs text-neutral-500">Delete this message?</Text>
            <Button
              label="Cancel"
              variant="outline"
              onPress={() => setMode("view")}
              disabled={busy}
            />
            <Button
              label={busy ? "Deleting…" : "Delete"}
              variant="danger"
              onPress={() => void remove()}
              disabled={busy}
            />
          </View>
        ) : null}

        {error ? <Text className="mt-1 text-xs text-red-600">{error}</Text> : null}

        {mode !== "edit" ? (
          <View className="mt-1 flex-row items-center justify-end gap-1">
            {editable && mode === "view" ? (
              <>
                <Pressable
                  onPress={startEdit}
                  hitSlop={8}
                  accessibilityLabel="Edit message"
                  className="rounded p-1"
                >
                  <Ionicons name="pencil" size={13} color="#9ca3af" />
                </Pressable>
                <Pressable
                  onPress={() => {
                    setError(null);
                    setMode("confirm-delete");
                  }}
                  hitSlop={8}
                  accessibilityLabel="Delete message"
                  className="rounded p-1"
                >
                  <Ionicons name="trash-outline" size={13} color="#9ca3af" />
                </Pressable>
              </>
            ) : null}
            <Text className="text-[10px] text-neutral-400">{msg.timestamp}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Messages with a role badge on the first of each run by the same person. */
function MessageList({
  messages,
  language,
  editable,
  onSaved,
}: {
  messages: ConversationMessage[];
  language: Language;
  editable: boolean;
  onSaved?: () => Promise<unknown> | void;
}) {
  return (
    <>
      {messages.map((msg, i) => {
        const prev = messages[i - 1];
        const showBadge =
          !prev || roleOf(prev) !== roleOf(msg) || speakerLabel(prev) !== speakerLabel(msg);
        return (
          <MessageBubble
            key={msg.id}
            msg={msg}
            language={language}
            showBadge={showBadge}
            editable={editable}
            onSaved={onSaved}
          />
        );
      })}
    </>
  );
}

function historyTitle(item: ConversationHistoryItem): string {
  return `Previous Conversation ${item.number} – ${item.label}`;
}

function PromotedChip() {
  return (
    <View className="rounded-full bg-emerald-100 px-1.5 py-0.5">
      <Text className="text-[10px] font-semibold text-emerald-800">Promoted</Text>
    </View>
  );
}

/** One ticked earlier conversation, read-only. */
function PreviousBlock({
  item,
  language,
}: {
  item: ConversationHistoryItem;
  language: Language;
}) {
  const q = usePreviousConversation(item.consultationId, true);
  return (
    <View className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 pb-3">
      <View className="flex-row flex-wrap items-center gap-2 py-2">
        <Text className="text-xs font-semibold text-neutral-900">{historyTitle(item)}</Text>
        {item.promoted ? <PromotedChip /> : null}
        <Text className="text-xs text-neutral-500">read-only</Text>
      </View>
      {q.isLoading ? (
        <Text className="text-xs text-neutral-500">Loading…</Text>
      ) : q.isError ? (
        <Text className="text-xs text-red-600">Could not load this conversation.</Text>
      ) : (q.data ?? []).length === 0 ? (
        <Text className="text-xs text-neutral-500">No messages.</Text>
      ) : (
        <MessageList messages={q.data ?? []} language={language} editable={false} />
      )}
    </View>
  );
}

// ---- Panel ----------------------------------------------------------------

/**
 * Live Conversation, Practice parity (`components/consult/ai-insights/
 * live-conversation.tsx` + the SpeakADoc wiring in the consult page):
 *
 * - the mic opens the SpeakADoc recorder, after the AI capture consent ask
 *   when consent is not yet on file;
 * - Finalize saves the result (POST /api/speakadoc/result) and reloads the
 *   messages, the SOAP notes and the orders; medicines go into the
 *   prescription draft;
 * - messages can be edited (text, doctor ↔ patient) and deleted;
 * - EN / TA view; Summarise; Session History with Promote;
 * - Record Again starts a NEW consultation and records into it.
 *
 * Rendered only when the AI gate is open (see `useAiFeatureGate`).
 */
export function LiveConversationPanel({
  consultationId,
  patientId,
  facilityId,
  doctorId,
  locked = false,
  autoStartRecording = false,
  onAutoStartRecordingHandled,
}: {
  consultationId: string;
  patientId?: string;
  facilityId: string;
  /** For Record Again (a new consultation with the same doctor). */
  doctorId?: string | null;
  /** Completed consult: no recording, editing, Summarise or Promote. */
  locked?: boolean;
  /** Set when Record Again opened this consultation: record once consent answers. */
  autoStartRecording?: boolean;
  onAutoStartRecordingHandled?: () => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const q = useConversation(consultationId);
  const messages: ConversationMessage[] = q.data ?? [];

  const consentQ = useAiCaptureConsent(consultationId, true);
  const [consentOpen, setConsentOpen] = useState(false);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [language, setLanguage] = useState<Language>("en");
  const [busy, setBusy] = useState<Busy>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [summarised, setSummarised] = useState(false);
  const [recordingAgain, setRecordingAgain] = useState(false);

  // Session History: ticked = shown here; promoted = part of this consult's notes.
  const historyQ = useConversationHistory(consultationId, true);
  const history = historyQ.data ?? [];
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [removingId, setRemovingId] = useState<string | null>(null);
  const seededHistoryRef = useRef(false);
  useEffect(() => {
    if (seededHistoryRef.current || !historyQ.data) return;
    seededHistoryRef.current = true;
    setSelectedIds(
      new Set(historyQ.data.filter((h) => h.promoted).map((h) => h.consultationId))
    );
  }, [historyQ.data]);

  // A request still in flight when the panel unmounts is discarded.
  const activeRef = useRef(true);
  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  const selectedHistory = history
    .filter((h) => selectedIds.has(h.consultationId))
    .sort((a, b) => a.number - b.number);
  const promotedIds = history.filter((h) => h.promoted).map((h) => h.consultationId);
  const toPromote = selectedHistory.filter((h) => !h.promoted);
  const hasAnyMessages = messages.length > 0 || selectedHistory.length > 0;
  const canEdit = !locked && language === "en";
  const blockedReason = locked
    ? "This consultation is completed. Reopen it to change its notes."
    : recorderOpen
      ? "Finish the recording first"
      : null;

  const reloadMessages = useCallback(
    () => qc.invalidateQueries({ queryKey: ["conversation", consultationId] }),
    [qc, consultationId]
  );

  // ---- Recording --------------------------------------------------------

  const openRecorder = useCallback(() => {
    if (locked) {
      AppAlert.alert(
        "Consultation locked",
        "This consultation is completed and locked. Reopen it to record, or use Record Again for a new consultation."
      );
      return;
    }
    setRecorderOpen(true);
  }, [locked]);

  /** Consent sits between the mic and the recorder, and nowhere else. */
  const pressMic = useCallback(() => {
    if (recorderOpen) return;
    if (consentQ.data?.ready) openRecorder();
    else setConsentOpen(true);
  }, [recorderOpen, consentQ.data?.ready, openRecorder]);

  // Record Again: once THIS consultation's consent answer is in, behave as if
  // the mic were pressed. Consent is per patient + clinic, so it is usually ready.
  useEffect(() => {
    if (!autoStartRecording || !consentQ.data) return;
    onAutoStartRecordingHandled?.();
    // One-shot: reacts to the consent fetch answering, and the parent clears
    // `autoStartRecording` above, so this cannot cascade (same as Practice).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    pressMic();
  }, [autoStartRecording, consentQ.data, onAutoStartRecordingHandled, pressMic]);

  const handleResult = useCallback(
    async (data: unknown, { usageSessionId }: SpeakadocResultMeta) => {
      try {
        const res = await saveSpeakadocResult({
          consultationId,
          result: data,
          usageSessionId,
        });
        // Messages, SOAP/summary, orders (lab tests) and symptoms all changed.
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["conversation", consultationId] }),
          qc.invalidateQueries({ queryKey: ["summary", consultationId] }),
          qc.invalidateQueries({ queryKey: consultOrdersQueryKey(consultationId) }),
          qc.invalidateQueries({ queryKey: ["consultation", consultationId] }),
        ]);
        const extraction = readExtraction(data);
        const medicinesAdded =
          extraction?.status === "complete"
            ? await sendMedicinesToDraft(consultationId, extraction.medicines ?? [])
            : 0;
        const labsAdded = typeof res?.labsAdded === "number" ? res.labsAdded : 0;
        if (labsAdded || medicinesAdded) {
          const parts = [
            labsAdded ? `${labsAdded} lab test${labsAdded === 1 ? "" : "s"}` : "",
            medicinesAdded
              ? `${medicinesAdded} medicine${medicinesAdded === 1 ? "" : "s"}`
              : "",
          ].filter(Boolean);
          AppAlert.notice(
            `Added ${parts.join(" and ")} from the conversation`,
            "Please review them."
          );
        } else if (extraction?.status === "failed") {
          AppAlert.warn(
            "Orders not read",
            "Lab tests and medicines could not be read from the conversation. Add them manually."
          );
        }
      } catch (e) {
        if (isConsultCompletedLock(e)) {
          // Completed while recording (or on another device): expected, not a fault.
          AppAlert.alert(
            "Consultation locked",
            "This consultation is completed and locked. Reopen it to make changes."
          );
          void qc.invalidateQueries({ queryKey: ["consultation", consultationId] });
          return;
        }
        AppAlert.alert("Could not save the conversation", describeError(e));
      }
    },
    [consultationId, qc]
  );

  // ---- Notes: Summarise / Promote / remove --------------------------------

  const generateNotes = async (
    kind: Exclude<Busy, null>,
    promoted?: string[]
  ): Promise<boolean> => {
    if (busy) return false;
    setBusy(kind);
    setNotesError(null);
    try {
      const notes = await generateConversationNotes({
        consultationId,
        ...(promoted && { promotedConsultationIds: promoted }),
      });
      if (!activeRef.current) return false;
      const promotedSet = new Set(notes.promotedConsultationIds);
      qc.setQueryData<ConversationHistoryItem[]>(
        ["conversation-history", consultationId],
        (prev) =>
          prev?.map((h) => ({ ...h, promoted: promotedSet.has(h.consultationId) }))
      );
      setSummarised(true);
      // Saved server-side (summary, SOAP, Detected Symptoms): reload to show them.
      void qc.invalidateQueries({ queryKey: ["summary", consultationId] });
      void qc.invalidateQueries({ queryKey: ["consultation", consultationId] });
      return true;
    } catch (e) {
      if (activeRef.current) setNotesError(describeError(e));
      return false;
    } finally {
      if (activeRef.current) setBusy(null);
    }
  };

  const promote = async () => {
    if (!toPromote.length) return;
    const ok = await generateNotes("promote", [
      ...promotedIds,
      ...toPromote.map((h) => h.consultationId),
    ]);
    if (ok) setHistoryOpen(false);
  };

  const toggleSelected = (item: ConversationHistoryItem) => {
    setNotesError(null);
    if (item.promoted) {
      // Unticking a promoted one takes it out of the notes: regenerate without it.
      void (async () => {
        setRemovingId(item.consultationId);
        const ok = await generateNotes(
          "remove",
          promotedIds.filter((id) => id !== item.consultationId)
        ).finally(() => {
          if (activeRef.current) setRemovingId(null);
        });
        if (ok) {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(item.consultationId);
            return next;
          });
        }
      })();
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.consultationId)) next.delete(item.consultationId);
      else next.add(item.consultationId);
      return next;
    });
  };

  // ---- Record Again -----------------------------------------------------

  /**
   * A NEW consultation for the same patient and doctor, then a recording in
   * it. Nothing is written to this one. If the server ever hands back an
   * existing consultation (`reused`), it is opened WITHOUT recording, so a
   * recording can never replace another consultation's conversation.
   */
  const recordAgain = async () => {
    if (recordingAgain || recorderOpen) return;
    if (!patientId || !doctorId || !facilityId) {
      AppAlert.alert(
        "Could not start a new consultation",
        "Patient, doctor or facility is missing."
      );
      return;
    }
    setRecordingAgain(true);
    try {
      const res = await createConsultation({
        patientId,
        doctorId,
        facilityId,
        forceNew: true,
      });
      const newId = res?.consultation?.id;
      if (!newId || newId === consultationId) {
        throw new Error("Could not start a new consultation");
      }
      if (res.reused) {
        AppAlert.notice(
          "Opened the open consultation",
          "This patient already has an open consultation with this doctor. Recording was not started."
        );
      }
      router.replace({
        pathname: "/consult/[id]",
        params: {
          id: newId,
          patientId,
          ...(res.reused ? {} : { autoRecord: "1" }),
        },
      });
    } catch (e) {
      AppAlert.alert("Could not start a new consultation", describeError(e));
    } finally {
      if (activeRef.current) setRecordingAgain(false);
    }
  };

  // ---- Render -----------------------------------------------------------

  const canSummarise = messages.length > 0 || promotedIds.length > 0;

  const header = (
    <View className="flex-row items-center justify-between border-b border-neutral-200 bg-neutral-50 px-3 py-2">
      <View className="flex-row items-center gap-2">
        <Ionicons name="mic-outline" size={16} color="#6b7280" />
        <Text className="text-sm font-semibold text-neutral-900">Conversation</Text>
      </View>
      <View className="flex-row items-center gap-2">
        {recorderOpen ? (
          <View className="flex-row items-center gap-2 rounded-full bg-neutral-100 px-2 py-1">
            <View className="h-2 w-2 rounded-full bg-red-600" />
            <Text className="text-sm font-medium text-red-600">Recording</Text>
          </View>
        ) : null}
        <Pressable
          onPress={() => setHistoryOpen(true)}
          className="flex-row items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1"
          accessibilityLabel="Previous conversations"
        >
          <Ionicons name="time-outline" size={14} color="#374151" />
          <Text className="text-xs text-neutral-800">Select Session</Text>
        </Pressable>
        {hasAnyMessages ? (
          <View className="flex-row items-center rounded-full border border-neutral-300 p-0.5">
            {(["en", "ta"] as const).map((l) => (
              <Pressable
                key={l}
                onPress={() => setLanguage(l)}
                accessibilityState={{ selected: language === l }}
                className={`rounded-full px-2 py-0.5 ${language === l ? "bg-brand" : ""}`}
              >
                <Text
                  className={`text-[11px] font-medium ${
                    language === l ? "text-white" : "text-neutral-500"
                  }`}
                >
                  {l.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );

  const currentHeading =
    selectedHistory.length > 0 ? (
      <Text className="pt-1 text-xs font-semibold text-neutral-900">
        Current conversation
      </Text>
    ) : null;

  const previousBlocks = selectedHistory.map((h) => (
    <PreviousBlock key={h.consultationId} item={h} language={language} />
  ));

  const footer =
    hasAnyMessages || notesError ? (
      <View className="gap-3 border-t border-neutral-200 bg-neutral-50 p-3">
        {!recorderOpen && messages.length > 0 ? (
          <Button
            label={recordingAgain ? "Starting…" : "Record Again"}
            variant="outline"
            icon={<Ionicons name="mic" size={16} color="#111827" />}
            onPress={() => void recordAgain()}
            disabled={recordingAgain}
          />
        ) : null}
        {canSummarise ? (
          <Button
            label={
              busy === "summarise"
                ? "Summarising…"
                : promotedIds.length
                  ? "Summarise Again"
                  : "Summarise"
            }
            onPress={() => void generateNotes("summarise")}
            disabled={Boolean(busy) || Boolean(blockedReason)}
          />
        ) : null}
        {blockedReason && canSummarise ? (
          <Text className="text-xs text-neutral-500">{blockedReason}</Text>
        ) : null}
        {summarised && !notesError && !busy ? (
          <Text className="text-xs text-neutral-500">Summary saved to Clinical notes.</Text>
        ) : null}
        {notesError ? <Text className="text-xs text-red-600">{notesError}</Text> : null}
      </View>
    ) : null;

  return (
    <View className="min-h-[300px] overflow-hidden rounded-lg border border-neutral-200 bg-white">
      {header}

      {q.isLoading ? (
        <View className="items-center justify-center py-16">
          <ActivityIndicator color="#FD006A" />
        </View>
      ) : q.isError ? (
        <View className="items-center px-4 py-10">
          <Text className="text-center text-sm text-red-500">{describeError(q.error)}</Text>
        </View>
      ) : messages.length === 0 ? (
        <View>
          <View className="gap-3 p-3">
            {previousBlocks}
            {currentHeading}
            <View className="items-center justify-center gap-4 py-8">
              <Pressable
                onPress={pressMic}
                disabled={locked}
                className={`h-24 w-24 items-center justify-center rounded-full ${
                  locked ? "bg-neutral-300" : "bg-brand"
                }`}
                accessibilityLabel="Start consultation"
              >
                <Ionicons name="mic" size={44} color="#fff" />
              </Pressable>
              <Text className="max-w-xs text-center text-sm text-neutral-500">
                {locked
                  ? "This consultation is completed. Reopen it to record."
                  : "Tap the mic to record the consultation."}
              </Text>
            </View>
          </View>
          {footer}
        </View>
      ) : (
        <View>
          <ScrollView
            style={{ maxHeight: 420 }}
            nestedScrollEnabled
            contentContainerStyle={{ padding: 12, gap: 8 }}
          >
            {previousBlocks}
            {currentHeading}
            <MessageList
              messages={messages}
              language={language}
              editable={canEdit}
              onSaved={reloadMessages}
            />
            {!locked && language === "ta" ? (
              <Text className="pt-1 text-center text-[11px] text-neutral-500">
                Switch to EN to edit messages.
              </Text>
            ) : null}
          </ScrollView>
          {footer}
        </View>
      )}

      {/* Session History */}
      <AppModal
        visible={historyOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setHistoryOpen(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 px-4">
          <View className="w-full max-w-md overflow-hidden rounded-2xl bg-white">
            <View className="flex-row items-start justify-between border-b border-neutral-200 px-4 py-3">
              <View className="flex-1">
                <Text className="text-base font-semibold text-neutral-900">
                  Session History
                </Text>
                <Text className="text-xs text-neutral-500">
                  Tick earlier conversations to promote them into this
                  consultation&apos;s notes.
                </Text>
              </View>
              <Pressable onPress={() => setHistoryOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={20} color="#6b7280" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {historyQ.isLoading ? (
                <Text className="px-4 py-3 text-xs text-neutral-500">Loading…</Text>
              ) : historyQ.isError ? (
                <Text className="px-4 py-3 text-xs text-red-600">
                  {describeError(historyQ.error)}
                </Text>
              ) : history.length === 0 ? (
                <Text className="px-4 py-3 text-xs text-neutral-500">
                  No previous conversations recorded for this patient.
                </Text>
              ) : (
                history.map((h, i) => {
                  const checked = selectedIds.has(h.consultationId);
                  const disabled = Boolean(busy) || (h.promoted && Boolean(blockedReason));
                  return (
                    <Pressable
                      key={h.consultationId}
                      onPress={() => toggleSelected(h)}
                      disabled={disabled}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked, disabled }}
                      className={`flex-row items-start gap-2 px-4 py-2.5 ${
                        i % 2 === 0 ? "bg-white" : "bg-brand-50"
                      } ${disabled ? "opacity-60" : ""}`}
                    >
                      <Ionicons
                        name={checked ? "checkbox" : "square-outline"}
                        size={20}
                        color="#FD006A"
                      />
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-neutral-900">
                          {h.label}
                        </Text>
                        <Text className="text-[11px] text-neutral-500">
                          Previous Conversation {h.number} · {h.messageCount} message
                          {h.messageCount === 1 ? "" : "s"}
                          {h.doctorName ? ` · ${h.doctorName}` : ""}
                        </Text>
                      </View>
                      {removingId === h.consultationId ? (
                        <View className="flex-row items-center gap-1">
                          <ActivityIndicator size="small" color="#6b7280" />
                          <Text className="text-[10px] font-semibold text-neutral-500">
                            Removing…
                          </Text>
                        </View>
                      ) : h.promoted ? (
                        <PromotedChip />
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            {history.length > 0 ? (
              <View className="flex-row items-center justify-between gap-2 border-t border-neutral-200 px-4 py-2.5">
                <Text className="flex-1 text-[11px] text-neutral-500">
                  {busy === "remove"
                    ? "Removing…"
                    : [
                        promotedIds.length ? `${promotedIds.length} promoted` : "",
                        toPromote.length
                          ? `${toPromote.length} selected to promote`
                          : promotedIds.length
                            ? "untick to remove"
                            : "Tick a conversation to promote it",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </Text>
                <Button
                  label={
                    busy === "promote"
                      ? "Promoting…"
                      : `Promote${toPromote.length ? ` (${toPromote.length})` : ""}`
                  }
                  onPress={() => void promote()}
                  disabled={Boolean(busy) || !toPromote.length || Boolean(blockedReason)}
                />
              </View>
            ) : null}
            {notesError ? (
              <Text className="px-4 pb-3 text-xs text-red-600">{notesError}</Text>
            ) : null}
          </View>
        </View>
      </AppModal>

      <AiConsentSheet
        visible={consentOpen}
        onClose={() => setConsentOpen(false)}
        consultationId={consultationId}
        state={consentQ.data}
        onConsented={openRecorder}
      />

      <SpeakadocRecorderSheet
        visible={recorderOpen}
        onClose={() => setRecorderOpen(false)}
        facilityId={facilityId}
        consultationId={consultationId}
        patientId={patientId}
        onResult={(data, meta) => void handleResult(data, meta)}
      />
    </View>
  );
}
