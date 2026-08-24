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

const VITAL_ROWS: {
  key: keyof VitalsValues;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  valueClassName?: string;
}[] = [
  {
    key: "temperature",
    icon: "thermometer-outline",
    label: "Temperature",
  },
  {
    key: "bloodPressure",
    icon: "heart-outline",
    label: "Blood Pressure",
    valueClassName: "text-amber-600",
  },
  { key: "height", icon: "resize-outline", label: "Height" },
  { key: "weight", icon: "barbell-outline", label: "Weight" },
  { key: "spO2", icon: "cloudy-outline", label: "SpO₂" },
  { key: "bloodSugar", icon: "water-outline", label: "Sugar" },
];

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
  const empty = !value || value === "—";
  return (
    <View className="flex-row items-center gap-2 py-0.5">
      <Ionicons name={icon} size={15} color="#FD006A" />
      <Text
        className="min-w-0 flex-1 text-xs text-neutral-500"
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        className={`shrink-0 text-xs font-semibold ${
          empty ? "text-neutral-400" : valueClassName
        }`}
        numberOfLines={1}
      >
        {value || "—"}
      </Text>
    </View>
  );
}

function VitalsHeader({
  onEdit,
  compact,
  locked,
}: {
  onEdit: () => void;
  compact?: boolean;
  locked?: boolean;
}) {
  return (
    <View className="mb-1.5 flex-row items-center justify-between">
      <Text
        className={`font-semibold uppercase tracking-wider text-brand ${
          compact ? "text-[10px]" : "text-xs"
        }`}
        numberOfLines={1}
      >
        Patient Vitals
      </Text>
      {locked ? null : (
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          className="rounded-md p-1 active:bg-brand/10"
          accessibilityRole="button"
          accessibilityLabel="Edit vitals"
        >
          <Ionicons name="create-outline" size={14} color="#FD006A" />
        </Pressable>
      )}
    </View>
  );
}

export function VitalsCard({
  consultationId,
  vitals,
  onVitalsUpdate,
  embedded = false,
  locked = false,
}: {
  consultationId: string;
  vitals: VitalsValues;
  onVitalsUpdate?: () => void;
  /** Skip SectionChrome / nested box — parent provides the unified card. */
  embedded?: boolean;
  locked?: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);

  const hasAny =
    !!vitals.temperature ||
    !!vitals.height ||
    !!vitals.weight ||
    !!vitals.bloodPressure ||
    !!vitals.spO2 ||
    !!vitals.bloodSugar;

  const openEdit = () => {
    if (locked) return;
    setEditOpen(true);
  };

  const rows = (
    <View className="gap-1">
      {VITAL_ROWS.map((row) => {
        const raw = vitals[row.key];
        if (!embedded && !raw) return null;
        return (
          <VitalRow
            key={row.key}
            icon={row.icon}
            label={row.label}
            value={raw ?? "—"}
            valueClassName={row.valueClassName}
          />
        );
      })}
    </View>
  );

  const emptyAdd = (
    <Pressable
      onPress={openEdit}
      className="h-9 flex-row items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 px-2 active:border-brand active:bg-brand-50"
    >
      <Ionicons name="add" size={16} color="#FD006A" />
      <Text
        className="shrink text-xs font-medium text-brand"
        numberOfLines={1}
      >
        Add Vitals
      </Text>
    </Pressable>
  );

  const sheet = (
    <VitalsEditSheet
      open={editOpen}
      onClose={() => setEditOpen(false)}
      consultationId={consultationId}
      initialVitals={vitals}
      onSaved={onVitalsUpdate}
    />
  );

  if (embedded) {
    return (
      <>
        <View className="px-3.5 py-2.5">
          <VitalsHeader onEdit={openEdit} compact locked={locked} />
          {hasAny ? rows : locked ? rows : emptyAdd}
        </View>
        {sheet}
      </>
    );
  }

  if (!hasAny) {
    return (
      <>
        <SectionChrome title="Patient Vitals" emptyBorder className="flex-1">
          {locked ? rows : emptyAdd}
        </SectionChrome>
        {sheet}
      </>
    );
  }

  return (
    <>
      <SectionChrome
        title="Patient Vitals"
        className="flex-1"
        right={
          locked ? undefined : (
            <Pressable
              onPress={openEdit}
              hitSlop={8}
              className="rounded-md p-1.5 active:bg-white/60"
            >
              <Ionicons name="create-outline" size={14} color="#FD006A" />
            </Pressable>
          )
        }
      >
        <View className="gap-2 rounded-lg bg-white p-3">{rows}</View>
      </SectionChrome>
      {sheet}
    </>
  );
}
