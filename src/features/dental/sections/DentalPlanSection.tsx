import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Button, Segmented, TextField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { useDental, useSaveDentalPlan } from "../hooks";
import { newPlanItemId } from "../teeth";
import type { TreatmentPlanItem } from "../types";

const STATUS = ["planned", "in-progress", "done"] as const;

export function DentalPlanSection({ consultationId }: { consultationId: string }) {
  const q = useDental(consultationId);
  const save = useSaveDentalPlan(consultationId);
  const [items, setItems] = useState<TreatmentPlanItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!q.data) return;
    if (q.data.treatmentPlanItems?.length) {
      setItems(q.data.treatmentPlanItems);
    } else {
      const seeded: TreatmentPlanItem[] = Object.entries(q.data.teethStates ?? {})
        .filter(([, s]) => s.suggestedTreatment?.trim())
        .map(([tooth, s], i) => ({
          id: newPlanItemId(i),
          treatmentName: s.suggestedTreatment!.trim(),
          status: "planned",
          totalFee: 0,
          findingSummary: { tooth },
        }));
      setItems(seeded);
    }
  }, [q.data]);

  const update = (id: string, patch: Partial<TreatmentPlanItem>) => {
    setResult(null);
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };
  const remove = (id: string) =>
    setItems((list) => list.filter((it) => it.id !== id));
  const add = () =>
    setItems((list) => [
      ...list,
      { id: newPlanItemId(list.length), treatmentName: "", status: "planned", totalFee: 0 },
    ]);

  const billable = items.filter(
    (i) => i.status === "done" || (i.status === "in-progress" && (i.totalFee ?? 0) > 0)
  );
  const total = billable.reduce((s, i) => s + (i.totalFee ?? 0), 0);

  const onSave = async () => {
    setError(null);
    setResult(null);
    const clean = items.filter((i) => i.treatmentName.trim());
    try {
      const res = await save.mutateAsync(clean);
      if (res.billingSync) {
        setResult(
          res.billingSync.ok
            ? `Saved. Billed ₹${res.billingSync.doneTotalRupees ?? 0}.`
            : `Saved. Billing note: ${res.billingSync.error ?? "sync deferred"}.`
        );
      } else {
        setResult("Treatment plan saved.");
      }
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

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-neutral-900">
          Treatment plan
        </Text>
        <Text className="text-sm font-semibold text-brand">₹{total}</Text>
      </View>

      {items.length === 0 ? (
        <Text className="text-sm text-neutral-400">
          No treatments yet. Add findings in the chart, or add a row below.
        </Text>
      ) : (
        items.map((it) => (
          <View
            key={it.id}
            className="gap-3 rounded-2xl border border-neutral-200 bg-white p-4"
          >
            <View className="flex-row items-center gap-2">
              <TextField
                containerClassName="flex-1"
                value={it.treatmentName}
                onChangeText={(v) => update(it.id, { treatmentName: v })}
                placeholder="Treatment"
              />
              <Pressable
                onPress={() => remove(it.id)}
                className="h-9 w-9 items-center justify-center rounded-full active:bg-neutral-100"
              >
                <Text className="text-red-500">✕</Text>
              </Pressable>
            </View>
            <View className="flex-row gap-3">
              <TextField
                containerClassName="flex-1"
                label="Tooth"
                value={it.findingSummary?.tooth ?? ""}
                onChangeText={(v) => update(it.id, { findingSummary: { tooth: v } })}
                placeholder="e.g. 16"
              />
              <TextField
                containerClassName="flex-1"
                label="Fee (₹)"
                value={it.totalFee ? String(it.totalFee) : ""}
                onChangeText={(v) =>
                  update(it.id, { totalFee: Number(v.replace(/[^0-9.]/g, "")) || 0 })
                }
                keyboardType="number-pad"
                placeholder="0"
              />
            </View>
            <Segmented
              options={STATUS}
              value={it.status}
              onChange={(s) => update(it.id, { status: s })}
            />
          </View>
        ))
      )}

      <Button label="+ Add treatment" variant="outline" onPress={add} />

      {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
      {result ? <Text className="text-sm text-emerald-600">{result}</Text> : null}

      <Button
        label="Save plan & bill"
        onPress={onSave}
        loading={save.isPending}
      />
      <Text className="text-center text-xs text-neutral-400">
        Only &quot;done&quot; (and in-progress with a fee) rows are billed.
      </Text>
    </View>
  );
}
