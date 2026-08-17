import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppModal, Button, TextField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { useFacilityId } from "@/lib/auth/store";
import { useUpdateAttender } from "../hooks";
import type { InpatientAdmission } from "../types";
import {
  formatInr,
  formatPersonNameTitleCase,
  ipDaysBetween,
  mrdForFacility,
  ratePerDayFromRoom,
  toDisplayDateDdMmYyyy,
} from "../utils";
import { PageStaffButton } from "./PageStaffButton";
import { PatientAvatar } from "./PatientAvatar";

export function StayIdentityCard({
  admission,
}: {
  admission: InpatientAdmission;
}) {
  const facilityId = useFacilityId();
  const name = formatPersonNameTitleCase(
    [admission.patient.firstName, admission.patient.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || "—"
  );
  const mrd = mrdForFacility(admission, facilityId);
  const days = ipDaysBetween(admission.admitDate, admission.dischargeDate);
  const rate = ratePerDayFromRoom(admission.room);
  const hasAttender = Boolean(
    admission.attenderName?.trim() || admission.attenderPhone?.trim()
  );
  const isDischarged =
    String(admission.status ?? "").toUpperCase() === "DISCHARGED";
  const admitYmd = new Date(admission.admitDate).toISOString().slice(0, 10);

  return (
    <View className="gap-3 rounded-2xl border border-neutral-200 bg-white px-3.5 py-3">
      <View className="flex-row items-start gap-2.5">
        <PatientAvatar name={name} size={40} />
        <View className="min-w-0 flex-1">
          <Text
            className="text-lg font-semibold tracking-tight text-neutral-900"
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text className="mt-0.5 text-sm text-neutral-800">
            <Text className="font-semibold">
              {admission.room.displayName ||
                admission.room.roomNumber ||
                "Room not set"}
            </Text>
            {mrd ? (
              <Text
                className="text-neutral-500"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {" · "}MRD {mrd}
              </Text>
            ) : null}
          </Text>
          {admission.diagnosis?.trim() ? (
            <Text className="mt-0.5 text-xs text-neutral-500" numberOfLines={2}>
              {admission.diagnosis.trim()}
            </Text>
          ) : null}
        </View>
      </View>

      <EmergencyContact admission={admission} hasAttender={hasAttender} />

      <View className="border-t border-neutral-100 pt-3">
        <Text className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Doctor
        </Text>
        <Text className="mt-0.5 text-sm font-semibold text-neutral-900">
          {(admission.doctor.name ?? "—").trim() || "—"}
        </Text>
        {admission.doctor.specialization?.trim() ? (
          <Text className="text-[11px] text-neutral-500">
            {admission.doctor.specialization.trim()}
          </Text>
        ) : null}
      </View>

      {!isDischarged ? (
        <View className="border-t border-neutral-100 pt-3">
          <PageStaffButton admissionId={admission.id} />
        </View>
      ) : null}

      <View className="flex-row items-center justify-between gap-2 border-t border-neutral-100 pt-3">
        <View>
          <Text className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Admitted
          </Text>
          <Text className="mt-0.5 text-sm font-semibold text-neutral-900">
            {toDisplayDateDdMmYyyy(admitYmd)}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="rounded-full bg-neutral-100 px-2 py-0.5">
            <Text className="text-[11px] font-medium text-neutral-700">
              {days} day{days === 1 ? "" : "s"}
            </Text>
          </View>
          <View className="rounded-full bg-neutral-100 px-2 py-0.5">
            <Text
              className="text-[11px] font-medium text-neutral-700"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {formatInr(rate)}/day
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function EmergencyContact({
  admission,
  hasAttender,
}: {
  admission: InpatientAdmission;
  hasAttender: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View className="rounded-xl border border-neutral-200 bg-neutral-50 p-2.5">
      <Text className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        Emergency contact
      </Text>

      {hasAttender ? (
        <View className="mt-1.5">
          <Text className="text-sm font-semibold text-neutral-900">
            {admission.attenderName?.trim() || "Attender"}
            {admission.attenderRelation?.trim() ? (
              <Text className="font-normal text-neutral-500">
                {" "}
                ({admission.attenderRelation.trim()})
              </Text>
            ) : null}
          </Text>
          {admission.attenderPhone?.trim() ? (
            <View className="mt-0.5 flex-row items-center gap-1.5">
              <Ionicons name="call-outline" size={14} color="#737373" />
              <Text
                className="text-base font-semibold text-neutral-900"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {admission.attenderPhone.trim()}
              </Text>
            </View>
          ) : (
            <Text className="text-xs text-neutral-500">No number on file.</Text>
          )}
        </View>
      ) : (
        <View className="mt-1.5 gap-1">
          <Text className="text-xs text-amber-700">
            No attender recorded for this admission.
          </Text>
          <Pressable onPress={() => setOpen(true)}>
            <Text className="text-xs font-medium text-brand underline">
              Add one
            </Text>
          </Pressable>
        </View>
      )}

      {admission.patient.phone?.trim() ? (
        <View className="mt-1.5 border-t border-neutral-200 pt-1.5">
          <Text className="text-[10px] uppercase tracking-wider text-neutral-500">
            Patient
          </Text>
          <View className="mt-0.5 flex-row items-center gap-1.5">
            <Ionicons name="call-outline" size={14} color="#737373" />
            <Text
              className="text-sm font-medium text-neutral-800"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {admission.patient.phone.trim()}
            </Text>
          </View>
        </View>
      ) : null}

      <AttenderSheet
        admission={admission}
        visible={open}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

function AttenderSheet({
  admission,
  visible,
  onClose,
}: {
  admission: InpatientAdmission;
  visible: boolean;
  onClose: () => void;
}) {
  const save = useUpdateAttender(admission.id);
  const [name, setName] = useState(admission.attenderName ?? "");
  const [phone, setPhone] = useState(admission.attenderPhone ?? "");
  const [relation, setRelation] = useState(admission.attenderRelation ?? "");

  useEffect(() => {
    if (!visible) return;
    setName(admission.attenderName ?? "");
    setPhone(admission.attenderPhone ?? "");
    setRelation(admission.attenderRelation ?? "");
  }, [
    visible,
    admission.attenderName,
    admission.attenderPhone,
    admission.attenderRelation,
  ]);

  const submit = async () => {
    try {
      await save.mutateAsync({
        attenderName: name,
        attenderPhone: phone,
        attenderRelation: relation,
      });
      onClose();
    } catch (err) {
      Alert.alert("Could not save attender", describeError(err));
    }
  };

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="fade"
      androidSafeArea={false}
      statusBarStyle="dark"
      statusBarBackgroundColor="transparent"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center bg-black/40 px-6">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className="rounded-2xl bg-white p-4">
          <Text className="text-base font-semibold text-neutral-900">
            Emergency contact
          </Text>
          <View className="mt-3 gap-3">
            <TextField
              label="Attender name"
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <TextField
              label="Relation"
              value={relation}
              onChangeText={setRelation}
              placeholder="son, wife…"
            />
            <TextField
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>
          <View className="mt-4 flex-row gap-2">
            <View className="flex-1">
              <Button
                label="Save"
                size="md"
                loading={save.isPending}
                disabled={save.isPending}
                onPress={() => void submit()}
              />
            </View>
            <Button
              label="Cancel"
              variant="ghost"
              size="md"
              onPress={onClose}
            />
          </View>
        </View>
      </View>
    </AppModal>
  );
}
