import { useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/ui";

import {
  FOOD_LABEL,
  formatShortDate,
  isTextDose,
  lineMatchesRegimen,
  regimenStatus,
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

/** Below this the row no longer fits on one line, and folds as it does on the web. */
const ONE_LINE_MIN_WIDTH = 820;

const COL = { dose: 176, food: 108, duration: 136, regimen: 96, remove: 36 };

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
  regimenChoice: Record<string, boolean>;
  showErrors: boolean;
  saving: boolean;
  adding: number;
  notice: Notice | null;
  onChangeLine: (id: string, patch: Partial<PlanPrescription>) => void;
  onRemove: (id: string) => void;
  onRegimenChoice: (id: string, on: boolean) => void;
  onApplyDuration: (value: number, unit: DurationUnit) => void;
  onSave: () => void;
  onDiscard: () => void;
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
      className="h-11 flex-row gap-0.5 rounded-lg border border-neutral-300 bg-white p-0.5"
      style={{ width: COL.food }}
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
            <View style={{ flexGrow: 1, flexBasis: 120 }}>
              <Text className="text-sm font-semibold text-neutral-900">
                {p.dosePattern}
              </Text>
              {p.doseNote?.trim() ? (
                <Text className="text-xs text-neutral-500">{p.doseNote}</Text>
              ) : null}
            </View>
            <Text className="text-sm text-neutral-700" style={{ width: 96 }}>
              {FOOD_LABEL[p.foodTiming] ?? p.foodTiming}
            </Text>
            <Text className="text-sm text-neutral-700" style={{ width: 96 }}>
              {formatDuration(p)}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

/**
 * The prescription as an editable table. Every cell is a direct input, edits apply
 * immediately so nothing typed is lost, and one Save checks the changed rows and
 * applies their regimen checkboxes. "Next" on the keyboard moves to the same cell
 * on the next row, so a column can be filled top to bottom.
 */
export function PrescriptionGrid(props: GridProps) {
  const {
    prescriptions,
    regimenByDrug,
    readOnly,
    childAge,
    canSave,
    picker,
    defaultUnit,
    dirty,
    regimenChoice,
    showErrors,
    saving,
    adding,
    notice,
    onChangeLine,
    onRemove,
    onRegimenChoice,
    onApplyDuration,
    onSave,
    onDiscard,
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
              style={{ lineHeight: 44 }}
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
              className="h-11 justify-center py-0"
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
              <Text className="min-w-0 flex-1 text-xs font-semibold text-neutral-500">
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
                style={{ flex: 1.2 }}
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
            const status = regimenStatus(p, regimen, canSave);
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
            const checked = regimenChoice[p.id] ?? status === "new";

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
                  {status === "update" && regimen ? (
                    <Text className="text-[11px] text-amber-700">
                      edited for this patient
                    </Text>
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
              <TextInput
                ref={cellRef(`${row}:note`)}
                value={p.doseNote ?? ""}
                maxLength={500}
                placeholder="Note"
                placeholderTextColor="#9ca3af"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={focusNextRow(row, "note")}
                accessibilityLabel={`Note for ${p.name}`}
                onChangeText={(doseNote) => onChangeLine(p.id, { doseNote })}
                className="rounded-lg border border-neutral-300 bg-white px-2 text-sm text-neutral-900"
                style={{ height: 44, paddingVertical: 0 }}
              />
            );

            const regimenQty = (
              <View className="gap-1" style={{ width: COL.regimen }}>
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
                      style={{ width: 56, height: 36, paddingVertical: 0 }}
                    />
                  </View>
                ) : null}
                {errs.qty ? (
                  <Text className="text-[11px] text-red-500">{errs.qty}</Text>
                ) : null}
                {status === "new" || status === "update" ? (
                  <Pressable
                    onPress={() => onRegimenChoice(p.id, !checked)}
                    hitSlop={6}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    className="flex-row items-center gap-1.5"
                  >
                    <View
                      className={`h-5 w-5 items-center justify-center rounded border ${
                        checked
                          ? "border-brand bg-brand"
                          : "border-neutral-400 bg-white"
                      }`}
                    >
                      {checked ? (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      ) : null}
                    </View>
                    <Text className="min-w-0 flex-1 text-xs text-neutral-800">
                      {status === "new" ? "Save as regimen" : "Update regimen"}
                    </Text>
                  </Pressable>
                ) : null}
                {status === "matches" ? (
                  <Text className="text-xs text-neutral-500">
                    regimen v{regimen?.currentVersion}
                  </Text>
                ) : null}
              </View>
            );

            const remove = (
              <Pressable
                onPress={() => onRemove(p.id)}
                hitSlop={6}
                accessibilityLabel={`Remove ${p.name}`}
                className="h-11 items-center justify-center rounded-lg active:bg-neutral-100"
                style={{ width: COL.remove }}
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
                    <View className="min-w-0 flex-1 pt-1">{medicine}</View>
                    {dose}
                    {food}
                    {duration}
                    <View className="min-w-0" style={{ flex: 1.2 }}>
                      {note}
                    </View>
                    {regimenQty}
                    {remove}
                  </View>
                ) : (
                  <View className="gap-2">
                    <View className="flex-row items-start gap-2">
                      <View className="min-w-0 flex-1">{medicine}</View>
                      {remove}
                    </View>
                    <View className="flex-row flex-wrap items-start gap-2">
                      {dose}
                      {food}
                      {duration}
                    </View>
                    <View className="flex-row items-start gap-2">
                      <View className="min-w-0 flex-1">{note}</View>
                      {regimenQty}
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
