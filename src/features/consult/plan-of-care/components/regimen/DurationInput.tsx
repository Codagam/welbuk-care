import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { DURATION_UNITS, formatDuration, type DurationUnit } from "../../sig";

export type DurationValue = { value: number | null; unit: DurationUnit | null };

/**
 * Course length: type a number, pick days / weeks / months. Typing "3" offers
 * "3 days · 3 weeks · 3 months" under the box, starting on the unit used last, so
 * a run of three-month medicines is "3, Next" each. Leaving the box keeps the
 * highlighted unit, so a duration is never left without one.
 */
export function DurationInput({
  value,
  unit,
  defaultUnit = "DAYS",
  onChange,
  error,
  inputRef,
  onSubmitNext,
  accessibilityLabel = "Duration",
}: {
  value: number | null;
  unit: DurationUnit | null;
  defaultUnit?: DurationUnit;
  onChange: (next: DurationValue) => void;
  error?: string;
  inputRef?: (el: TextInput | null) => void;
  onSubmitNext?: () => void;
  accessibilityLabel?: string;
}) {
  const [text, setText] = useState(value != null ? String(value) : "");
  const [seenValue, setSeenValue] = useState(value);
  const [seenUnit, setSeenUnit] = useState(unit);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(() =>
    Math.max(0, DURATION_UNITS.indexOf(unit ?? defaultUnit))
  );

  // A value from outside (a regimen, "Apply to all", Discard) replaces the text.
  if (value !== seenValue) {
    setSeenValue(value);
    setText(value != null ? String(value) : "");
  }
  // The highlight must follow too. Leaving the box writes the highlighted unit, so
  // a stale one would turn "3 months" from "Apply to all" into "3 days" on a tap.
  if (unit !== seenUnit) {
    setSeenUnit(unit);
    if (unit) setHighlight(Math.max(0, DURATION_UNITS.indexOf(unit)));
  }

  const n =/^\d+$/.test(text.trim()) ? parseInt(text.trim(), 10) : null;
  const valid = n != null && n >= 1 && n <= 999;

  const choose = (i: number) => {
    if (!valid) return;
    onChange({ value: n, unit: DURATION_UNITS[i]! });
    setHighlight(i);
    setOpen(false);
  };

  const unitLabel =
    unit && value != null
      ? formatDuration({ durationValue: value, durationUnit: unit }).replace(
          /^\d+\s/,
          ""
        )
      : "days / weeks / months";

  return (
    <View className="gap-1">
      <View
        className={`h-11 flex-row items-center rounded-lg border bg-white ${
          error ? "border-red-400" : "border-neutral-300"
        }`}
      >
        <TextInput
          ref={inputRef}
          value={text}
          keyboardType="number-pad"
          returnKeyType="next"
          submitBehavior="submit"
          maxLength={3}
          placeholder="e.g. 5"
          placeholderTextColor="#9ca3af"
          selectTextOnFocus
          accessibilityLabel={accessibilityLabel}
          onChangeText={(raw) => {
            const t = raw.replace(/[^\d]/g, "").slice(0, 3);
            setText(t);
            setOpen(t.length > 0);
            if (!unit) {
              setHighlight(Math.max(0, DURATION_UNITS.indexOf(defaultUnit)));
            }
          }}
          onFocus={() => {
            if (text) setOpen(true);
          }}
          onSubmitEditing={() => {
            choose(highlight);
            onSubmitNext?.();
          }}
          onBlur={() => {
            if (valid && (n !== value || unit !== DURATION_UNITS[highlight])) {
              onChange({ value: n, unit: DURATION_UNITS[highlight]! });
            } else if (!text && (value != null || unit != null)) {
              onChange({ value: null, unit: null });
            }
            // Let a tap on an option land before the options go away.
            setTimeout(() => setOpen(false), 150);
          }}
          className="text-base font-semibold text-neutral-900"
          style={{ width: 52, height: 44, paddingHorizontal: 8, paddingVertical: 0 }}
        />
        <Pressable
          onPress={() => setOpen((o) => !o)}
          className="h-full min-w-0 flex-1 justify-center pr-2"
        >
          <Text numberOfLines={2} className="text-xs text-neutral-500">
            {unitLabel}
          </Text>
        </Pressable>
      </View>

      {open ? (
        <View className="rounded-lg border border-neutral-200 bg-white p-1">
          {DURATION_UNITS.map((u, i) => (
            <Pressable
              key={u}
              disabled={!valid}
              onPress={() => choose(i)}
              className={`rounded-md px-2 py-2 ${
                i === highlight ? "bg-brand-50" : ""
              } ${valid ? "" : "opacity-50"}`}
            >
              <Text
                className={`text-sm ${
                  i === highlight ? "text-brand" : "text-neutral-800"
                }`}
              >
                {valid
                  ? formatDuration({ durationValue: n, durationUnit: u })
                  : u.charAt(0) + u.slice(1).toLowerCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {error ? <Text className="text-xs text-red-500">{error}</Text> : null}
    </View>
  );
}
