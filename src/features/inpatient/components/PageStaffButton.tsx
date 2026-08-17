import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppModal, Button, TextField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { usePageStaff } from "../hooks";
import type { PageWho } from "../types";

export function PageStaffButton({
  admissionId,
}: {
  admissionId: string;
}) {
  const [who, setWho] = useState<PageWho | null>(null);
  const [reason, setReason] = useState("");
  const [urgent, setUrgent] = useState(false);
  const send = usePageStaff(admissionId);

  const close = () => {
    setWho(null);
    setReason("");
    setUrgent(false);
  };

  const submit = async () => {
    if (!who) return;
    try {
      const out = await send.mutateAsync({
        who,
        reason: reason.trim() || null,
        urgent,
      });
      close();
      if (out.fellBackToFacility) {
        Alert.alert(
          "Paged the whole ward",
          "Nobody is on duty for this bed, so everyone was rung. Set a duty nurse or roster the station."
        );
        return;
      }
      const people =
        out.notifiedUserCount === 1
          ? "1 person"
          : `${out.notifiedUserCount} people`;
      const handsets = out.pushedToDevices
        ? `${out.pushedToDevices} handset${
            out.pushedToDevices === 1 ? "" : "s"
          } rang${out.stationName ? ` · ${out.stationName}` : ""}`
        : "No handsets are registered — they will see it on screen only.";
      Alert.alert(`Paged ${people}`, handsets);
    } catch (err) {
      Alert.alert("Could not send the page", describeError(err));
    }
  };

  return (
    <>
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => setWho("DOCTOR")}
          accessibilityRole="button"
          accessibilityLabel="Page doctor"
          className="h-11 min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-brand/40 bg-white active:bg-brand/5"
        >
          <Ionicons name="notifications-outline" size={16} color="#FD006A" />
          <Text className="text-sm font-semibold text-brand">Page doctor</Text>
        </Pressable>
        <Pressable
          onPress={() => setWho("NURSE")}
          accessibilityRole="button"
          accessibilityLabel="Page nurse"
          className="h-11 min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-brand/40 bg-white active:bg-brand/5"
        >
          <Ionicons name="notifications-outline" size={16} color="#FD006A" />
          <Text className="text-sm font-semibold text-brand">Page nurse</Text>
        </Pressable>
      </View>

      <AppModal
        visible={who !== null}
        transparent
        animationType="fade"
        androidSafeArea={false}
        statusBarStyle="dark"
        statusBarBackgroundColor="transparent"
        onRequestClose={close}
      >
        <View className="flex-1 justify-center bg-black/40 px-6">
          <Pressable className="absolute inset-0" onPress={close} />
          <View className="rounded-2xl bg-white p-4">
            <Text className="text-base font-semibold text-neutral-900">
              Page the {who === "NURSE" ? "nurse" : "doctor"}
            </Text>
            <Text className="mt-1 text-sm text-neutral-500">
              {who === "NURSE"
                ? "Reaches the duty nurse and the whole station desk."
                : "Reaches the admitting doctor."}
            </Text>
            <View className="mt-3">
              <TextField
                label="What is it? (optional)"
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. pain not settling"
                autoFocus
                returnKeyType="send"
                onSubmitEditing={() => {
                  if (!send.isPending) void submit();
                }}
              />
            </View>
            <Pressable
              onPress={() => setUrgent((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: urgent }}
              className="mt-3 flex-row items-center gap-2 py-1"
            >
              <View
                className={`h-5 w-5 items-center justify-center rounded border ${
                  urgent ? "border-brand bg-brand" : "border-neutral-300 bg-white"
                }`}
              >
                {urgent ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : null}
              </View>
              <Text className="text-sm text-neutral-800">Urgent</Text>
            </Pressable>
            <View className="mt-4 flex-row gap-2">
              <View className="flex-1">
                <Button
                  label={send.isPending ? "Sending…" : "Send"}
                  size="md"
                  loading={send.isPending}
                  disabled={send.isPending}
                  onPress={() => void submit()}
                  className="min-h-[44px]"
                />
              </View>
              <Button
                label="Cancel"
                variant="ghost"
                size="md"
                disabled={send.isPending}
                onPress={close}
                className="min-h-[44px]"
              />
            </View>
          </View>
        </View>
      </AppModal>
    </>
  );
}
