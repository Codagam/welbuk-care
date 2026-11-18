import { useEffect, useState, type ReactNode } from "react";
import { Text, View } from "react-native";

import { useSaveSummary } from "@/features/consult/hooks";
import { useCardFocusHighlight } from "@/features/consult/useCardFocusHighlight";
import { describeError } from "@/lib/api/errors";
import { Button, TextField } from "@/ui";

function NotesShell({
  title,
  badge,
  fill,
  highlighted,
  children,
}: {
  title: string;
  badge?: string;
  fill?: boolean;
  highlighted?: boolean;
  children: ReactNode;
}) {
  return (
    <View
      style={fill ? { flex: 1 } : undefined}
      className={`w-full flex-col gap-3.5 rounded-2xl border bg-white p-5 ${
        highlighted ? "border-brand" : "border-neutral-200"
      }`}
    >
      <View className="flex-row items-center gap-2">
        <Text
          className="min-w-0 shrink text-base font-semibold tracking-tight text-brand"
          numberOfLines={1}
        >
          {title}
        </Text>
        {badge ? (
          <View className="shrink-0 rounded-md bg-brand-50 px-2 py-0.5">
            <Text className="text-[10px] font-semibold uppercase tracking-wide text-brand">
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * FINAL SUMMARY, as in Practice: the doctor-approved summary, saved to
 * ConsultationSummary.doctorNotes, so it prints as the prescription's Notes
 * and shows in Previous Consultation Notes on later visits.
 *
 * While nothing is saved it starts from the AI Conversation Summary. Complete
 * saves whatever this box shows (an unsaved edit or the AI prefill), through
 * `onDraftChange`, because a completed consult cannot take it afterwards.
 */
export function FinalSummaryCard({
  consultationId,
  savedNotes,
  aiSummary,
  fill,
  locked = false,
  onDraftChange,
}: {
  consultationId: string;
  /** The saved Final Summary (doctorNotes). */
  savedNotes?: string | null;
  /** The AI Conversation Summary, used as the starting text while nothing is saved. */
  aiSummary?: string | null;
  /** Stretch to match sibling column height on tablet */
  fill?: boolean;
  locked?: boolean;
  /** The box's current text, saved or not, for Complete to save. */
  onDraftChange?: (text: string) => void;
}) {
  const save = useSaveSummary(consultationId);
  const { highlighted, onFocus, onBlur } = useCardFocusHighlight();
  const saved = savedNotes ?? "";
  const fromAi = !saved.trim() && !!aiSummary?.trim();
  const initial = saved.trim() ? saved : (aiSummary ?? "");

  const [notes, setNotes] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // A new saved value, or a regenerated AI summary while nothing is saved:
  // reset during render (React's "adjusting state when a prop changes").
  const [seenInitial, setSeenInitial] = useState(initial);
  if (seenInitial !== initial) {
    setSeenInitial(initial);
    setNotes(initial);
    setBaseline(initial);
  }

  useEffect(() => {
    onDraftChange?.(notes);
  }, [notes, onDraftChange]);

  // The AI prefill is not saved yet, so Save is offered for it too.
  const dirty = notes !== saved;

  const onSave = async () => {
    setError(null);
    setDone(false);
    try {
      await save.mutateAsync({ doctorNotes: notes });
      setBaseline(notes);
      setDone(true);
    } catch (e) {
      setError(describeError(e));
    }
  };

  const onCancel = () => {
    setNotes(baseline);
    setError(null);
    setDone(false);
  };

  return (
    <NotesShell title="Final Summary" fill={fill} highlighted={highlighted}>
      {fromAi && !locked ? (
        <Text className="text-xs text-amber-700">
          From the AI summary, not saved yet. Edit if needed and Save to keep it.
        </Text>
      ) : null}
      <TextField
        value={notes}
        onChangeText={setNotes}
        placeholder="The summary that prints on the prescription…"
        multiline
        numberOfLines={8}
        textAlignVertical="top"
        style={{ minHeight: fill ? 160 : 120 }}
        onFocus={onFocus}
        onBlur={onBlur}
        editable={!locked}
      />
      {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
      {done ? <Text className="text-sm text-emerald-600">Saved.</Text> : null}
      <View className="mt-auto flex-row gap-2 pt-1">
        <View className="flex-1">
          <Button
            label="Save"
            size="md"
            onPress={onSave}
            loading={save.isPending}
            disabled={!dirty || !notes.trim() || locked}
          />
        </View>
        <View className="flex-1">
          <Button
            label="Cancel"
            size="md"
            variant="primary"
            onPress={onCancel}
            disabled={notes === baseline || save.isPending}
          />
        </View>
      </View>
    </NotesShell>
  );
}

/**
 * Conversation Summary, as in Practice: AI-generated from the conversation
 * (Summarise / Promote), shown and never edited here. The doctor's own
 * wording goes in Final Summary.
 */
export function ConversationSummaryCard({
  summary,
  isAIGenerated,
  fill,
}: {
  summary?: string | null;
  isAIGenerated?: boolean;
  fill?: boolean;
}) {
  const text = summary?.trim() ?? "";
  return (
    <NotesShell
      title="Conversation Summary"
      badge={isAIGenerated ? "AI" : undefined}
      fill={fill}
    >
      {text ? (
        <View
          className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3"
          style={{ minHeight: fill ? 160 : 120 }}
        >
          <Text selectable className="text-base leading-6 text-neutral-900">
            {text}
          </Text>
        </View>
      ) : (
        <Text className="text-sm italic text-neutral-400">
          No summary yet. Summarise the conversation in Patient details to
          generate one.
        </Text>
      )}
    </NotesShell>
  );
}
