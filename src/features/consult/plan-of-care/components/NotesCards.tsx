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
        <Text className="text-base font-semibold tracking-tight text-brand">
          {title}
        </Text>
        {badge ? (
          <View className="rounded-md bg-brand-50 px-2 py-0.5">
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

export function DoctorNotesCard({
  consultationId,
  initialNotes,
  fill,
}: {
  consultationId: string;
  initialNotes?: string | null;
  /** Stretch to match sibling column height on tablet */
  fill?: boolean;
}) {
  const save = useSaveSummary(consultationId);
  const { highlighted, onFocus, onBlur } = useCardFocusHighlight();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [savedBaseline, setSavedBaseline] = useState(initialNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setNotes(initialNotes ?? "");
    setSavedBaseline(initialNotes ?? "");
  }, [initialNotes]);

  const dirty = notes !== savedBaseline;

  const onSave = async () => {
    setError(null);
    setDone(false);
    try {
      await save.mutateAsync({ doctorNotes: notes });
      setSavedBaseline(notes);
      setDone(true);
    } catch (e) {
      setError(describeError(e));
    }
  };

  const onCancel = () => {
    setNotes(savedBaseline);
    setError(null);
    setDone(false);
  };

  return (
    <NotesShell title="Doctor Notes" fill={fill} highlighted={highlighted}>
      <TextField
        value={notes}
        onChangeText={setNotes}
        placeholder="Clinical notes for this visit…"
        multiline
        numberOfLines={8}
        textAlignVertical="top"
        style={{ minHeight: fill ? 160 : 120 }}
        onFocus={onFocus}
        onBlur={onBlur}
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
            disabled={!dirty}
          />
        </View>
        <View className="flex-1">
          <Button
            label="Cancel"
            size="md"
            variant="primary"
            onPress={onCancel}
            disabled={!dirty || save.isPending}
          />
        </View>
      </View>
    </NotesShell>
  );
}

export function ConversationSummaryCard({
  consultationId,
  initialSummary,
  isAIGenerated,
  fill,
}: {
  consultationId: string;
  initialSummary?: string | null;
  isAIGenerated?: boolean;
  fill?: boolean;
}) {
  const save = useSaveSummary(consultationId);
  const { highlighted, onFocus, onBlur } = useCardFocusHighlight();
  const [summary, setSummary] = useState(initialSummary ?? "");
  const [savedBaseline, setSavedBaseline] = useState(initialSummary ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setSummary(initialSummary ?? "");
    setSavedBaseline(initialSummary ?? "");
  }, [initialSummary]);

  const dirty = summary !== savedBaseline;

  const onSave = async () => {
    setError(null);
    setDone(false);
    try {
      await save.mutateAsync({ summary });
      setSavedBaseline(summary);
      setDone(true);
    } catch (e) {
      setError(describeError(e));
    }
  };

  const onCancel = () => {
    setSummary(savedBaseline);
    setError(null);
    setDone(false);
  };

  return (
    <NotesShell
      title="Conversation Summary"
      badge={isAIGenerated ? "AI" : undefined}
      fill={fill}
      highlighted={highlighted}
    >
      <TextField
        value={summary}
        onChangeText={setSummary}
        placeholder="Visit conversation summary…"
        multiline
        numberOfLines={8}
        textAlignVertical="top"
        style={{ minHeight: fill ? 160 : 120 }}
        onFocus={onFocus}
        onBlur={onBlur}
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
            disabled={!dirty}
          />
        </View>
        <View className="flex-1">
          <Button
            label="Cancel"
            size="md"
            variant="primary"
            onPress={onCancel}
            disabled={!dirty || save.isPending}
          />
        </View>
      </View>
    </NotesShell>
  );
}
