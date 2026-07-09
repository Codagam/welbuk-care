import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { Button, TextField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { useEye, useSaveEye } from "../hooks";
import { emptyRefraction, type EyeRefraction, type EyeSide } from "../types";

const COLS: { key: keyof EyeSide; label: string }[] = [
  { key: "sph", label: "SPH" },
  { key: "cyl", label: "CYL" },
  { key: "axis", label: "AXIS" },
  { key: "add", label: "ADD" },
  { key: "va", label: "VA" },
];

export function EyeSection({
  consultationId,
  appointmentId,
}: {
  consultationId: string;
  appointmentId?: string;
}) {
  const q = useEye(consultationId);
  const save = useSaveEye(consultationId);
  const [rx, setRx] = useState<EyeRefraction>(emptyRefraction());
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const r = q.data?.refraction;
    if (r) {
      setRx({ od: r.od ?? {}, os: r.os ?? {}, pd: r.pd ?? "" });
    }
  }, [q.data]);

  const setSide = (side: "od" | "os", key: keyof EyeSide, v: string) => {
    setSaved(false);
    setRx((r) => ({ ...r, [side]: { ...r[side], [key]: v } }));
  };

  const onSave = async () => {
    setError(null);
    if (!appointmentId) {
      setError("This consultation has no linked appointment to attach the Rx to.");
      return;
    }
    try {
      await save.mutateAsync({ appointmentId, refraction: rx });
      setSaved(true);
    } catch (e) {
      setError(describeError(e));
    }
  };

  if (q.isLoading) {
    return (
      <View className="items-center py-10">
        <ActivityIndicator color="#FD006A" />
      </View>
    );
  }

  const SideRow = ({ side, label }: { side: "od" | "os"; label: string }) => (
    <View className="flex-row items-center gap-2">
      <View className="w-9">
        <Text className="text-sm font-bold text-neutral-700">{label}</Text>
      </View>
      {COLS.map((c) => (
        <TextField
          key={c.key}
          containerClassName="flex-1"
          value={rx[side][c.key] ?? ""}
          onChangeText={(v) => setSide(side, c.key, v)}
          placeholder="—"
          autoCapitalize="none"
        />
      ))}
    </View>
  );

  return (
    <View className="gap-4">
      <View className="gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <Text className="text-lg font-semibold text-neutral-900">
          Refraction / Final Rx
        </Text>

        <View className="flex-row gap-2">
          <View className="w-9" />
          {COLS.map((c) => (
            <Text
              key={c.key}
              className="flex-1 text-center text-xs font-medium text-neutral-500"
            >
              {c.label}
            </Text>
          ))}
        </View>

        <SideRow side="od" label="OD" />
        <SideRow side="os" label="OS" />

        <View className="flex-row items-center gap-2 pt-1">
          <TextField
            containerClassName="w-40"
            label="PD (mm)"
            value={rx.pd ?? ""}
            onChangeText={(v) => {
              setSaved(false);
              setRx((r) => ({ ...r, pd: v }));
            }}
            placeholder="62"
            keyboardType="numbers-and-punctuation"
          />
        </View>

        <Text className="text-xs text-neutral-400">
          OD = right eye · OS = left eye
        </Text>
      </View>

      {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
      {saved ? (
        <Text className="text-sm text-emerald-600">Refraction saved.</Text>
      ) : null}

      <Button
        label="Save refraction & Rx"
        onPress={onSave}
        loading={save.isPending}
      />
    </View>
  );
}
