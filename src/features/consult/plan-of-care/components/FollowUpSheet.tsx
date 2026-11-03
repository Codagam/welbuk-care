import { useEffect, useMemo, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppModal, Button, DateField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import {
  createFacilityAppointment,
  listFacilityAppointments,
  updateFacilityAppointment,
} from "@/lib/api/endpoints/appointments";
import type { ConsultSummary } from "@/features/consult/types";
import {
  addFollowUpInterval,
  describeFollowUpInterval,
  FOLLOW_UP_PRESETS,
  FOLLOW_UP_UNITS,
  followUpTextForPdf,
  formatFollowUpDate,
  intervalFromYmd,
  isBookedFollowUpSummaryLine,
  MAX_FOLLOW_UP_DAYS,
  parseFollowUpInterval,
  toFollowUpYmd,
  tomorrowYmd,
  type FollowUpInterval,
  type FollowUpUnit,
} from "../followUp";
import { placePicker, type PickerAnchor } from "./regimen/pickerPlacement";

type Mode = "none" | "preset" | "custom" | "date";

const PANEL_HEIGHT = 400;

function maxFollowUpYmd(): string {
  return toFollowUpYmd(
    addFollowUpInterval(new Date(), { count: MAX_FOLLOW_UP_DAYS, unit: "DAY" })
  );
}

function Chip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ selected }}
      style={{ flexShrink: 0 }}
      className={`h-10 items-center justify-center rounded-full border px-4 ${
        selected ? "border-brand bg-brand" : "border-neutral-300 bg-white"
      }`}
    >
      <Text
        numberOfLines={1}
        className={`text-sm font-medium ${
          selected ? "text-white" : "text-neutral-800"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Set a follow-up in one interaction, opening under the Follow-up button (Practice
 * FollowUpQuickSet). The date comes from the interval and is shown, because the
 * doctor reads it out to the patient. The time is the desk's to set afterwards.
 *
 * Nothing is pre-selected: choosing an interval books a real appointment, so one
 * nobody chose would be a visit the patient never agreed to.
 */
export function FollowUpSheet({
  open,
  onClose,
  anchor,
  facilityId,
  consultationId,
  patientId,
  doctorId,
  followUpSummaryLine,
  onBooked,
}: {
  open: boolean;
  onClose: () => void;
  anchor: PickerAnchor;
  facilityId: string;
  consultationId: string;
  patientId: string;
  doctorId: string;
  followUpSummaryLine?: string | null;
  onBooked: (summary: Partial<ConsultSummary>) => void | Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>("none");
  const [preset, setPreset] = useState<FollowUpInterval | null>(null);
  const [customCount, setCustomCount] = useState("");
  const [customUnit, setCustomUnit] = useState<FollowUpUnit>("MONTH");
  const [pickedYmd, setPickedYmd] = useState(tomorrowYmd());
  const [recurring, setRecurring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const screen = useWindowDimensions();

  const canBook =
    facilityId.trim().length > 0 &&
    /^[0-9a-fA-F]{24}$/.test(consultationId.trim()) &&
    /^[0-9a-fA-F]{24}$/.test(patientId.trim()) &&
    /^[0-9a-fA-F]{24}$/.test(doctorId.trim());

  // Every opening starts on None. A booked visit is found so it is moved, not doubled.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the panel stays mounted, and each opening must start clean
    setError(null);
    setMode("none");
    setPreset(null);
    setCustomCount("");
    setCustomUnit("MONTH");
    setPickedYmd(tomorrowYmd());
    setRecurring(false);
    setEditingId(null);

    if (!canBook || !isBookedFollowUpSummaryLine(followUpSummaryLine)) return;

    let cancelled = false;
    void (async () => {
      try {
        const rows = await listFacilityAppointments({
          facilityId,
          patientId,
          followUpSourceConsultationId: consultationId,
        });
        if (cancelled) return;
        const latest = rows
          .filter((a) => {
            const src = String(a.followUpSourceConsultationId ?? "").trim();
            if (src !== consultationId.trim()) return false;
            const status = String(a.status ?? "").toUpperCase();
            return (
              status !== "CANCELLED" && status !== "NO_SHOW" && status !== "DROPS"
            );
          })
          .sort(
            (a, b) =>
              new Date(String(b.updatedAt ?? b.createdAt ?? 0)).getTime() -
              new Date(String(a.updatedAt ?? a.createdAt ?? 0)).getTime()
          )[0];
        if (latest?.id) setEditingId(String(latest.id));
      } catch {
        // The doctor can still book.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    canBook,
    facilityId,
    patientId,
    consultationId,
    followUpSummaryLine,
  ]);

  useEffect(() => {
    if (!open) return;
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(
      ios ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      ios ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [open]);

  const interval = useMemo<FollowUpInterval | null>(() => {
    if (mode === "preset") return preset;
    if (mode === "custom") return parseFollowUpInterval(customCount, customUnit);
    if (mode === "date") return intervalFromYmd(pickedYmd);
    return null;
  }, [mode, preset, customCount, customUnit, pickedYmd]);

  const nextDate = interval ? addFollowUpInterval(new Date(), interval) : null;

  const customError =
    mode !== "custom" || customCount === "" || interval
      ? null
      : Number(customCount) < 1
        ? "Enter a whole number of 1 or more."
        : `Follow-ups are capped at ${MAX_FOLLOW_UP_DAYS} days. Use 12 months or less.`;

  const close = () => {
    if (saving) return;
    Keyboard.dismiss();
    onClose();
  };

  const onSave = async () => {
    if (!interval || !nextDate) return;
    if (!canBook) {
      setError("Need facility, patient and doctor to book a follow-up.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const ymd = toFollowUpYmd(nextDate);
      // A placeholder time only: the desk sets the real one from the appointment list.
      const start = new Date(nextDate);
      start.setHours(9, 0, 0, 0);
      const end = new Date(start.getTime() + 30 * 60 * 1000);

      const body: Record<string, unknown> = {
        facilityId,
        doctorId,
        patientId,
        appointmentDate: new Date(ymd).toISOString(),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        status: "TENTATIVE",
        reason: "Follow-up visit",
        isFollowUp: true,
        followUpSourceConsultationId: consultationId,
        appointmentType: "Follow-up",
        awaitingFollowUpSlot: true,
        fee: null,
        questionnaireData: {
          step1: { symptoms: ["Follow-up"], problemStart: "As advised" },
        },
      };

      // The booking comes first. An interval saved for a visit that failed to book
      // would be a follow-up nothing reminds anyone about.
      if (editingId) {
        await updateFacilityAppointment({ ...body, id: editingId });
      } else {
        await createFacilityAppointment(body);
      }

      // One write: the server rebuilds the printed line from the appointment.
      await onBooked({
        followUp: followUpTextForPdf(ymd),
        followUpDate: ymd,
        followUpIntervalCount: interval.count,
        followUpIntervalUnit: interval.unit,
        followUpRecurring: recurring,
        followUpAgreedVia: "CONSULT",
      });
      Keyboard.dismiss();
      onClose();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  };

  const panel = placePicker(
    {
      x: anchor.x + anchor.width - 420,
      y: anchor.y,
      width: 0,
      height: anchor.height,
    },
    screen,
    keyboardHeight,
    PANEL_HEIGHT
  );

  return (
    <AppModal
      visible={open}
      animationType="fade"
      transparent
      onRequestClose={close}
    >
      <View className="flex-1">
        {/* Closing books nothing: an appointment nobody meant to make is worse
            than one they have to make again. */}
        <Pressable
          onPress={close}
          accessibilityLabel="Close follow-up"
          className="bg-black/20"
          style={StyleSheet.absoluteFill}
        />
        <View
          className="overflow-hidden rounded-xl border border-neutral-200 bg-white"
          style={{
            position: "absolute",
            left: panel.left,
            top: panel.top,
            width: panel.width,
            height: panel.height,
            elevation: 8,
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text className="text-xs text-neutral-500">Come back in</Text>

            <View className="flex-row flex-wrap gap-2">
              <Chip
                label="None"
                selected={mode === "none"}
                disabled={saving}
                onPress={() => {
                  setMode("none");
                  setPreset(null);
                  setRecurring(false);
                }}
              />
              {FOLLOW_UP_PRESETS.map((p) => (
                <Chip
                  key={`${p.count}-${p.unit}`}
                  label={describeFollowUpInterval(p)}
                  selected={
                    mode === "preset" &&
                    preset?.count === p.count &&
                    preset.unit === p.unit
                  }
                  disabled={saving}
                  onPress={() => {
                    setMode("preset");
                    setPreset(p);
                  }}
                />
              ))}
              <Chip
                label="Custom"
                selected={mode === "custom"}
                disabled={saving}
                onPress={() => setMode("custom")}
              />
              <Chip
                label="Pick a date"
                selected={mode === "date"}
                disabled={saving}
                onPress={() => setMode("date")}
              />
            </View>

            {mode === "custom" ? (
              <View className="flex-row flex-wrap items-center gap-2">
                <TextInput
                  value={customCount}
                  onChangeText={(t) =>
                    setCustomCount(t.replace(/\D/g, "").slice(0, 2))
                  }
                  keyboardType="number-pad"
                  placeholder="e.g. 10"
                  placeholderTextColor="#9ca3af"
                  accessibilityLabel="Number of days, weeks or months"
                  className={`rounded-lg border bg-white px-3 text-base text-neutral-900 ${
                    customError ? "border-red-400" : "border-neutral-300"
                  }`}
                  style={{ width: 80, height: 44, paddingVertical: 0 }}
                />
                {FOLLOW_UP_UNITS.map((u) => (
                  <Chip
                    key={u}
                    label={`${u.charAt(0)}${u.slice(1).toLowerCase()}s`}
                    selected={customUnit === u}
                    disabled={saving}
                    onPress={() => setCustomUnit(u)}
                  />
                ))}
              </View>
            ) : null}

            {mode === "date" ? (
              <DateField
                value={pickedYmd}
                onChange={setPickedYmd}
                minimumDate={tomorrowYmd()}
                maximumDate={maxFollowUpYmd()}
              />
            ) : null}

            {customError ? (
              <Text className="text-xs text-red-500">{customError}</Text>
            ) : null}

            <Text className="text-sm">
              {nextDate ? (
                <>
                  <Text className="text-neutral-500">Next visit: </Text>
                  <Text className="font-semibold text-neutral-900">
                    {formatFollowUpDate(nextDate)}
                  </Text>
                </>
              ) : (
                <Text className="text-neutral-500">
                  {editingId
                    ? "Pick when to move the booked follow-up to."
                    : "No follow-up scheduled."}
                </Text>
              )}
            </Text>

            {interval ? (
              <Pressable
                onPress={() => setRecurring((v) => !v)}
                disabled={saving}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: recurring }}
                className="flex-row items-start gap-2"
              >
                <View
                  className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
                    recurring
                      ? "border-brand bg-brand"
                      : "border-neutral-400 bg-white"
                  }`}
                >
                  {recurring ? (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  ) : null}
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-xs text-neutral-900">
                    Repeat every visit
                  </Text>
                  <Text className="text-xs text-neutral-500">
                    The next one is booked when the patient attends, not in
                    advance, and it lapses if they stop coming.
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
          </ScrollView>

          <View className="flex-row items-center justify-end gap-2 border-t border-neutral-200 p-3">
            <Button
              label="Cancel"
              variant="ghost"
              size="md"
              disabled={saving}
              onPress={close}
            />
            <Button
              label={editingId ? "Update follow-up" : "Book follow-up"}
              size="md"
              loading={saving}
              disabled={saving || !interval || !canBook}
              onPress={() => void onSave()}
            />
          </View>
        </View>
      </View>
    </AppModal>
  );
}
