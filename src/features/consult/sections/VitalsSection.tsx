import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { Button, TextField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { useSaveVitals, useVitals } from "../hooks";
import type { Vitals } from "../types";

const FIELDS: { key: keyof Vitals; label: string; placeholder: string }[] = [
  { key: "height", label: "Height", placeholder: "175 cm" },
  { key: "weight", label: "Weight", placeholder: "72 kg" },
  { key: "bloodPressure", label: "Blood pressure", placeholder: "120/80" },
  { key: "spO2", label: "SpO₂", placeholder: "98%" },
  { key: "temperature", label: "Temperature", placeholder: "37.0 °C" },
  { key: "bloodSugar", label: "Blood sugar", placeholder: "110 mg/dL" },
];

export function VitalsSection({ consultationId }: { consultationId: string }) {
  const q = useVitals(consultationId);
  const save = useSaveVitals(consultationId);
  const [form, setForm] = useState<Partial<Vitals>>({});
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(false);

  useEffect(() => {
    if (q.data) setForm({ ...q.data });
  }, [q.data]);

  const set = (k: keyof Vitals, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSavedAt(false);
  };

  const onSave = async () => {
    setError(null);
    const payload: Partial<Vitals> = {};
    for (const f of FIELDS) {
      const v = (form[f.key] ?? "").toString().trim();
      if (v) payload[f.key] = v;
    }
    if (Object.keys(payload).length === 0) {
      setError("Enter at least one vital before saving.");
      return;
    }
    try {
      await save.mutateAsync(payload);
      setSavedAt(true);
    } catch (e) {
      setError(describeError(e));
    }
  };

  return (
    <View className="gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-neutral-900">Vitals</Text>
        {q.data?.recordedAt ? (
          <Text className="text-xs text-neutral-400">
            Last recorded {new Date(q.data.recordedAt).toLocaleString()}
          </Text>
        ) : null}
      </View>

      <View className="flex-row flex-wrap gap-3">
        {FIELDS.map((f) => (
          <TextField
            key={f.key}
            containerClassName="w-[47%] grow"
            label={f.label}
            value={(form[f.key] ?? "").toString()}
            onChangeText={(v) => set(f.key, v)}
            placeholder={f.placeholder}
          />
        ))}
      </View>

      {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
      {savedAt ? (
        <Text className="text-sm text-emerald-600">Vitals saved.</Text>
      ) : null}

      <Button label="Save vitals" onPress={onSave} loading={save.isPending} />
    </View>
  );
}
