import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { AppModal, Button, Segmented, TextField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { createReferral } from "@/lib/api/endpoints/referral";
import { useFacilityId, useActiveFacility } from "@/lib/auth/store";

const PRIORITIES = ["Routine", "Urgent", "STAT"] as const;
const REFERRAL_TYPES = ["Lab", "Radiology", "Specialist"] as const;

export function ReferSheet({
  open,
  onClose,
  patientId,
  patientName,
  patientAge,
  patientGender,
  patientPhone,
  doctorId,
  doctorName,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  patientId?: string;
  patientName: string;
  patientAge: number | string;
  patientGender?: string;
  patientPhone?: string;
  doctorId?: string;
  doctorName?: string;
  onCreated?: () => void;
}) {
  const facilityId = useFacilityId();
  const facility = useActiveFacility();
  const [toFacilityId, setToFacilityId] = useState(facilityId ?? "");
  const [referralType, setReferralType] =
    useState<(typeof REFERRAL_TYPES)[number]>("Lab");
  const [priority, setPriority] =
    useState<(typeof PRIORITIES)[number]>("Routine");
  const [tests, setTests] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!facilityId) {
      setError("No active facility.");
      return;
    }
    if (!patientName.trim()) {
      setError("Patient name is required.");
      return;
    }
    if (patientAge == null || patientAge === "") {
      setError("Patient age is required.");
      return;
    }
    const target = (toFacilityId || facilityId).trim();
    if (!target) {
      setError("Target facility is required.");
      return;
    }

    setSaving(true);
    try {
      await createReferral({
        patientName: patientName.trim(),
        patientAge,
        patientGender,
        patientPhone,
        patientId,
        referralType,
        tests: tests
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        priority,
        notes: notes.trim() || undefined,
        doctorName,
        doctorId,
        fromFacilityId: facilityId,
        toFacilityId: target,
        fromFacilityName: facility?.name,
        toFacilityName:
          target === facilityId ? facility?.name : undefined,
      });
      onCreated?.();
      onClose();
      setTests("");
      setNotes("");
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal
      visible={open}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between border-b border-neutral-200 px-5 py-4">
          <Text className="text-lg font-semibold text-brand">
            Refer patient
          </Text>
          <Pressable onPress={onClose} className="p-2">
            <Text className="text-brand">Close</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-sm text-neutral-600">
            Patient: {patientName || "—"}
            {patientAge != null && patientAge !== ""
              ? ` · Age ${patientAge}`
              : ""}
          </Text>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-brand">Type</Text>
            <Segmented
              options={[...REFERRAL_TYPES]}
              value={referralType}
              onChange={setReferralType}
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-brand">
              Priority
            </Text>
            <Segmented
              options={[...PRIORITIES]}
              value={priority}
              onChange={setPriority}
            />
          </View>

          <TextField
            label="Tests (comma-separated)"
            labelClassName="text-brand"
            value={tests}
            onChangeText={setTests}
            placeholder="CBC, LFT…"
          />

          <TextField
            label="To facility ID"
            labelClassName="text-brand"
            value={toFacilityId}
            onChangeText={setToFacilityId}
            placeholder="Defaults to current facility"
          />

          <TextField
            label="Notes"
            labelClassName="text-brand"
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional"
            multiline
          />

          {error ? <Text className="text-sm text-red-500">{error}</Text> : null}

          <Button label="Submit referral" onPress={onSubmit} loading={saving} />
        </ScrollView>
      </View>
    </AppModal>
  );
}
