import { useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppModal, Button } from "@/ui";

import {
  FOOD_LABEL,
  formatShortDate,
  isTextDose,
  lineMatchesRegimen,
  rowErrors,
  type RegimenView,
  type RowErrors,
} from "../../lineDraft";
import {
  formatDuration,
  normalizeDurationUnit,
  type DurationUnit,
} from "../../sig";
import type { PlanPrescription } from "../../types";
import { DoseCell } from "./DoseCell";
import { DurationInput } from "./DurationInput";


// Column widths match Practice prescription-grid.tsx COLS exactly
// (9.25rem / 6rem / 9rem / minmax(7rem,0.8fr) / 6.5rem / 2rem at 16px). The
// medicine and the note share the spare width 1.4 : 0.8, as there. `note` is
// the fixed width used where the row folds (portrait) and in the read-only view.
const COL = { dose: 148, food: 96, duration: 144, note: 160, noteMin: 112, regimen: 104, remove: 32 };
const FLEX = { medicine: 1.4, note: 0.8 };
const MEDICINE_MIN = 144;

/**
 * Every input box in a row is this tall: the dose slots, food, duration, note
 * and qty, in landscape and in portrait.
 */
// Heights are set in pixels, never with `h-9`: NativeWind's rem is 14px, so
// `h-9` is 31.5px while the dose slots (styled 36) stay 36, and the row's
// boxes came out at two different heights.
const BOX_HEIGHT = 36;
/** The Edit button alone is compact, as in Practice (h-7). */
const EDIT_HEIGHT = 28;

/**
 * Below this the row no longer fits on one line (landscape) and folds onto two
 * (portrait): the fixed columns, the gaps between them, the row padding and a
 * medicine name of at least 160. Derived, so a column change cannot leave the
 * medicine squeezed to nothing just above the break.
 */
const ONE_LINE_MIN_WIDTH =
  COL.dose + COL.food + COL.duration + COL.noteMin + COL.regimen + COL.remove +
  6 * 8 + 24 + 4 + MEDICINE_MIN;

export type Notice = { tone: "success" | "error"; text: string };

export type GridProps = {
  prescriptions: PlanPrescription[];
  regimenByDrug: Record<string, RegimenView>;
  readOnly?: boolean;
  childAge?: number | null;
  canSave: boolean;
  picker?: ReactNode;
  defaultUnit: DurationUnit;
  dirty: Set<string>;
  showErrors: boolean;
  saving: boolean;
  adding: number;
  notice: Notice | null;
  onChangeLine: (id: string, patch: Partial<PlanPrescription>) => void;
  onRemove: (id: string) => void;
  onApplyDuration: (value: number, unit: DurationUnit) => void;
  onSave: () => void;
  onDiscard: () => void;
  /** Opens the regimen dialog for one row. */
  onEditRegimen?: (id: string) => void;
};

function FoodCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: "AF" | "BF") => void;
}) {
  return (
    <View
      className="flex-row gap-0.5 rounded-lg border border-neutral-300 bg-white p-0.5"
      style={{ width: COL.food, height: BOX_HEIGHT }}
    >
      {(["BF", "AF"] as const).map((code) => {
        const active = value === code;
        return (
          <Pressable
            key={code}
            onPress={() => onChange(code)}
            accessibilityLabel={FOOD_LABEL[code]}
            accessibilityState={{ selected: active }}
            className={`flex-1 items-center justify-center rounded-md ${
              active ? "bg-brand" : ""
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                active ? "text-white" : "text-neutral-500"
              }`}
            >
              {code === "BF" ? "Before" : "After"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The line's note as a compact box: the first words plus an info icon. Tapping
 * opens a dialog with the whole note, editable while the consult is open and
 * read-only once it is completed (Practice prescription-grid.tsx NoteCell,
 * 2026-11-17). A full-width input showed only the start of a note that prints in
 * full, so the doctor could not read back what the patient would get.
 */
function NoteCell({
  medicineName,
  value,
  readOnly,
  onChange,
}: {
  medicineName: string;
  value: string;
  readOnly?: boolean;
  onChange?: (note: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const shown = value.trim();
  const openDialog = () => {
    setDraft(value);
    setOpen(true);
  };
  const commit = () => {
    onChange?.(draft.trim() ? draft : "");
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={openDialog}
        accessibilityRole="button"
        accessibilityLabel={`${readOnly ? "View" : shown ? "Edit" : "Add"} note for ${medicineName}`}
        className="flex-row items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-2 active:bg-neutral-50"
        style={{ height: BOX_HEIGHT }}
      >
        <Ionicons name="information-circle-outline" size={16} color="#FD006A" />
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          className={`min-w-0 flex-1 text-sm ${shown ? "text-neutral-900" : "text-neutral-400"}`}
        >
          {shown || (readOnly ? "—" : "Add note")}
        </Text>
      </Pressable>
      {open ? (
        <AppModal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setOpen(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1 items-center justify-center bg-black/40 px-4"
          >
            <View
              className="w-full gap-4 rounded-2xl bg-white p-6"
              style={{ maxWidth: 480 }}
            >
              <View className="flex-row items-start gap-3">
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="text-lg font-semibold text-neutral-900">
                    Note · {medicineName}
                  </Text>
                  <Text className="text-sm text-neutral-500">
                    {readOnly
                      ? "This consultation is completed. Reopen it to change the note."
                      : "Printed under the medicine on the prescription."}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setOpen(false)}
                  hitSlop={8}
                  accessibilityLabel="Close"
                  className="p-1"
                >
                  <Ionicons name="close" size={20} color="#6b7280" />
                </Pressable>
              </View>
              {readOnly ? (
                <Text className="min-h-16 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900">
                  {shown || "No note."}
                </Text>
              ) : (
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  maxLength={500}
                  multiline
                  autoFocus
                  placeholder="e.g. 1½ tab in the morning, crush in milk"
                  placeholderTextColor="#9ca3af"
                  accessibilityLabel={`Note for ${medicineName}`}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                  style={{ minHeight: 96, textAlignVertical: "top" }}
                />
              )}
              <View className="flex-row justify-end gap-2">
                {readOnly ? (
                  <Button label="Close" size="md" onPress={() => setOpen(false)} />
                ) : (
                  <>
                    <Button
                      label="Cancel"
                      variant="ghost"
                      size="md"
                      onPress={() => setOpen(false)}
                    />
                    <Button label="Save note" size="md" onPress={commit} />
                  </>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </AppModal>
      ) : null}
    </>
  );
}

function ReadOnlyTable({ prescriptions }: { prescriptions: PlanPrescription[] }) {
  return (
    <View className="overflow-hidden rounded-xl border border-neutral-200">
      {prescriptions.length === 0 ? (
        <Text className="px-4 py-8 text-center text-sm text-neutral-400">
          No medicines prescribed.
        </Text>
      ) : (
        prescriptions.map((p, i) => (
          <View
            key={p.id}
            className={`flex-row flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2.5 ${
              i < prescriptions.length - 1 ? "border-b border-neutral-100" : ""
            }`}
          >
            <Text
              className="text-sm font-medium text-neutral-900"
              style={{ flexGrow: 1.3, flexBasis: 180 }}
            >
              {p.name}
            </Text>
            <Text
              className="text-sm font-semibold text-neutral-900"
              style={{ flexGrow: 1, flexBasis: 120 }}
            >
              {p.dosePattern}
            </Text>
            <Text className="text-sm text-neutral-700" style={{ width: 96 }}>
              {FOOD_LABEL[p.foodTiming] ?? p.foodTiming}
            </Text>
            <Text className="text-sm text-neutral-700" style={{ width: 96 }}>
              {formatDuration(p)}
            </Text>
            <View style={{ width: COL.note }}>
              <NoteCell medicineName={p.name} value={p.doseNote ?? ""} readOnly />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

/**
 * The prescription as an editable table. Every cell is a direct input, edits apply
 * immediately so nothing typed is lost, and one Save checks the changed rows. A
 * regimen is saved only from the Edit dialog. "Next" on the keyboard moves to the
 * same cell on the next row, so a column can be filled top to bottom.
 */
export function PrescriptionGrid(props: GridProps) {
  const {
    prescriptions,
    regimenByDrug,
    readOnly,
    childAge,
    picker,
    defaultUnit,
    dirty,
    showErrors,
    saving,
    adding,
    notice,
    onChangeLine,
    onRemove,
    onApplyDuration,
    onSave,
    onDiscard,
    onEditRegimen,
  } = props;
  const [allValue, setAllValue] = useState<number | null>(null);
  const [allUnit, setAllUnit] = useState<DurationUnit | null>(null);
  /** Rows whose dose the doctor switched between grid and text by hand. */
  const [textOverride, setTextOverride] = useState<Record<string, boolean>>({});
  const [width, setWidth] = useState(0);
  const cells = useRef(new Map<string, TextInput>());

  const cellRef = (key: string) => (el: TextInput | null) => {
    if (el) cells.current.set(key, el);
    else cells.current.delete(key);
  };
  const focusNextRow = (row: number, col: string) => () => {
    cells.current.get(`${row + 1}:${col}`)?.focus();
  };

  if (readOnly) return <ReadOnlyTable prescriptions={prescriptions} />;

  const oneLine = width >= ONE_LINE_MIN_WIDTH;
  const errorCount = showErrors
    ? prescriptions.filter(
        (p) => dirty.has(p.id) && Object.keys(rowErrors(p)).length > 0
      ).length
    : 0;

  return (
    <View
      className="rounded-xl border border-neutral-200"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {/* Toolbar */}
      <View className="flex-row flex-wrap items-start gap-2 rounded-t-xl border-b border-neutral-200 bg-neutral-50 px-3 py-2">
        <View
          style={{ flexGrow: 1, flexBasis: 240, minWidth: 200, maxWidth: 440 }}
        >
          {picker}
        </View>
        {prescriptions.length > 1 ? (
          <View className="ml-auto flex-row flex-wrap items-start gap-2">
            <Text
              numberOfLines={1}
              className="text-xs font-medium text-neutral-500"
              style={{ lineHeight: 36 }}
            >
              Set duration for all
            </Text>
            <View style={{ width: COL.duration + 44 }}>
              <DurationInput
                value={allValue}
                unit={allUnit}
                defaultUnit={defaultUnit}
                accessibilityLabel="Duration for all medicines"
                onChange={({ value, unit }) => {
                  setAllValue(value);
                  setAllUnit(unit);
                }}
              />
            </View>
            <Button
              label="Apply to all"
              variant="outline"
              size="md"
              disabled={!allValue || !allUnit}
              onPress={() => {
                if (allValue && allUnit) onApplyDuration(allValue, allUnit);
              }}
              className="justify-center py-0"
              style={{ height: BOX_HEIGHT }}
            />
          </View>
        ) : null}
      </View>

      {childAge != null ? (
        <View className="flex-row items-center gap-2 border-b border-red-200 bg-red-50 px-3 py-2">
          <Ionicons name="warning-outline" size={16} color="#b91c1c" />
          <Text className="min-w-0 flex-1 text-sm text-red-800">
            <Text className="font-semibold">
              Child patient ({childAge} yr{childAge === 1 ? "" : "s"}).
            </Text>{" "}
            Check every dose: a saved or previous dose may be an adult dose.
          </Text>
        </View>
      ) : null}

      {adding > 0 ? (
        <View className="flex-row items-center gap-2 border-b border-neutral-200 px-3 py-2">
          <ActivityIndicator size="small" color="#FD006A" />
          <Text className="text-sm text-neutral-500">
            Adding {adding} medicine{adding === 1 ? "" : "s"}…
          </Text>
        </View>
      ) : null}

      {prescriptions.length === 0 ? (
        <Text className="px-4 py-8 text-center text-sm text-neutral-400">
          No medicines yet. Use “Add medicines…” above.
        </Text>
      ) : (
        <>
          {oneLine ? (
            <View className="flex-row gap-2 border-b border-neutral-200 bg-neutral-100 px-3 py-2">
              <Text
                className="min-w-0 text-xs font-semibold text-neutral-500"
                style={{ flex: FLEX.medicine }}
              >
                Medicine
              </Text>
              <Text
                className="text-xs font-semibold text-neutral-500"
                style={{ width: COL.dose }}
              >
                Dose · M · A · N
              </Text>
              <Text
                className="text-xs font-semibold text-neutral-500"
                style={{ width: COL.food }}
              >
                Food
              </Text>
              <Text
                className="text-xs font-semibold text-neutral-500"
                style={{ width: COL.duration }}
              >
                Duration
              </Text>
              <Text
                className="min-w-0 text-xs font-semibold text-neutral-500"
                style={{ flex: FLEX.note, minWidth: COL.noteMin }}
              >
                Note
              </Text>
              <Text
                className="text-xs font-semibold text-neutral-500"
                style={{ width: COL.regimen }}
              >
                Regimen / Qty
              </Text>
              <View style={{ width: COL.remove }} />
            </View>
          ) : null}

          {prescriptions.map((p, row) => {
            const regimen = p.drugId ? regimenByDrug[p.drugId] : undefined;
            const textMode =
              textOverride[p.id] ?? isTextDose(p.dosePattern, p.dosageForm);
            const isDirty = dirty.has(p.id);
            const errs: RowErrors = showErrors && isDirty ? rowErrors(p) : {};
            const unchecked =
              p.autoFilled ||
              Boolean(regimen && p.regimenId && lineMatchesRegimen(p, regimen));
            const childFlag = childAge != null && unchecked;
            const source =
              p.fillSource === "regimen"
                ? "your regimen"
                : p.fillSource === "history"
                  ? `last: ${p.historyDate ? formatShortDate(p.historyDate) : "previous"}`
                  : p.fillSource === "new"
                    ? "new"
                    : null;

            const medicine = (
              <View>
                <Text
                  numberOfLines={2}
                  className="text-sm font-medium text-neutral-900"
                >
                  {p.name}
                </Text>
                <View className="flex-row flex-wrap items-center gap-1.5">
                  {source ? (
                    <Text className="text-[11px] text-neutral-500">
                      {source}
                    </Text>
                  ) : null}
                  {childFlag ? (
                    <View className="flex-row items-center gap-0.5">
                      <Ionicons
                        name="warning-outline"
                        size={12}
                        color="#b91c1c"
                      />
                      <Text className="text-[11px] font-semibold text-red-700">
                        check dose
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );

            const dose = (
              <View style={{ width: COL.dose }}>
                <DoseCell
                  value={p.dosePattern}
                  textMode={textMode}
                  invalid={Boolean(errs.dose)}
                  firstInputRef={cellRef(`${row}:dose`)}
                  onSubmitNext={focusNextRow(row, "dose")}
                  onChange={(dosePattern) =>
                    onChangeLine(p.id, { dosePattern })
                  }
                  onToggleText={() => {
                    setTextOverride((m) => ({ ...m, [p.id]: !textMode }));
                    onChangeLine(p.id, {
                      dosePattern: textMode ? "" : "As Needed",
                    });
                  }}
                />
                {errs.dose ? (
                  <Text className="mt-0.5 text-[11px] text-red-500">
                    {errs.dose}
                  </Text>
                ) : null}
              </View>
            );

            const food = (
              <FoodCell
                value={String(p.foodTiming)}
                onChange={(foodTiming) => onChangeLine(p.id, { foodTiming })}
              />
            );

            const duration = (
              <View style={{ width: COL.duration }}>
                <DurationInput
                  value={
                    p.durationValue ??
                    (p.duration && !p.durationUnit
                      ? Number(p.duration) || null
                      : null)
                  }
                  unit={
                    normalizeDurationUnit(p.durationUnit) ??
                    (p.duration ? "DAYS" : null)
                  }
                  defaultUnit={defaultUnit}
                  error={errs.duration}
                  inputRef={cellRef(`${row}:duration`)}
                  onSubmitNext={focusNextRow(row, "duration")}
                  onChange={({ value, unit }) =>
                    onChangeLine(p.id, {
                      durationValue: value,
                      durationUnit: unit,
                    })
                  }
                />
              </View>
            );

            const note = (
              <NoteCell
                medicineName={p.name}
                value={p.doseNote ?? ""}
                onChange={(doseNote) => onChangeLine(p.id, { doseNote })}
              />
            );

            const regimenQty = (
              <View className="gap-1" style={{ width: COL.regimen, minHeight: BOX_HEIGHT, justifyContent: "center" }}>
                {textMode ? (
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-xs text-neutral-500">Qty</Text>
                    <TextInput
                      ref={cellRef(`${row}:qty`)}
                      value={
                        p.qtyPrescribed != null ? String(p.qtyPrescribed) : ""
                      }
                      keyboardType="number-pad"
                      returnKeyType="next"
                      submitBehavior="submit"
                      onSubmitEditing={focusNextRow(row, "qty")}
                      accessibilityLabel={`Quantity to dispense for ${p.name}`}
                      onChangeText={(t) => {
                        const n = parseInt(t.replace(/[^\d]/g, ""), 10);
                        onChangeLine(p.id, {
                          qtyPrescribed:
                            Number.isFinite(n) && n > 0
                              ? Math.min(n, 9999)
                              : null,
                        });
                      }}
                      className={`rounded-lg border bg-white px-2 text-sm text-neutral-900 ${
                        errs.qty ? "border-red-400" : "border-neutral-300"
                      }`}
                      style={{ width: 56, height: BOX_HEIGHT, paddingVertical: 0 }}
                    />
                  </View>
                ) : null}
                {errs.qty ? (
                  <Text className="text-[11px] text-red-500">{errs.qty}</Text>
                ) : null}
                {onEditRegimen ? (
                  <Pressable
                    onPress={() => onEditRegimen(p.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit dose for ${p.name}`}
                    className="flex-row items-center justify-center gap-1 self-start rounded-md border border-neutral-300 bg-white px-2 active:bg-neutral-50"
                    style={{ height: EDIT_HEIGHT }}
                  >
                    <Ionicons name="pencil" size={12} color="#374151" />
                    <Text className="text-xs font-medium text-neutral-800">
                      Edit
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );

            const remove = (
              <Pressable
                onPress={() => onRemove(p.id)}
                hitSlop={6}
                accessibilityLabel={`Remove ${p.name}`}
                className="items-center justify-center rounded-lg active:bg-neutral-100"
                style={{ width: COL.remove, height: BOX_HEIGHT }}
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </Pressable>
            );

            return (
              <View
                key={p.id}
                className={`border-b border-b-neutral-100 px-3 py-2.5 ${
                  childFlag
                    ? "border-l-4 border-l-red-500"
                    : isDirty
                      ? "border-l-4 border-l-brand"
                      : "border-l-4 border-l-transparent"
                }`}
              >
                {oneLine ? (
                  <View className="flex-row items-start gap-2">
                    <View
                      className="min-w-0"
                      style={{ flex: FLEX.medicine, minHeight: BOX_HEIGHT, justifyContent: "center" }}
                    >
                      {medicine}
                    </View>
                    {dose}
                    {food}
                    {duration}
                    <View style={{ flex: FLEX.note, minWidth: COL.noteMin }}>
                      {note}
                    </View>
                    {regimenQty}
                    {remove}
                  </View>
                ) : (
                  // Folded (portrait, e.g. iPad): the medicine on its own line,
                  // then the boxes wrapping as the width allows, with Delete at
                  // the end of the boxes' first line, level with them. It used
                  // to sit on the medicine line, above the boxes.
                  <View className="gap-2">
                    <View className="min-w-0">{medicine}</View>
                    <View className="flex-row items-start gap-2">
                      <View className="min-w-0 flex-1 flex-row flex-wrap items-start gap-2">
                        {dose}
                        {food}
                        {duration}
                        <View style={{ width: COL.note }}>{note}</View>
                        {regimenQty}
                      </View>
                      {remove}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </>
      )}

      {notice ? (
        <Text
          className={`border-t border-neutral-200 px-3 py-2 text-sm ${
            notice.tone === "error" ? "text-red-600" : "text-emerald-700"
          }`}
        >
          {notice.text}
        </Text>
      ) : null}

      {dirty.size > 0 || saving ? (
        <View className="flex-row flex-wrap items-center justify-between gap-2 rounded-b-xl border-t border-neutral-200 bg-neutral-50 px-3 py-2">
          <Text
            className={`text-sm ${
              errorCount ? "font-medium text-red-600" : "text-neutral-500"
            }`}
          >
            {errorCount
              ? `${errorCount} row${errorCount === 1 ? "" : "s"} need${errorCount === 1 ? "s" : ""} attention`
              : `${dirty.size} unsaved change${dirty.size === 1 ? "" : "s"}`}
          </Text>
          <View className="flex-row gap-2">
            <Button
              label="Discard"
              variant="ghost"
              size="md"
              disabled={saving}
              onPress={onDiscard}
            />
            <Button
              label="Save"
              size="md"
              loading={saving}
              disabled={saving}
              onPress={onSave}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
