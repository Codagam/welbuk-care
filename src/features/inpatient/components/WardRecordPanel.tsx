import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button, TextField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { useAddWardNote, useRecordWardVitals, useWardNotes, useWardVitals } from "../hooks";
import type {
  AuditEditor,
  InpatientVitals,
  NoteKind,
  WardVitalFieldKey,
} from "../types";
import { formatDateTime } from "../utils";

const VITAL_FIELDS: { key: WardVitalFieldKey; label: string; unit: string }[] = [
  { key: "bloodPressure", label: "BP", unit: "mmHg" },
  { key: "pulse", label: "Pulse", unit: "bpm" },
  { key: "temperature", label: "Temp", unit: "°C" },
  { key: "spO2", label: "SpO₂", unit: "%" },
  { key: "respiratoryRate", label: "Resp", unit: "/min" },
  { key: "bloodSugar", label: "Sugar", unit: "mg/dL" },
  { key: "painScore", label: "Pain", unit: "/10" },
];

const NOTE_KINDS: { value: NoteKind; label: string }[] = [
  { value: "PROGRESS", label: "Progress note" },
  { value: "INSTRUCTION", label: "Instruction" },
  { value: "HANDOVER", label: "Handover" },
];

function LastEdited({ editor }: { editor?: AuditEditor }) {
  if (!editor?.changedBy) return null;
  return (
    <Text className="text-[11px] text-neutral-500">
      Edited by {editor.changedBy} · {formatDateTime(String(editor.changedAt))}
    </Text>
  );
}

export function WardRecordPanel({
  admissionId,
  editors,
}: {
  admissionId: string;
  editors?: Record<string, AuditEditor>;
}) {
  const vitalsQ = useWardVitals(admissionId);
  const notesQ = useWardNotes(admissionId);
  const saveVitals = useRecordWardVitals(admissionId);
  const saveNote = useAddWardNote(admissionId);

  const [entering, setEntering] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [noteText, setNoteText] = useState("");
  const [noteKind, setNoteKind] = useState<NoteKind>("PROGRESS");
  const [showPrior, setShowPrior] = useState<Record<string, boolean>>({});

  const vitals = vitalsQ.data ?? [];
  const activeFields = useMemo(
    () =>
      VITAL_FIELDS.filter((f) =>
        vitals.some((v) => {
          const raw = v[f.key];
          return typeof raw === "string" && raw.trim().length > 0;
        })
      ),
    [vitals]
  );

  const saveRound = async () => {
    const payload: Record<string, string> = {};
    for (const [k, v] of Object.entries(draft)) {
      const t = v.trim();
      if (t) payload[k] = t;
    }
    if (Object.keys(payload).length === 0) {
      Alert.alert("Enter at least one reading.");
      return;
    }
    try {
      await saveVitals.mutateAsync(payload);
      setDraft({});
      setEntering(false);
    } catch (err) {
      Alert.alert("Could not save", describeError(err));
    }
  };

  const addNote = async () => {
    const body = noteText.trim();
    if (!body) return;
    try {
      await saveNote.mutateAsync({ body, kind: noteKind });
      setNoteText("");
    } catch (err) {
      Alert.alert("Could not save the note", describeError(err));
    }
  };

  return (
    <View className="gap-5">
      <View className="gap-2">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="min-w-0 flex-1 text-sm font-semibold text-neutral-900">
            Vitals
          </Text>
          {!entering ? (
            <Pressable
              onPress={() => setEntering(true)}
              style={{ flexShrink: 0 }}
              className="shrink-0 rounded-lg border border-neutral-200 px-3 py-1.5 active:bg-neutral-50"
            >
              <Text
                numberOfLines={1}
                className="text-xs font-semibold text-neutral-800"
              >
                Record a round
              </Text>
            </Pressable>
          ) : null}
        </View>
        <LastEdited editor={editors?.vitals} />

        {entering ? (
          <View className="gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <View className="flex-row flex-wrap gap-2">
              {VITAL_FIELDS.map((f) => (
                <View key={f.key} style={{ width: "48%" }} className="min-w-[140px] flex-1">
                  <TextField
                    label={`${f.label} (${f.unit})`}
                    value={draft[f.key] ?? ""}
                    onChangeText={(t) =>
                      setDraft((d) => ({ ...d, [f.key]: t }))
                    }
                  />
                </View>
              ))}
            </View>
            <TextField
              label="Notes (optional)"
              value={draft.notes ?? ""}
              onChangeText={(t) => setDraft((d) => ({ ...d, notes: t }))}
            />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button
                  label="Save"
                  size="md"
                  loading={saveVitals.isPending}
                  disabled={
                    saveVitals.isPending ||
                    !Object.values(draft).some((v) => v?.trim())
                  }
                  onPress={() => void saveRound()}
                />
              </View>
              <Button
                label="Cancel"
                variant="ghost"
                size="md"
                onPress={() => {
                  setEntering(false);
                  setDraft({});
                }}
              />
            </View>
          </View>
        ) : null}

        {vitalsQ.isLoading ? (
          <ActivityIndicator color="#FD006A" />
        ) : vitals.length === 0 ? (
          <View className="rounded-xl border border-dashed border-neutral-200 px-3 py-5">
            <Text className="text-center text-sm font-medium text-neutral-800">
              No observations yet
            </Text>
            <Text className="mt-1 text-center text-xs text-neutral-500">
              Rounds you record will build a chart here.
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="min-w-full overflow-hidden rounded-xl border border-neutral-200">
              <View className="flex-row bg-neutral-50">
                <ChartHead label="Taken" width={132} />
                {activeFields.map((f) => (
                  <ChartHead key={f.key} label={f.label} width={72} />
                ))}
                <ChartHead label="By" width={110} />
              </View>
              {vitals.map((v, i) => (
                <VitalRow
                  key={v.id}
                  vitals={v}
                  fields={activeFields}
                  striped={i % 2 === 1}
                />
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-neutral-900">Notes</Text>
        <LastEdited editor={editors?.notes} />
        <View className="gap-2 rounded-xl border border-neutral-200 p-3">
          <TextField
            value={noteText}
            onChangeText={setNoteText}
            multiline
            placeholder="Ward round, instruction, handover…"
            style={{ minHeight: 72, textAlignVertical: "top" }}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, alignItems: "center" }}
          >
            {NOTE_KINDS.map((k) => {
              const active = noteKind === k.value;
              return (
                <Pressable
                  key={k.value}
                  onPress={() => setNoteKind(k.value)}
                  className={`rounded-full px-3 py-2 ${
                    active ? "bg-brand" : "bg-neutral-100"
                  }`}
                >
                  <Text
                    numberOfLines={1}
                    className={`text-xs font-medium ${
                      active ? "text-white" : "text-neutral-600"
                    }`}
                  >
                    {k.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Button
            label="Add note"
            size="md"
            loading={saveNote.isPending}
            disabled={!noteText.trim() || saveNote.isPending}
            onPress={() => void addNote()}
          />
        </View>

        {notesQ.isLoading ? (
          <ActivityIndicator color="#FD006A" />
        ) : (notesQ.data ?? []).length === 0 ? (
          <View className="rounded-xl border border-dashed border-neutral-200 px-3 py-5">
            <Text className="text-center text-sm font-medium text-neutral-800">
              No notes yet
            </Text>
            <Text className="mt-1 text-center text-xs text-neutral-500">
              Each note is kept — a later one never replaces an earlier one.
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {(notesQ.data ?? []).map((n) => (
              <View
                key={n.id}
                className="rounded-xl border border-neutral-200 p-2.5"
              >
                <View className="flex-row flex-wrap items-center gap-2">
                  <View className="rounded-full bg-neutral-100 px-2 py-0.5">
                    <Text className="text-[10px] font-medium text-neutral-700">
                      {NOTE_KINDS.find((k) => k.value === n.kind)?.label ??
                        n.kind}
                    </Text>
                  </View>
                  <Text className="text-xs text-neutral-500">
                    {formatDateTime(n.notedAt)} · {n.author}
                    {n.editedAt
                      ? ` · corrected ${formatDateTime(n.editedAt)}`
                      : ""}
                  </Text>
                </View>
                <Text className="mt-1.5 text-sm text-neutral-900">{n.body}</Text>
                {n.supersededBody ? (
                  <Pressable
                    onPress={() =>
                      setShowPrior((s) => ({ ...s, [n.id]: !s[n.id] }))
                    }
                    className="mt-1.5"
                  >
                    <Text className="text-xs text-neutral-500">
                      {showPrior[n.id]
                        ? "Hide earlier text"
                        : "Show what it said before"}
                    </Text>
                    {showPrior[n.id] ? (
                      <Text className="mt-1 text-sm text-neutral-400 line-through">
                        {n.supersededBody}
                      </Text>
                    ) : null}
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function ChartHead({ label, width }: { label: string; width: number }) {
  return (
    <Text
      style={{ width }}
      className="px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500"
    >
      {label}
    </Text>
  );
}

function VitalRow({
  vitals,
  fields,
  striped,
}: {
  vitals: InpatientVitals;
  fields: typeof VITAL_FIELDS;
  striped: boolean;
}) {
  return (
    <View
      className={`flex-row border-t border-neutral-100 ${
        striped ? "bg-neutral-50/60" : "bg-white"
      }`}
    >
      <Text
        style={{ width: 132, fontVariant: ["tabular-nums"] }}
        className="px-2.5 py-2 text-xs text-neutral-800"
      >
        {formatDateTime(vitals.recordedAt)}
      </Text>
      {fields.map((f) => (
        <Text
          key={f.key}
          style={{ width: 72, fontVariant: ["tabular-nums"] }}
          className="px-2.5 py-2 text-xs text-neutral-900"
        >
          {(vitals[f.key] as string | null | undefined) || "—"}
        </Text>
      ))}
      <Text
        style={{ width: 110 }}
        className="px-2.5 py-2 text-xs text-neutral-500"
        numberOfLines={1}
      >
        {vitals.recordedBy ?? "—"}
      </Text>
    </View>
  );
}
