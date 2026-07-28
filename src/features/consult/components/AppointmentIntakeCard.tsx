import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { describeError } from "@/lib/api/errors";
import type { PatientHeaderProps } from "../patientHeader";
import { SectionChrome } from "./SectionChrome";

function normalizeSymptoms(symptoms?: string[] | string | null): string[] {
  if (!symptoms) return [];
  if (Array.isArray(symptoms)) {
    return symptoms
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter(Boolean);
  }
  const t = symptoms.trim();
  return t ? [t] : [];
}

function isWalkInToken(value?: string | null): boolean {
  if (!value) return false;
  const n = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
  return n === "walkin" || n.includes("walkin");
}

/** Walk-in may arrive as appointmentType, reason, or a symptoms token. */
export function isWalkInAppointment({
  symptoms,
  reason,
  appointmentType,
}: {
  symptoms?: string[] | string | null;
  reason?: string | null;
  appointmentType?: string | null;
}): boolean {
  if (isWalkInToken(appointmentType)) return true;
  if (isWalkInToken(reason)) return true;
  return normalizeSymptoms(symptoms).some((s) => isWalkInToken(s));
}

function DetailRow({
  icon,
  label,
  children,
  iconColor = "#FD006A",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  children: ReactNode;
  iconColor?: string;
}) {
  return (
    <View className="flex-row items-start gap-2 py-0.5">
      <Ionicons
        name={icon}
        size={15}
        color={iconColor}
        style={{ marginTop: 1 }}
      />
      <Text className="w-[88px] shrink-0 text-xs text-neutral-500">{label}</Text>
      <View className="min-w-0 flex-1">{children}</View>
    </View>
  );
}

function PatientDetailsBlock({
  header,
  loading,
  error,
}: {
  header?: PatientHeaderProps | null;
  loading?: boolean;
  error?: unknown;
}) {
  if (loading) {
    return (
      <View className="items-center py-2">
        <ActivityIndicator color="#FD006A" size="small" />
        <Text className="mt-1 text-[10px] text-neutral-500">Loading…</Text>
      </View>
    );
  }

  if (error && !header) {
    return (
      <Text className="text-xs text-red-600">
        {describeError(error) || "Could not load patient details."}
      </Text>
    );
  }

  if (!header) {
    return (
      <Text className="text-xs text-neutral-400">
        Patient details unavailable.
      </Text>
    );
  }

  const { name, patientId, phone, dobFormatted, age } = header;
  const nameWithId =
    patientId != null ? `${name} (${patientId})` : name;
  const ageLabel = age > 0 ? `${age} yrs` : "—";

  return (
    <View className="gap-1">
      <DetailRow icon="person-outline" label="Name">
        <Text
          className="text-xs font-semibold text-neutral-900"
          numberOfLines={1}
        >
          {nameWithId}
        </Text>
      </DetailRow>
      <DetailRow icon="calendar-outline" label="Age">
        <Text
          className={`text-xs font-semibold ${
            age > 0 ? "text-neutral-900" : "font-normal text-neutral-400"
          }`}
        >
          {ageLabel}
        </Text>
      </DetailRow>
      <DetailRow icon="call-outline" label="Mobile">
        <Text
          className={`text-xs font-semibold ${
            phone ? "text-neutral-900" : "font-normal text-neutral-400"
          }`}
        >
          {phone || "—"}
        </Text>
      </DetailRow>
      <DetailRow icon="gift-outline" label="DOB">
        <Text
          className={`text-xs font-semibold ${
            dobFormatted ? "text-neutral-900" : "font-normal text-neutral-400"
          }`}
        >
          {dobFormatted || "—"}
        </Text>
      </DetailRow>
    </View>
  );
}

export function AppointmentIntakeCard({
  symptoms,
  reason,
  appointmentType,
  header,
  headerLoading,
  headerError,
  embedded = false,
}: {
  symptoms?: string[] | string | null;
  reason?: string | null;
  appointmentType?: string | null;
  header?: PatientHeaderProps | null;
  headerLoading?: boolean;
  headerError?: unknown;
  /** Skip SectionChrome / nested box — parent provides the unified card. */
  embedded?: boolean;
}) {
  const walkIn = isWalkInAppointment({ symptoms, reason, appointmentType });
  const normalizedSymptoms = normalizeSymptoms(symptoms).filter(
    (s) => !isWalkInToken(s)
  );
  const normalizedReason = isWalkInToken(reason) ? "" : reason?.trim() ?? "";
  const hasAny = normalizedSymptoms.length > 0 || !!normalizedReason;

  const intakeBody = (
    <View className="gap-1.5">
      <DetailRow
        icon="warning-outline"
        label="Symptoms"
        iconColor={normalizedSymptoms.length > 0 ? "#dc2626" : "#9ca3af"}
      >
        {normalizedSymptoms.length > 0 ? (
          <View className="flex-row flex-wrap gap-1">
            {normalizedSymptoms.map((symptom) => (
              <View
                key={symptom}
                className="rounded-md bg-neutral-100 px-2 py-0.5"
              >
                <Text className="text-[11px] font-medium text-neutral-800">
                  {symptom}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className="text-xs text-neutral-400">—</Text>
        )}
      </DetailRow>

      <DetailRow icon="document-text-outline" label="Reason">
        <Text
          className={`text-xs font-semibold ${
            normalizedReason
              ? "text-neutral-900"
              : "font-normal text-neutral-400"
          }`}
        >
          {normalizedReason || "—"}
        </Text>
      </DetailRow>
    </View>
  );

  if (embedded) {
    return (
      <View className="gap-2.5 px-3.5 py-2.5">
        <View className="gap-1.5">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-[10px] font-semibold uppercase tracking-wider text-brand">
              Patient Details
            </Text>
            {walkIn ? (
              <View className="rounded-md bg-brand px-2.5 py-1">
                <Text className="text-[10px] font-semibold uppercase tracking-wide text-white">
                  Walk-in
                </Text>
              </View>
            ) : null}
          </View>
          <PatientDetailsBlock
            header={header}
            loading={headerLoading}
            error={headerError}
          />
        </View>

        {!walkIn ? (
          <>
            <View className="h-px bg-neutral-100" />

            <View className="gap-1.5">
              <Text className="text-[10px] font-semibold uppercase tracking-wider text-brand">
                Appointment Details
              </Text>
              {intakeBody}
            </View>
          </>
        ) : null}
      </View>
    );
  }

  if (!hasAny) {
    return (
      <SectionChrome title="Appointment Intake" emptyBorder className="flex-1">
        <View className="gap-2.5">
          <View className="flex-row items-center gap-2">
            <Ionicons name="warning-outline" size={16} color="#9ca3af" />
            <Text className="text-sm text-neutral-500">Symptoms:</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Ionicons name="document-text-outline" size={16} color="#9ca3af" />
            <Text className="text-sm text-neutral-500">Reason for visit:</Text>
          </View>
        </View>
      </SectionChrome>
    );
  }

  return (
    <SectionChrome title="Appointment Intake" className="flex-1">
      <View className="gap-2.5 rounded-lg bg-white p-3">{intakeBody}</View>
    </SectionChrome>
  );
}
