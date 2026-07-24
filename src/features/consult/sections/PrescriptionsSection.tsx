import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Button, Segmented, TextField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { useDentalFlushOptional } from "@/features/dental/DentalConsultContext";
import {
  useAddPrescription,
  useDeletePrescription,
  useFinalizePrescription,
  usePrescriptions,
} from "../hooks";

const TIMING = ["BF", "AF"] as const;

export function PrescriptionsSection({
  consultationId,
  appointmentId,
  patientId,
}: {
  consultationId: string;
  appointmentId?: string;
  patientId?: string;
}) {
  const q = usePrescriptions(consultationId);
  const add = useAddPrescription(consultationId);
  const del = useDeletePrescription(consultationId);
  const finalize = useFinalizePrescription(consultationId);
  const flushDental = useDentalFlushOptional();

  const [name, setName] = useState("");
  const [dose, setDose] = useState("1-0-1");
  const [timing, setTiming] = useState<(typeof TIMING)[number]>("AF");
  const [duration, setDuration] = useState("5");
  const [qty, setQty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const lines = (q.data?.prescriptions ?? []).filter((l) => !l.isAttachment);

  const onAdd = async () => {
    setError(null);
    setDone(null);
    if (!name.trim()) {
      setError("Enter a medicine name.");
      return;
    }
    try {
      await add.mutateAsync({
        consultationId,
        appointmentId,
        name: name.trim(),
        dosePattern: dose.trim() || "1-0-1",
        foodTiming: timing,
        duration: duration.trim() || "1",
        qtyPrescribed: qty ? Number(qty) : undefined,
      });
      setName("");
      setQty("");
    } catch (e) {
      setError(describeError(e));
    }
  };

  const onFinalize = async () => {
    setError(null);
    setDone(null);
    const items = lines.map((l) => ({
      name: l.name,
      dosePattern: l.dosePattern ?? "1-0-1",
      foodTiming: l.foodTiming ?? "AF",
      duration: l.duration ?? "1",
      qtyPrescribed: l.qtyPrescribed ?? undefined,
    }));
    if (items.length === 0) {
      setError("Add at least one medicine before finalizing.");
      return;
    }
    try {
      if (flushDental) {
        const ok = await flushDental();
        if (!ok) {
          setError("Could not flush dental chart/plan before complete.");
          return;
        }
      }
      const res = await finalize.mutateAsync({
        consultationId,
        appointmentId,
        patientId,
        prescriptions: items,
      });
      setDone(
        res.consultationNumber
          ? `Finalized · ${res.consultationNumber}`
          : "Prescription finalized."
      );
    } catch (e) {
      setError(describeError(e));
    }
  };

  return (
    <View className="gap-4">
      <View className="gap-3 rounded-2xl border border-neutral-200 bg-white p-5">
        <Text className="text-lg font-semibold text-neutral-900">
          Prescription
        </Text>

        {lines.length === 0 ? (
          <Text className="text-sm text-neutral-400">No medicines added yet.</Text>
        ) : (
          <View className="gap-2">
            {lines.map((l) => (
              <View
                key={l.id}
                className="flex-row items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2"
              >
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-neutral-900">
                    {l.name}
                  </Text>
                  <Text className="text-xs text-neutral-500">
                    {[l.dosePattern, l.foodTiming, l.duration ? `${l.duration} days` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                <Pressable
                  onPress={() => del.mutate(l.id)}
                  className="h-8 w-8 items-center justify-center rounded-full active:bg-neutral-200"
                >
                  <Text className="text-red-500">✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>

      <View className="gap-3 rounded-2xl border border-neutral-200 bg-white p-5">
        <Text className="text-base font-semibold text-neutral-900">Add medicine</Text>
        <TextField
          label="Medicine"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Amoxicillin 500mg"
        />
        <View className="flex-row gap-3">
          <TextField
            containerClassName="flex-1"
            label="Dose (M-A-N)"
            value={dose}
            onChangeText={setDose}
            placeholder="1-0-1"
          />
          <TextField
            containerClassName="flex-1"
            label="Duration (days)"
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
            placeholder="5"
          />
        </View>
        <View className="flex-row items-end gap-3">
          <View className="flex-1 gap-1.5">
            <Text className="text-sm font-medium text-neutral-700">Food</Text>
            <Segmented options={TIMING} value={timing} onChange={setTiming} />
          </View>
          <TextField
            containerClassName="flex-1"
            label="Qty"
            value={qty}
            onChangeText={setQty}
            keyboardType="number-pad"
            placeholder="optional"
          />
        </View>
        <Button
          label="Add to prescription"
          variant="outline"
          onPress={onAdd}
          loading={add.isPending}
        />
      </View>

      {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
      {done ? <Text className="text-sm text-emerald-600">{done}</Text> : null}

      <Button
        label="Finalize & complete"
        onPress={onFinalize}
        loading={finalize.isPending}
      />
    </View>
  );
}
