import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { DOSE_SLOT_PICKS, normalizeDoseSlotInput } from "../../sig";

type Slots = [string, string, string];

const LABELS = ["Morning", "Afternoon", "Night"] as const;

function splitGrid(pattern: string): Slots {
  const parts = pattern.split("-");
  return parts.length === 3
    ? [parts[0]!, parts[1]!, parts[2]!]
    : ["", "", ""];
}

function joinGrid(slots: Slots): string {
  return slots.every((s) => s === "")
    ? ""
    : slots.map((s) => s || "0").join("-");
}

/** Three dose slots (whole numbers or ¼ ½ ¾), or one text field for liquids and creams. */
export function DoseCell({
  value,
  textMode,
  invalid,
  onChange,
  onToggleText,
  firstInputRef,
  onSubmitNext,
}: {
  value: string;
  textMode: boolean;
  invalid?: boolean;
  onChange: (pattern: string) => void;
  onToggleText: () => void;
  firstInputRef?: (el: TextInput | null) => void;
  onSubmitNext?: () => void;
}) {
  const [slots, setSlots] = useState<Slots>(() => splitGrid(value));
  const [seenValue, setSeenValue] = useState(value);
  const [focused, setFocused] = useState<number | null>(null);
  const [slotError, setSlotError] = useState("");
  const refs = useRef<(TextInput | null)[]>([]);
  // Blur runs with the values of an older render, so it reads this, not `slots`.
  const latest = useRef(slots);

  useEffect(() => {
    latest.current = slots;
  }, [slots]);

  // A value from outside (Discard, a template) replaces the slots. Our own change
  // already matches them, and must not wipe a half-typed neighbouring slot.
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
    // Tapping a box and leaving it changes nothing, so it must not report a change:
    // that would mark the row edited and clear a child's "check dose" flag.
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
    const i = focused ?? 0;
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
      <View className="flex-row items-center gap-1">
        <TextInput
          ref={firstInputRef}
          value={value}
          onChangeText={onChange}
          placeholder="e.g. 5 ml twice daily"
          placeholderTextColor="#9ca3af"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={onSubmitNext}
          accessibilityLabel="Dose as text"
          className={`min-w-0 flex-1 rounded-lg border bg-white px-2 text-sm text-neutral-900 ${
            invalid ? "border-red-400" : "border-neutral-300"
          }`}
          style={{ height: 44, paddingVertical: 0 }}
        />
        <Pressable
          onPress={onToggleText}
          hitSlop={6}
          accessibilityLabel="Use morning, afternoon, night dose"
          className="h-11 w-8 items-center justify-center rounded-lg active:bg-neutral-100"
        >
          <Ionicons name="grid-outline" size={16} color="#6b7280" />
        </Pressable>
      </View>
    );
  }

  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-1">
        {LABELS.map((label, i) => (
          <TextInput
            key={label}
            ref={(el) => {
              refs.current[i] = el;
              if (i === 0) firstInputRef?.(el);
            }}
            value={slots[i]}
            placeholder="–"
            placeholderTextColor="#9ca3af"
            maxLength={6}
            selectTextOnFocus
            keyboardType="numbers-and-punctuation"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={onSubmitNext}
            accessibilityLabel={`${label} dose`}
            onFocus={() => setFocused(i)}
            onChangeText={(t) => {
              const next = [...latest.current] as Slots;
              next[i] = t;
              latest.current = next;
              setSlots(next);
            }}
            onBlur={() => {
              commit(i);
              // Let a quick pick land before the row of picks goes away.
              setTimeout(() => setFocused((f) => (f === i ? null : f)), 150);
            }}
            className={`rounded-lg border bg-white text-center text-base font-semibold text-neutral-900 ${
              focused === i
                ? "border-brand"
                : invalid && !slots.some(Boolean)
                  ? "border-red-400"
                  : "border-neutral-300"
            }`}
            style={{ width: 44, height: 44, padding: 0 }}
          />
        ))}
        <Pressable
          onPress={onToggleText}
          hitSlop={6}
          accessibilityLabel="Write the dose as text"
          className="h-11 w-8 items-center justify-center rounded-lg active:bg-neutral-100"
        >
          <Ionicons name="text-outline" size={16} color="#6b7280" />
        </Pressable>
      </View>

      {focused != null ? (
        <View
          className="flex-row flex-wrap gap-1 rounded-lg border border-neutral-200 bg-white p-1"
          style={{ width: 176 }}
          accessibilityLabel="Quick dose picks"
        >
          {DOSE_SLOT_PICKS.map((v) => (
            <Pressable
              key={v}
              onPress={() => pick(v)}
              className="items-center justify-center rounded-md active:bg-brand-50"
              style={{ width: 40, height: 36 }}
            >
              <Text className="text-sm font-medium text-neutral-900">{v}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {slotError ? (
        <Text className="text-[11px] text-red-500">{slotError}</Text>
      ) : null}
    </View>
  );
}
