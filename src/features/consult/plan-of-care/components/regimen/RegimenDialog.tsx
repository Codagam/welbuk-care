import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppModal, Button } from "@/ui";

import { describeSig, type LineDraft } from "../../lineDraft";
import {
  checkDosePattern,
  DOSE_SLOT_PICKS,
  normalizeDoseSlotInput,
  type DurationUnit,
} from "../../sig";
import { DurationInput } from "./DurationInput";

type Slots = [string, string, string];
const SLOT_LABELS = ["Morning", "Afternoon", "Night"] as const;

function splitGrid(pattern: string): Slots {
  const parts = pattern.split("-");
  return parts.length === 3 ? [parts[0]!, parts[1]!, parts[2]!] : ["", "", ""];
}

function joinGrid(slots: Slots): string {
  return slots.every((s) => s === "") ? "" : slots.map((s) => s || "0").join("-");
}

/**
 * The dialog's dose field (Practice dose-input.tsx): three labelled slots with the
 * quick picks always shown, or one text box for liquids and creams. A pick fills
 * the focused slot and moves on, so "1, 1, 0" is three taps.
 */
function DoseFields({
  value,
  onChange,
  textMode,
  onTextModeChange,
  error,
}: {
  value: string;
  onChange: (pattern: string) => void;
  textMode: boolean;
  onTextModeChange: (text: boolean) => void;
  error?: string;
}) {
  const [slots, setSlots] = useState<Slots>(() => splitGrid(value));
  const [seenValue, setSeenValue] = useState(value);
  const [focused, setFocused] = useState(0);
  const [slotError, setSlotError] = useState("");
  const refs = useRef<(TextInput | null)[]>([]);
  // Blur runs with an older render's values, so it reads this, not `slots`.
  const latest = useRef(slots);

  useEffect(() => {
    latest.current = slots;
  }, [slots]);

  // A value from outside (a new medicine in the queue) replaces the slots; our own
  // change already matches them and must not wipe a half-typed neighbour.
  if (value !== seenValue) {
    setSeenValue(value);
    if (joinGrid(slots) !== value) {
      setSlots(splitGrid(value));
      setSlotError("");
    }
  }

  const write = (next: Slots) => {
    latest.current = next;
    setSlots(next);
    const pattern = joinGrid(next);
    if (pattern !== value) onChange(pattern);
  };

  const commit = (i: number) => {
    const r = normalizeDoseSlotInput(latest.current[i] ?? "");
    const next = [...latest.current] as Slots;
    if (!r.ok) {
      setSlotError(r.error);
      next[i] = "";
    } else {
      setSlotError("");
      next[i] = r.value;
    }
    write(next);
  };

  const pick = (v: string) => {
    const i = focused;
    const next = [...latest.current] as Slots;
    next[i] = v;
    setSlotError("");
    write(next);
    const to = Math.min(i + 1, 2);
    setFocused(to);
    // After this render, so the blur it causes sees the pick and not the old value.
    setTimeout(() => refs.current[to]?.focus(), 0);
  };

  if (textMode) {
    return (
      <View className="gap-1.5">
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="e.g. 5 ml twice daily"
          placeholderTextColor="#9ca3af"
          autoFocus
          accessibilityLabel="Dose"
          className={`rounded-lg border bg-white px-3 text-base text-neutral-900 ${
            error ? "border-red-400" : "border-neutral-300"
          }`}
          style={{ height: 48, paddingVertical: 0 }}
        />
        <Pressable
          onPress={() => {
            onTextModeChange(false);
            onChange("");
          }}
          hitSlop={6}
          className="self-end"
        >
          <Text className="text-sm font-medium text-brand">
            Use morning · afternoon · night
          </Text>
        </Pressable>
        {error ? <Text className="text-xs text-red-500">{error}</Text> : null}
      </View>
    );
  }

  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        {SLOT_LABELS.map((label, i) => (
          <View key={label} className="min-w-0 flex-1 gap-1">
            <Text className="text-xs font-medium text-neutral-500">{label}</Text>
            <TextInput
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={slots[i]}
              placeholder="–"
              placeholderTextColor="#9ca3af"
              maxLength={6}
              selectTextOnFocus
              autoFocus={i === 0}
              keyboardType="numbers-and-punctuation"
              returnKeyType={i < 2 ? "next" : "done"}
              submitBehavior={i < 2 ? "submit" : "blurAndSubmit"}
              onSubmitEditing={() => {
                if (i < 2) refs.current[i + 1]?.focus();
              }}
              accessibilityLabel={`${label} dose`}
              onFocus={() => setFocused(i)}
              onChangeText={(t) => {
                const next = [...latest.current] as Slots;
                next[i] = t;
                latest.current = next;
                setSlots(next);
              }}
              onBlur={() => commit(i)}
              className={`rounded-lg border bg-white text-center text-base font-semibold text-neutral-900 ${
                focused === i
                  ? "border-brand"
                  : error && !slots.some(Boolean)
                    ? "border-red-400"
                    : "border-neutral-300"
              }`}
              style={{ height: 48, padding: 0 }}
            />
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap items-center gap-1.5">
        {DOSE_SLOT_PICKS.map((v) => (
          <Pressable
            key={v}
            onPress={() => pick(v)}
            accessibilityLabel={`${SLOT_LABELS[focused]} dose ${v}`}
            className="items-center justify-center rounded-md border border-neutral-300 bg-white active:bg-brand-50"
            style={{ minWidth: 40, height: 36, paddingHorizontal: 8 }}
          >
            <Text className="text-sm font-medium text-neutral-900">{v}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => {
            onTextModeChange(true);
            onChange("As Needed");
          }}
          hitSlop={6}
          className="ml-auto"
        >
          <Text className="text-sm font-medium text-brand">Write as text</Text>
        </Pressable>
      </View>

      {slotError ? <Text className="text-xs text-red-500">{slotError}</Text> : null}
      {error && !slotError ? (
        <Text className="text-xs text-red-500">{error}</Text>
      ) : null}
    </View>
  );
}

/**
 * Setting one line's dose (Practice regimen-dialog.tsx, `line` mode): opened for
 * every medicine added with no regimen, one after another, and by a row's Edit
 * button. One **Save** always fills THIS patient's line; the "Also save as my
 * regimen" box decides whether it ALSO becomes the doctor's regimen at this
 * facility (a new version, so every change keeps its history). Unticked = this
 * patient only, which keeps a child's or a kidney patient's dose out of the
 * default. The box starts ticked only when there is no regimen yet; changing an
 * existing one is always a deliberate tick. This is the ONLY place a regimen is
 * saved from a consult: the table has no second checkbox.
 */
export function RegimenDialog({
  drugName,
  step,
  initial,
  initialTextMode,
  currentRegimen,
  historyNotice,
  childAge,
  defaultUnit,
  canSaveRegimen,
  updateFutureDefault,
  regimenLockedReason,
  busy,
  onCancel,
  onSave,
}: {
  drugName: string;
  /** "Set regimen 2 of 3" when several medicines were picked at once. */
  step?: { index: number; total: number };
  initial: LineDraft;
  initialTextMode: boolean;
  currentRegimen: { label: string; version: number } | null;
  /** Shown only while the form still holds exactly those values. */
  historyNotice?: string | null;
  childAge?: number | null;
  defaultUnit: DurationUnit;
  /** False for anyone but the consult's doctor and for non-catalogue medicines. */
  canSaveRegimen: boolean;
  updateFutureDefault: boolean;
  /** Why the box is disabled; it still shows, so the option is never silently missing. */
  regimenLockedReason?: string | null;
  busy?: boolean;
  onCancel: () => void;
  onSave: (draft: LineDraft, updateFuture: boolean) => void;
}) {
  const [draft, setDraft] = useState<LineDraft>(initial);
  const [textMode, setTextMode] = useState(initialTextMode);
  const [errors, setErrors] = useState<{ dose?: string; duration?: string }>({});
  const [updateFuture, setUpdateFuture] = useState(updateFutureDefault);

  const untouched =
    draft.dosePattern.trim() === initial.dosePattern.trim() &&
    draft.foodTiming === initial.foodTiming &&
    draft.durationValue === initial.durationValue &&
    draft.durationUnit === initial.durationUnit &&
    draft.doseNote.trim() === initial.doseNote.trim();

  const submit = () => {
    const next: { dose?: string; duration?: string } = {};
    const doseError = checkDosePattern(drugName, draft.dosePattern);
    if (doseError) {
      next.dose = doseError.replace(/^Dose( pattern)? "[^"]*" for [^:]+:\s*/, "");
    }
    if (!draft.durationValue || !draft.durationUnit) {
      next.duration = "Type a number and pick days, weeks or months";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSave(
      { ...draft, doseNote: draft.doseNote.trim() },
      canSaveRegimen && updateFuture
    );
  };

  const title =
    step && step.total > 1
      ? `Set regimen ${step.index} of ${step.total} · ${drugName}`
      : drugName;
  const checked = canSaveRegimen && updateFuture;

  return (
    <AppModal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 items-center justify-center bg-black/40 px-4"
      >
        <View
          className="w-full overflow-hidden rounded-2xl bg-white"
          style={{ maxWidth: 520, maxHeight: "92%" }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 24, gap: 16 }}
          >
            {/* Header */}
            <View className="flex-row items-start gap-3">
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-lg font-semibold text-neutral-900">
                  {title}
                </Text>
                <Text className="text-sm text-neutral-500">
                  {currentRegimen
                    ? "Changes here apply to this patient. Tick the box to change your regimen as well."
                    : "No regimen for this medicine yet. Set the dose for this prescription."}
                </Text>
              </View>
              <Pressable
                onPress={onCancel}
                disabled={busy}
                hitSlop={8}
                accessibilityLabel="Close"
                className="p-1"
              >
                <Ionicons name="close" size={20} color="#6b7280" />
              </Pressable>
            </View>

            {childAge != null ? (
              <View
                accessibilityRole="alert"
                className="flex-row items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2"
              >
                <Ionicons name="warning-outline" size={16} color="#b91c1c" />
                <Text className="min-w-0 flex-1 text-sm text-red-800">
                  <Text className="font-semibold">
                    Check dose — child patient ({childAge} yr
                    {childAge === 1 ? "" : "s"}).
                  </Text>{" "}
                  A saved or previous dose may be an adult dose.
                </Text>
              </View>
            ) : null}

            {historyNotice && untouched ? (
              <View className="flex-row items-start gap-2 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2.5">
                <Ionicons name="time-outline" size={16} color="#0369a1" />
                <Text className="min-w-0 flex-1 text-sm text-sky-900">
                  {historyNotice}
                </Text>
              </View>
            ) : null}

            {/* Dose */}
            <View className="gap-1.5">
              <Text className="text-sm font-semibold text-neutral-900">Dose</Text>
              <DoseFields
                value={draft.dosePattern}
                onChange={(dosePattern) => {
                  setDraft((d) => ({ ...d, dosePattern }));
                  if (errors.dose) setErrors((e) => ({ ...e, dose: undefined }));
                }}
                textMode={textMode}
                onTextModeChange={setTextMode}
                error={errors.dose}
              />
            </View>

            {/* Food + duration */}
            <View className="flex-row flex-wrap gap-4">
              <View className="gap-1.5" style={{ flexGrow: 1, flexBasis: 200 }}>
                <Text className="text-sm font-semibold text-neutral-900">Food</Text>
                <View
                  accessibilityRole="radiogroup"
                  className="h-12 flex-row gap-1 rounded-lg border border-neutral-300 bg-white p-1"
                >
                  {(
                    [
                      ["BF", "Before food"],
                      ["AF", "After food"],
                    ] as const
                  ).map(([code, label]) => {
                    const active = draft.foodTiming === code;
                    return (
                      <Pressable
                        key={code}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        onPress={() => setDraft((d) => ({ ...d, foodTiming: code }))}
                        className={`flex-1 items-center justify-center rounded-md ${
                          active ? "bg-brand" : ""
                        }`}
                      >
                        <Text
                          className={`text-sm font-medium ${
                            active ? "text-white" : "text-neutral-600"
                          }`}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View className="gap-1.5" style={{ flexGrow: 1, flexBasis: 200 }}>
                <Text className="text-sm font-semibold text-neutral-900">
                  Duration
                </Text>
                <DurationInput
                  value={draft.durationValue}
                  unit={draft.durationUnit}
                  defaultUnit={defaultUnit}
                  error={errors.duration}
                  onChange={({ value, unit }) => {
                    setDraft((d) => ({ ...d, durationValue: value, durationUnit: unit }));
                    if (errors.duration) {
                      setErrors((e) => ({ ...e, duration: undefined }));
                    }
                  }}
                />
              </View>
            </View>

            {/* Note */}
            <View className="gap-1.5">
              <Text className="text-sm font-semibold text-neutral-900">
                Note{" "}
                <Text className="font-normal text-neutral-500">
                  (optional, printed)
                </Text>
              </Text>
              <TextInput
                value={draft.doseNote}
                maxLength={500}
                multiline
                placeholder="e.g. 1½ tab in the morning, crush in milk"
                placeholderTextColor="#9ca3af"
                onChangeText={(doseNote) => setDraft((d) => ({ ...d, doseNote }))}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                style={{ minHeight: 64, textAlignVertical: "top" }}
              />
            </View>

            <View className="gap-1">
              {currentRegimen ? (
                <Text className="text-xs text-neutral-500">
                  Your regimen:{" "}
                  <Text className="font-medium text-neutral-900">
                    {currentRegimen.label}
                  </Text>{" "}
                  (v{currentRegimen.version})
                </Text>
              ) : canSaveRegimen ? (
                <Text className="text-xs text-neutral-500">
                  You have no regimen for this medicine yet.
                </Text>
              ) : null}
              {draft.dosePattern ? (
                <Text className="text-xs text-neutral-500">
                  Will read:{" "}
                  <Text className="font-medium text-neutral-900">
                    {describeSig(draft)}
                  </Text>
                </Text>
              ) : null}
            </View>

            {/* Also save as / update my regimen */}
            <Pressable
              onPress={() => setUpdateFuture((v) => !v)}
              disabled={busy || !canSaveRegimen}
              accessibilityRole="checkbox"
              accessibilityState={{ checked, disabled: busy || !canSaveRegimen }}
              className={`flex-row items-start gap-2.5 rounded-lg border border-neutral-200 px-3 py-2.5 ${
                canSaveRegimen ? "" : "opacity-70"
              }`}
            >
              <View
                className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
                  checked ? "border-brand bg-brand" : "border-neutral-400 bg-white"
                }`}
              >
                {checked ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-medium text-neutral-900">
                  {currentRegimen ? "Also update my regimen" : "Also save as my regimen"}
                </Text>
                <Text className="text-xs text-neutral-500">
                  {!canSaveRegimen
                    ? regimenLockedReason ??
                      "Only the consult's doctor can change their regimen."
                    : currentRegimen
                      ? `Ticked: future prescriptions of ${drugName} start from this dose (v${currentRegimen.version} → v${currentRegimen.version + 1}). Unticked: this patient only. Prescriptions already issued never change.`
                      : `Ticked: next time you prescribe ${drugName} at this facility, this dose fills in by itself. Unticked: this patient only.`}
                </Text>
              </View>
            </Pressable>

            {/* Footer */}
            <View className="gap-1">
              <Button label="Save" loading={busy} disabled={busy} onPress={submit} />
              <Button
                label={step && step.total > 1 ? "Skip this medicine" : "Cancel"}
                variant="ghost"
                disabled={busy}
                onPress={onCancel}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </AppModal>
  );
}
