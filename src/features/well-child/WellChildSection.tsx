import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { describeError } from "@/lib/api/errors";
import type { WellChildScreening } from "@/lib/api/endpoints/well-child";
import {
  ChoiceChips,
  ReasonDialog,
  formatShortDate,
  showToast,
} from "@/features/patients/components/kit";
import { ageInMonths, ageLabel } from "@/features/patients/vaccimon/GrowthChart";
import {
  RESULT_OPTIONS,
  SIDES,
  describeScreening,
  isAttentionResult,
  screeningTest,
  testsForAge,
  type ScreeningTest,
} from "@/features/patients/vaccimon/screening";
import { ageInDays } from "@/features/patients/vaccimon/who-growth";
import { AppAlert, Button, FieldLabel, TextField } from "@/ui";

import {
  useAddWellChildScreening,
  useRemoveWellChildScreening,
  useSaveWellChildMeasurement,
  useWellChild,
} from "./hooks";

/**
 * The well-child check on a consult, as in Practice
 * (components/consult/well-child/well-child-section.tsx): today's
 * measurements and hearing / vision / development screening, tagged with this
 * visit. It writes the same patient stores the patient page's Vaccines &
 * wellness card reads (growth chart, screening history), and reuses that
 * card's screening catalogue, chips, reason dialog and age helpers, so the
 * two cannot disagree.
 */

const GROUP_ICON: Record<ScreeningTest["group"], keyof typeof Ionicons.glyphMap> = {
  Hearing: "ear-outline",
  Vision: "eye-outline",
  Development: "leaf-outline",
};

const SIDE_LABELS: Record<(typeof SIDES)[number], string> = {
  LEFT: "Left",
  RIGHT: "Right",
  BOTH: "Both",
};

const POSITIONS = ["recumbent", "standing"] as const;
type Position = (typeof POSITIONS)[number];
const POSITION_LABELS: Record<Position, string> = {
  recumbent: "Lying (length)",
  standing: "Standing (height)",
};

function formatDayTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${formatShortDate(iso)}, ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;
}

function ResultBadge({ s }: { s: WellChildScreening }) {
  const attention = isAttentionResult(s.result);
  return (
    <View
      className={`rounded-full border px-2.5 py-0.5 ${
        attention ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"
      }`}
    >
      <Text className={`text-xs font-medium ${attention ? "text-amber-800" : "text-emerald-800"}`}>
        {describeScreening(s)}
      </Text>
    </View>
  );
}

type MeasurementDraft = {
  weightKg: string;
  heightCm: string;
  lengthPosition: Position;
  headCircumferenceCm: string;
  muacCm: string;
};

type ScreeningDraft = {
  testKey: string;
  side: (typeof SIDES)[number];
  result: string;
  value: string;
  notes: string;
};
const EMPTY_SCREENING: ScreeningDraft = { testKey: "", side: "BOTH", result: "", value: "", notes: "" };

export function WellChildSection({
  consultationId,
  locked = false,
  embedded = false,
}: {
  consultationId: string;
  locked?: boolean;
  /** Inside a ConsultSectionCard, which already carries the title. */
  embedded?: boolean;
}) {
  const { data, isLoading, error } = useWellChild(consultationId);
  const saveMeasurement = useSaveWellChildMeasurement(consultationId);
  const addScreening = useAddWellChildScreening(consultationId);
  const removeScreening = useRemoveWellChildScreening(consultationId);

  const dob = data?.patient.dob ?? null;
  const nowIso = new Date().toISOString();
  const days = dob ? Math.max(0, ageInDays(dob, nowIso)) : null;
  const months = ageInMonths(dob, nowIso);
  const ageText = months !== null ? ageLabel(months) : null;
  const showHead = days === null || days < 365 * 5;
  const showMuac = days === null || (days >= 180 && days < 365 * 5);

  // ── Measurements ──────────────────────────────────────────────────────────
  // null = untouched: the form shows what is saved.
  const [m, setM] = useState<MeasurementDraft | null>(null);
  const saved = data?.measurement;
  const draft: MeasurementDraft = m ?? {
    weightKg: saved?.weightKg?.toString() ?? "",
    heightCm: saved?.heightCm?.toString() ?? "",
    lengthPosition:
      saved?.lengthPosition === "recumbent" || saved?.lengthPosition === "standing"
        ? saved.lengthPosition
        : days !== null && days < 730
          ? "recumbent"
          : "standing",
    headCircumferenceCm: saved?.headCircumferenceCm?.toString() ?? "",
    muacCm: saved?.muacCm?.toString() ?? "",
  };
  const setDraft = (patch: Partial<MeasurementDraft>) => setM({ ...draft, ...patch });

  const onSaveMeasurement = async () => {
    try {
      await saveMeasurement.mutateAsync(draft);
      setM(null);
      showToast("Measurements saved to the growth chart");
    } catch (e) {
      AppAlert.alert("Could not save", describeError(e));
    }
  };

  // ── Screening ─────────────────────────────────────────────────────────────
  const [adding, setAdding] = useState(false);
  const [sForm, setSForm] = useState<ScreeningDraft>(EMPTY_SCREENING);
  const test = screeningTest(sForm.testKey);
  const { usual, other } = useMemo(() => testsForAge(days), [days]);
  const testLabels = useMemo(
    () => Object.fromEntries([...usual, ...other].map((t) => [t.key, t.label])),
    [usual, other]
  );

  const onAddScreening = async () => {
    if (!test) return;
    try {
      await addScreening.mutateAsync({
        testKey: sForm.testKey,
        side: test.perSide ? sForm.side : undefined,
        result: sForm.result,
        value: test.resultType === "acuity" ? sForm.value : undefined,
        notes: sForm.notes,
      });
      showToast(`${test.label} recorded`);
      setAdding(false);
      setSForm(EMPTY_SCREENING);
    } catch (e) {
      AppAlert.alert("Could not save", describeError(e));
    }
  };

  const [removing, setRemoving] = useState<WellChildScreening | null>(null);
  const onRemove = async (reason: string) => {
    if (!removing) return;
    try {
      await removeScreening.mutateAsync({ screeningId: removing.id, reason });
      setRemoving(null);
    } catch (e) {
      AppAlert.alert("Could not remove", describeError(e));
    }
  };

  if (isLoading) {
    return (
      <View className="items-center rounded-2xl border border-neutral-200 bg-white py-8">
        <ActivityIndicator color="#FD006A" />
      </View>
    );
  }
  if (error || !data) {
    return (
      <View className="rounded-2xl border border-neutral-200 bg-white p-5">
        <Text className="text-sm text-red-500">
          {error ? describeError(error) : "Could not load the well-child check."}
        </Text>
      </View>
    );
  }

  const pickTest = (key: string) => setSForm({ ...sForm, testKey: key, result: "", value: "" });

  return (
    <View className="gap-5 rounded-2xl border border-neutral-200 bg-white p-5">
      <View className="gap-1">
        {embedded ? (
          ageText ? (
            <Text className="text-sm font-medium text-neutral-700">Age {ageText}</Text>
          ) : null
        ) : (
          <View className="flex-row items-center gap-2">
            <Ionicons name="happy-outline" size={18} color="#FD006A" />
            <Text className="text-base font-semibold text-brand">Well-child check</Text>
            {ageText ? <Text className="text-sm text-neutral-500">· {ageText}</Text> : null}
          </View>
        )}
        <Text className="text-sm text-neutral-500">
          Measurements and screening are saved to the patient&apos;s record (the growth
          chart and screening history) and tagged with this visit.
        </Text>
      </View>

      {/* Measurements */}
      <View className="gap-3">
        <View className="flex-row items-baseline justify-between">
          <Text className="text-sm font-semibold text-neutral-900">Today&apos;s measurements</Text>
          {saved ? (
            <Text className="text-xs text-neutral-500">Saved {formatDayTime(saved.measuredOn)}</Text>
          ) : null}
        </View>
        <View className="flex-row flex-wrap gap-3">
          <View style={{ flexBasis: 160, flexGrow: 1 }}>
            <TextField
              label="Weight (kg)"
              keyboardType="decimal-pad"
              editable={!locked}
              value={draft.weightKg}
              onChangeText={(v) => setDraft({ weightKg: v })}
            />
          </View>
          <View style={{ flexBasis: 160, flexGrow: 1 }}>
            <TextField
              label={draft.lengthPosition === "recumbent" ? "Length (cm)" : "Height (cm)"}
              keyboardType="decimal-pad"
              editable={!locked}
              value={draft.heightCm}
              onChangeText={(v) => setDraft({ heightCm: v })}
            />
          </View>
          {showHead ? (
            <View style={{ flexBasis: 160, flexGrow: 1 }}>
              <TextField
                label="Head circumference (cm)"
                keyboardType="decimal-pad"
                editable={!locked}
                value={draft.headCircumferenceCm}
                onChangeText={(v) => setDraft({ headCircumferenceCm: v })}
              />
            </View>
          ) : null}
          {showMuac ? (
            <View style={{ flexBasis: 160, flexGrow: 1 }}>
              <TextField
                label="MUAC (cm)"
                keyboardType="decimal-pad"
                editable={!locked}
                value={draft.muacCm}
                onChangeText={(v) => setDraft({ muacCm: v })}
              />
            </View>
          ) : null}
        </View>
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <ChoiceChips
            options={POSITIONS}
            labels={POSITION_LABELS}
            value={draft.lengthPosition}
            onChange={(v) => setDraft({ lengthPosition: v })}
            disabled={locked}
          />
          {!locked ? (
            <Button
              label={saved ? "Update measurements" : "Save measurements"}
              size="md"
              onPress={() => void onSaveMeasurement()}
              loading={saveMeasurement.isPending}
              disabled={m === null}
            />
          ) : null}
        </View>
      </View>

      {/* Screening */}
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-neutral-900">Screening</Text>
          {!locked && !adding ? (
            <Button
              label="Add result"
              size="md"
              variant="outline"
              icon={<Ionicons name="add" size={16} color="#111827" />}
              onPress={() => setAdding(true)}
            />
          ) : null}
        </View>

        {adding ? (
          <View className="gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <FieldLabel label="Test" required />
            {usual.length > 0 ? (
              <View className="gap-2">
                {other.length > 0 ? (
                  <Text className="text-xs font-medium text-neutral-500">Usual at this age</Text>
                ) : null}
                <ChoiceChips
                  options={usual.map((t) => t.key)}
                  labels={testLabels}
                  value={sForm.testKey || null}
                  onChange={pickTest}
                />
              </View>
            ) : null}
            {other.length > 0 ? (
              <View className="gap-2">
                <Text className="text-xs font-medium text-neutral-500">Other</Text>
                <ChoiceChips
                  options={other.map((t) => t.key)}
                  labels={testLabels}
                  value={sForm.testKey || null}
                  onChange={pickTest}
                />
              </View>
            ) : null}

            {test ? (
              <>
                {test.hint ? <Text className="text-xs text-neutral-500">{test.hint}</Text> : null}
                {test.perSide ? (
                  <View className="gap-1.5">
                    <FieldLabel label="Side" />
                    <ChoiceChips
                      options={SIDES}
                      labels={SIDE_LABELS}
                      value={sForm.side}
                      onChange={(v) => setSForm({ ...sForm, side: v })}
                    />
                  </View>
                ) : null}
                <View className="gap-1.5">
                  <FieldLabel label="Result" required />
                  <ChoiceChips
                    options={RESULT_OPTIONS[test.resultType]}
                    value={sForm.result || null}
                    onChange={(v) => setSForm({ ...sForm, result: v })}
                  />
                </View>
                {test.resultType === "acuity" ? (
                  <TextField
                    label="Acuity"
                    required
                    placeholder="6/6"
                    value={sForm.value}
                    onChangeText={(v) => setSForm({ ...sForm, value: v })}
                    containerClassName="max-w-[160px]"
                  />
                ) : null}
                <TextField
                  label="Note (optional)"
                  value={sForm.notes}
                  onChangeText={(v) => setSForm({ ...sForm, notes: v })}
                />
              </>
            ) : null}

            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button
                  label="Cancel"
                  size="md"
                  variant="outline"
                  onPress={() => {
                    setAdding(false);
                    setSForm(EMPTY_SCREENING);
                  }}
                  disabled={addScreening.isPending}
                />
              </View>
              <View className="flex-1">
                <Button
                  label="Save result"
                  size="md"
                  onPress={() => void onAddScreening()}
                  loading={addScreening.isPending}
                  disabled={
                    !test ||
                    !sForm.result ||
                    (test.resultType === "acuity" && !sForm.value.trim())
                  }
                />
              </View>
            </View>
          </View>
        ) : null}

        {data.screenings.length === 0 && !adding ? (
          <Text className="text-sm text-neutral-500">No screening recorded in this visit.</Text>
        ) : (
          <View className="gap-2">
            {data.screenings.map((s) => {
              const t = screeningTest(s.testKey);
              return (
                <View
                  key={s.id}
                  className="flex-row items-center justify-between gap-2 rounded-xl border border-neutral-200 px-3 py-2.5"
                >
                  <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-2">
                    {t ? <Ionicons name={GROUP_ICON[t.group]} size={14} color="#FD006A" /> : null}
                    <Text className="text-sm font-medium text-neutral-900">{t?.label ?? s.testKey}</Text>
                    <ResultBadge s={s} />
                    {s.notes ? <Text className="text-xs text-neutral-500">{s.notes}</Text> : null}
                  </View>
                  {!locked ? (
                    <Pressable
                      onPress={() => setRemoving(s)}
                      hitSlop={8}
                      accessibilityLabel="Remove result"
                      className="h-8 w-8 items-center justify-center rounded-lg active:bg-neutral-100"
                    >
                      <Ionicons name="close" size={18} color="#6b7280" />
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {data.history.length > 0 ? <EarlierResults rows={data.history} /> : null}
      </View>

      <View className="flex-row items-start gap-2">
        <Ionicons name="medkit-outline" size={14} color="#6b7280" style={{ marginTop: 2 }} />
        <Text className="flex-1 text-xs text-neutral-500">
          Vaccines given or due, the full growth chart and every screening result are on
          the patient&apos;s Vaccines &amp; wellness card.
        </Text>
      </View>

      <ReasonDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Remove this result?"
        description="It is kept in the history with your name and reason. Add a corrected result afterwards if needed."
        confirmLabel="Remove"
        placeholder="e.g. Recorded for the wrong ear"
        pending={removeScreening.isPending}
        missingMessage="Say why this result is being removed."
        onConfirm={(reason) => void onRemove(reason)}
      />
    </View>
  );
}

function EarlierResults({ rows }: { rows: WellChildScreening[] }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="rounded-xl border border-neutral-200 px-3 py-2">
      <Pressable onPress={() => setOpen((o) => !o)} className="flex-row items-center justify-between py-1">
        <Text className="text-xs font-medium text-neutral-500">Earlier results ({rows.length})</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color="#6b7280" />
      </Pressable>
      {open ? (
        <View className="mt-2 gap-2">
          {rows.slice(0, 12).map((s) => (
            <View key={s.id} className="flex-row flex-wrap items-center gap-2">
              <Text className="w-24 text-xs text-neutral-500">{formatShortDate(s.testedOn)}</Text>
              <Text className="text-sm text-neutral-900">{screeningTest(s.testKey)?.label ?? s.testKey}</Text>
              <ResultBadge s={s} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
