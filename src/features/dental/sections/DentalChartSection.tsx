import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { Button, Segmented, TextField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { useDental, useSaveDentalExam } from "../hooks";
import { LOWER_TEETH, UPPER_TEETH } from "../teeth";
import type { TeethStates, ToothState } from "../types";

const PRIORITY = ["Low", "Med", "High"] as const;
const priorityToNum = (p: string) => (p === "High" ? 3 : p === "Med" ? 2 : 1);
const numToPriority = (n?: number) => (n === 3 ? "High" : n === 2 ? "Med" : "Low");

export function DentalChartSection({ consultationId }: { consultationId: string }) {
  const q = useDental(consultationId);
  const save = useSaveDentalExam(consultationId);
  const [teeth, setTeeth] = useState<TeethStates>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (q.data) setTeeth(q.data.teethStates ?? {});
  }, [q.data]);

  const cur = selected ? teeth[selected] : undefined;

  const update = (patch: Partial<ToothState>) => {
    if (!selected) return;
    setSaved(false);
    setTeeth((t) => {
      const prev: ToothState = t[selected] ?? { problem: "" };
      const next: ToothState = { ...prev, ...patch };
      if (!next.problem) next.problem = "";
      return { ...t, [selected]: next };
    });
  };

  const clearTooth = () => {
    if (!selected) return;
    setSaved(false);
    setTeeth((t) => {
      const n = { ...t };
      delete n[selected];
      return n;
    });
  };

  const onSave = async () => {
    setError(null);
    const clean: TeethStates = {};
    for (const [k, v] of Object.entries(teeth)) {
      if (
        v &&
        (v.problem?.trim() || v.suggestedTreatment?.trim() || v.note?.trim())
      ) {
        clean[k] = v;
      }
    }
    try {
      await save.mutateAsync({
        teethStates: clean,
        treatmentOrder: Object.keys(clean),
      });
      setTeeth(clean);
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

  const Tooth = ({ n }: { n: string }) => {
    const has = !!teeth[n];
    const sel = selected === n;
    return (
      <Pressable
        onPress={() => setSelected(n)}
        className={`m-0.5 h-11 w-9 items-center justify-center rounded-md border ${
          sel
            ? "border-brand bg-brand"
            : has
              ? "border-amber-300 bg-amber-100"
              : "border-neutral-200 bg-white"
        }`}
      >
        <Text
          className={`text-[11px] font-semibold ${
            sel ? "text-white" : has ? "text-amber-800" : "text-neutral-600"
          }`}
        >
          {n}
        </Text>
      </Pressable>
    );
  };

  return (
    <View className="gap-4">
      <View className="gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <Text className="text-lg font-semibold text-neutral-900">Tooth chart</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="gap-1">
            <View className="flex-row">
              {UPPER_TEETH.map((n) => (
                <Tooth key={n} n={n} />
              ))}
            </View>
            <View className="flex-row">
              {LOWER_TEETH.map((n) => (
                <Tooth key={n} n={n} />
              ))}
            </View>
          </View>
        </ScrollView>
        <Text className="text-xs text-neutral-400">
          Tap a tooth to record findings. Highlighted teeth have findings.
        </Text>
      </View>

      {selected ? (
        <View className="gap-3 rounded-2xl border border-brand-200 bg-white p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-neutral-900">
              Tooth {selected}
            </Text>
            <Pressable onPress={clearTooth}>
              <Text className="text-sm text-red-500">Clear</Text>
            </Pressable>
          </View>
          <TextField
            label="Problem / condition"
            value={cur?.problem ?? ""}
            onChangeText={(v) => update({ problem: v })}
            placeholder="e.g. Caries, fracture…"
          />
          <TextField
            label="Suggested treatment"
            value={cur?.suggestedTreatment ?? ""}
            onChangeText={(v) => update({ suggestedTreatment: v })}
            placeholder="e.g. Filling, RCT…"
          />
          <TextField
            label="Note"
            value={cur?.note ?? ""}
            onChangeText={(v) => update({ note: v })}
            placeholder="Clinical note"
            multiline
            style={{ minHeight: 56, textAlignVertical: "top" }}
          />
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-neutral-700">Priority</Text>
            <Segmented
              options={PRIORITY}
              value={numToPriority(cur?.priority)}
              onChange={(p) => update({ priority: priorityToNum(p) })}
            />
          </View>
        </View>
      ) : (
        <Text className="text-center text-sm text-neutral-400">
          Select a tooth above to begin.
        </Text>
      )}

      {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
      {saved ? (
        <Text className="text-sm text-emerald-600">Tooth chart saved.</Text>
      ) : null}

      <Button label="Save chart" onPress={onSave} loading={save.isPending} />
    </View>
  );
}
