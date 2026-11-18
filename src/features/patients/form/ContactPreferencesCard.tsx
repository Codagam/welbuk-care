import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  CONSENT_CHANNELS,
  CONSENT_PURPOSES,
  PATIENT_LANGUAGES,
  type ConsentSelection,
  consentKey,
} from "./catalog";
import { ChipSelect, FormCard, Tag } from "./kit";

type BoxState = "on" | "off" | "some";

/**
 * Contact preferences — a SEPARATE question from the registration consent.
 * That tick is permission to hold the record for care; this is permission to
 * be messaged, per purpose and channel.
 *
 * Mirrors Practice `components/patient/consent/contact-consent-grid.tsx`:
 *  - purposes implied by care sit in their own box, ticked and "Always on";
 *  - the optional purposes form a table, one column per channel plus **All**,
 *    which ticks or clears the whole row and shows a half-tick when only some
 *    channels are on;
 *  - unticking records `false` (a decision), never just forgets the box.
 */
export function ContactPreferencesCard({
  language,
  onLanguageChange,
  selection,
  onSelectionChange,
  disabled,
}: {
  language: string;
  onLanguageChange: (code: string) => void;
  selection: ConsentSelection;
  onSelectionChange: (next: ConsentSelection) => void;
  disabled?: boolean;
}) {
  const implied = CONSENT_PURPOSES.filter((p) => p.impliedByCare);
  const optional = CONSENT_PURPOSES.filter((p) => !p.impliedByCare);

  const toggle = (channel: string, purpose: string) => {
    const key = consentKey(channel, purpose);
    onSelectionChange({ ...selection, [key]: selection[key] !== true });
  };

  /** Tick or clear a whole row — the desk's common case is "all of it". */
  const setRow = (purpose: string, next: boolean) => {
    const patch: ConsentSelection = { ...selection };
    for (const c of CONSENT_CHANNELS) patch[consentKey(c.id, purpose)] = next;
    onSelectionChange(patch);
  };

  const rowState = (purpose: string): BoxState => {
    const on = CONSENT_CHANNELS.filter(
      (c) => selection[consentKey(c.id, purpose)] === true
    ).length;
    if (on === 0) return "off";
    return on === CONSENT_CHANNELS.length ? "on" : "some";
  };

  return (
    <FormCard
      title="Contact preferences"
      icon="chatbubbles-outline"
      description="What the patient agrees to receive, and where. Appointment and treatment messages are always sent; everything else is optional and can be withdrawn at any time."
    >
      <View className="gap-1">
        <ChipSelect
          label="Language"
          options={PATIENT_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
          value={language}
          onChange={(v) => v && onLanguageChange(v)}
          disabled={disabled}
        />
        <Text className="text-xs text-neutral-500">
          Messages use this language when an approved template exists in it, and
          English otherwise.
        </Text>
      </View>

      {implied.length > 0 ? (
        <View className="gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          {implied.map((p) => (
            <View key={p.id} className="flex-row items-start gap-2.5">
              <Box state="on" disabled />
              <View className="flex-1">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="text-sm font-medium text-neutral-800">
                    {p.label}
                  </Text>
                  <Tag label="Always on" />
                </View>
                <Text className="text-xs text-neutral-500">{p.description}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View className="overflow-hidden rounded-xl border border-neutral-200">
        <View className="flex-row items-center border-b border-neutral-200 bg-neutral-50 px-3 py-2">
          <Text className="flex-1 text-xs font-semibold text-neutral-500">
            The patient agrees to receive
          </Text>
          {CONSENT_CHANNELS.map((c) => (
            <Text
              key={c.id}
              className="w-20 text-center text-xs font-semibold text-neutral-500"
            >
              {c.label}
            </Text>
          ))}
          <Text className="w-16 text-center text-xs font-semibold text-neutral-500">
            All
          </Text>
        </View>

        {optional.map((p, i) => {
          const state = rowState(p.id);
          return (
            <View
              key={p.id}
              className={`flex-row items-center px-3 py-3 ${
                i > 0 ? "border-t border-neutral-100" : ""
              }`}
            >
              <View className="flex-1 pr-2">
                <Text className="text-sm font-medium text-neutral-800">{p.label}</Text>
                <Text className="text-xs text-neutral-500">{p.description}</Text>
              </View>
              {CONSENT_CHANNELS.map((c) => (
                <View key={c.id} className="w-20 items-center">
                  <Box
                    state={selection[consentKey(c.id, p.id)] === true ? "on" : "off"}
                    disabled={disabled}
                    label={`${p.label} on ${c.label}`}
                    onPress={() => toggle(c.id, p.id)}
                  />
                </View>
              ))}
              <View className="w-16 items-center">
                <Box
                  state={state}
                  disabled={disabled}
                  label={`${p.label} on every channel`}
                  onPress={() => setRow(p.id, state !== "on")}
                />
              </View>
            </View>
          );
        })}
      </View>
    </FormCard>
  );
}

/** Checkbox with Practice's three states: ticked, empty, half (some). */
function Box({
  state,
  disabled,
  label,
  onPress,
}: {
  state: BoxState;
  disabled?: boolean;
  label?: string;
  onPress?: () => void;
}) {
  const filled = state !== "off";
  return (
    <Pressable
      disabled={disabled || !onPress}
      accessibilityRole="checkbox"
      accessibilityState={{
        checked: state === "on" ? true : state === "some" ? "mixed" : false,
        disabled: disabled || !onPress,
      }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      className={`h-6 w-6 items-center justify-center rounded-md border ${
        filled ? "border-brand bg-brand" : "border-neutral-400 bg-neutral-100"
      } ${disabled && onPress ? "opacity-50" : ""} ${!onPress && filled ? "opacity-60" : ""}`}
    >
      {state === "on" ? (
        <Ionicons name="checkmark" size={16} color="#fff" />
      ) : state === "some" ? (
        <Ionicons name="remove" size={16} color="#fff" />
      ) : null}
    </Pressable>
  );
}
