import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { SectionChrome } from "./SectionChrome";
import { VitalsEditSheet } from "./VitalsEditSheet";

type VitalsValues = {
  temperature?: string;
  height?: string;
  weight?: string;
  bloodPressure?: string;
  spO2?: string;
  bloodSugar?: string;
};

function VitalRow({
  icon,
  label,
  value,
  valueClassName = "text-neutral-900",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <Ionicons name={icon} size={16} color="#9ca3af" />
      <Text className="text-sm text-neutral-500">{label}</Text>
      <Text
        className={`ml-auto text-sm font-semibold ${valueClassName}`}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

export function VitalsCard({
  consultationId,
  vitals,
  onVitalsUpdate,
}: {
  consultationId: string;
  vitals: VitalsValues;
  onVitalsUpdate?: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);

  const hasAny =
    !!vitals.temperature ||
    !!vitals.height ||
    !!vitals.weight ||
    !!vitals.bloodPressure ||
    !!vitals.spO2 ||
    !!vitals.bloodSugar;

  if (!hasAny) {
    return (
      <>
        <SectionChrome title="Patient Vitals" emptyBorder>
          <Pressable
            onPress={() => setEditOpen(true)}
            className="h-10 flex-row items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 active:border-brand active:bg-brand-50"
          >
            <Ionicons name="add" size={18} color="#FD006A" />
            <Text className="text-sm font-medium text-brand">Add Vitals</Text>
          </Pressable>
        </SectionChrome>
        <VitalsEditSheet
          open={editOpen}
          onClose={() => setEditOpen(false)}
          consultationId={consultationId}
          initialVitals={vitals}
          onSaved={onVitalsUpdate}
        />
      </>
    );
  }

  return (
    <>
      <SectionChrome
        title="Patient Vitals"
        right={
          <Pressable
            onPress={() => setEditOpen(true)}
            hitSlop={8}
            className="rounded-md p-1.5 active:bg-white/60"
          >
            <Ionicons name="create-outline" size={14} color="#6b7280" />
          </Pressable>
        }
      >
        <View className="gap-2.5 rounded-lg bg-white p-3">
          {vitals.temperature ? (
            <VitalRow
              icon="thermometer-outline"
              label="Temp:"
              value={vitals.temperature}
            />
          ) : null}
          {vitals.height ? (
            <VitalRow
              icon="resize-outline"
              label="Height:"
              value={vitals.height}
            />
          ) : null}
          {vitals.weight ? (
            <VitalRow
              icon="barbell-outline"
              label="Weight:"
              value={vitals.weight}
            />
          ) : null}
          {vitals.bloodPressure ? (
            <VitalRow
              icon="heart-outline"
              label="BP:"
              value={vitals.bloodPressure}
              valueClassName="text-amber-600"
            />
          ) : null}
          {vitals.spO2 ? (
            <VitalRow icon="cloudy-outline" label="SpO₂:" value={vitals.spO2} />
          ) : null}
          {vitals.bloodSugar ? (
            <VitalRow
              icon="water-outline"
              label="Sugar:"
              value={vitals.bloodSugar}
            />
          ) : null}
        </View>
      </SectionChrome>
      <VitalsEditSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        consultationId={consultationId}
        initialVitals={vitals}
        onSaved={onVitalsUpdate}
      />
    </>
  );
}
