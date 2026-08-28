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

import { describeError } from "@/lib/api/errors";
import { AppModal, Button, TextField } from "@/ui";
import { useSaveVitals } from "../hooks";
import {
  buildVitalsPayload,
  initialVitalsToForm,
  sanitizeBloodPressure,
  sanitizeBloodSugar,
  sanitizeDecimal,
  sanitizeInteger,
  sanitizeTemperature,
  validateVitalsForm,
  type VitalsFormState,
} from "../vitalsFormat";

type VitalsValues = {
  temperature?: string;
  height?: string;
  weight?: string;
  bloodPressure?: string;
  spO2?: string;
  bloodSugar?: string;
};

export function VitalsEditSheet({
  open,
  onClose,
  consultationId,
  initialVitals,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  consultationId: string;
  initialVitals: VitalsValues;
  onSaved?: () => void;
}) {
  const save = useSaveVitals(consultationId);
  const [form, setForm] = useState<VitalsFormState>(() =>
    initialVitalsToForm(initialVitals)
  );
  const [error, setError] = useState<string | null>(null);

  // iOS: numeric ("decimal-pad" / "number-pad") keyboards refuse to appear on the
  // first tap inside a `presentationStyle="pageSheet"` modal until a standard
  // keyboard has been shown once in that sheet. Prime it with a hidden input when
  // the sheet opens so the first real tap always brings the keypad up.
  const primerRef = useRef<TextInput>(null);
  const primeKeyboard = () => {
    if (Platform.OS !== "ios") return;
    primerRef.current?.focus();
    setTimeout(() => primerRef.current?.blur(), 350);
  };

  useEffect(() => {
    if (!open) return;
    setForm(initialVitalsToForm(initialVitals));
    setError(null);
    // Reset form only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open]);

  const set =
    (key: keyof VitalsFormState, sanitize: (v: string) => string) =>
    (v: string) =>
      setForm((f) => ({ ...f, [key]: sanitize(v) }));

  const onSave = async () => {
    setError(null);
    const validation = validateVitalsForm(form);
    if (validation) {
      setError(validation);
      return;
    }
    const payload = buildVitalsPayload(form);
    if (!Object.values(payload).some((v) => v)) {
      setError("Enter at least one vital before saving.");
      return;
    }
    try {
      await save.mutateAsync(payload);
      onSaved?.();
      onClose();
    } catch (e) {
      setError(describeError(e));
    }
  };

  return (
    <AppModal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={primeKeyboard}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 bg-white"
      >
        <TextInput
          ref={primerRef}
          keyboardType="decimal-pad"
          style={{ position: "absolute", height: 0, width: 0, opacity: 0 }}
          pointerEvents="none"
          caretHidden
        />
        <View className="flex-row items-center justify-between border-b border-neutral-200 px-4 py-3">
          <Text className="text-lg font-semibold text-neutral-900">
            Edit vitals
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: 16 }}
        >
          <View style={{ gap: 12 }}>
            <Text className="mb-1 text-sm text-neutral-500">
              Units are applied automatically (temp °F, height cm, weight kg).
            </Text>
            <TextField
              label="Temperature (°F)"
              value={form.temperature}
              onChangeText={set("temperature", sanitizeTemperature)}
              placeholder="98.6"
              keyboardType="decimal-pad"
              returnKeyType={(Platform.OS === 'ios') ? 'done' : 'next'}

            />
            <TextField
              label="Height (cm)"
              value={form.height}
              onChangeText={set("height", sanitizeDecimal)}
              placeholder="170"
              keyboardType="decimal-pad"
              returnKeyType={(Platform.OS === 'ios') ? 'done' : 'next'}
            />
            <TextField
              label="Weight (kg)"
              value={form.weight}
              onChangeText={set("weight", sanitizeDecimal)}
              placeholder="70"
              keyboardType="decimal-pad"
              returnKeyType={(Platform.OS === 'ios') ? 'done' : 'next'}
            />
            <TextField
              label="Blood pressure"
              value={form.bloodPressure}
              onChangeText={set("bloodPressure", sanitizeBloodPressure)}
              placeholder="120/80"
            />
            <TextField
              label="SpO₂ (%)"
              value={form.spO2}
              onChangeText={set("spO2", sanitizeInteger)}
              placeholder="98"
              keyboardType="number-pad"
              returnKeyType={(Platform.OS === 'ios') ? 'done' : 'next'}
            />
            <TextField
              label="Blood sugar (mg/dL)"
              value={form.bloodSugar}
              onChangeText={set("bloodSugar", sanitizeBloodSugar)}
              placeholder="110"
              keyboardType="number-pad"
            />
            {error ? (
              <Text className="text-sm text-red-500">{error}</Text>
            ) : null}

            <View className="mt-2 flex-row gap-3">
              <Button
                label="Cancel"
                variant="outline"
                className="flex-1"
                onPress={onClose}
                disabled={save.isPending}
              />
              <Button
                label="Save"
                className="flex-1"
                onPress={onSave}
                loading={save.isPending}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppModal>
  );
}
