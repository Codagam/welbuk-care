import { useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useCanWrite } from "@/features/permissions/hooks";
import { describeError } from "@/lib/api/errors";
import { AppModal, Button, TextField } from "@/ui";

import type { ConsultLock } from "../consultPatient";
import {
  countReasonWords,
  formatConsultCompletedAt,
  MIN_REOPEN_WORDS,
} from "../consultLock";
import { useReopenConsult } from "../useReopenConsult";

export function ConsultLockBanner({
  consultationId,
  lock,
}: {
  consultationId: string;
  lock?: ConsultLock | null;
}) {
  const canReopen = useCanWrite("consult");
  const reopen = useReopenConsult(consultationId);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reason, setReason] = useState("");

  const words = countReasonWords(reason);
  const ready = words >= MIN_REOPEN_WORDS;
  const saving = reopen.isPending;
  const remaining = Math.max(0, MIN_REOPEN_WORDS - words);

  const completedAt = formatConsultCompletedAt(lock?.completedAt);
  const completedBy = lock?.completedBy?.trim() || null;
  const reopenCount = lock?.reopenCount ?? 0;

  const closeSheet = () => {
    if (saving) return;
    setSheetOpen(false);
  };

  const submit = async () => {
    if (!ready || saving) return;
    try {
      await reopen.mutateAsync(reason);
      Alert.alert("Reopened — this consultation can be edited again");
      setReason("");
      setSheetOpen(false);
    } catch (e) {
      Alert.alert("Could not reopen", describeError(e));
    }
  };

  return (
    <>
      <View className="mx-4 mb-2 mt-3 flex-row flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5">
        <Ionicons name="lock-closed-outline" size={18} color="#B45309" />
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-amber-900">
            This consultation is completed and locked
          </Text>
          <Text className="mt-0.5 text-xs text-amber-800/90">
            {completedAt ? `Completed ${completedAt}` : "Completed"}
            {completedBy ? ` by ${completedBy}` : ""}
            {reopenCount > 0
              ? ` · reopened ${reopenCount} time${reopenCount === 1 ? "" : "s"}`
              : ""}
            . Printing still works.
          </Text>
        </View>
        {canReopen ? (
          <Button
            label="Reopen"
            variant="outline"
            size="md"
            className="min-h-[44px] border-amber-400"
            icon={
              <Ionicons name="lock-open-outline" size={16} color="#111827" />
            }
            onPress={() => setSheetOpen(true)}
          />
        ) : null}
      </View>

      <AppModal
        visible={sheetOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeSheet}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 bg-white"
        >
          <View className="flex-row items-center justify-between border-b border-neutral-200 px-4 py-3">
            <Text className="text-lg font-semibold text-neutral-900">
              Reopen this consultation?
            </Text>
            <Pressable onPress={closeSheet} hitSlop={12} disabled={saving}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ padding: 20, paddingTop: 16 }}
          >
            <Pressable
              onPress={Keyboard.dismiss}
              accessible={false}
              style={{ gap: 12 }}
            >
              <Text className="text-sm text-neutral-600">
                It becomes editable again. The reason, your name and the time are
                recorded on the consultation.
              </Text>

              <TextField
                label="Why is it being reopened? *"
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. dosage corrected after pharmacy query"
                multiline
                editable={!saving}
                style={{ minHeight: 96, textAlignVertical: "top" }}
              />
              <Text className="text-xs text-neutral-500">
                {ready
                  ? "This is stored on the consultation."
                  : `A few words at least — ${remaining} more.`}
              </Text>

              <View className="mt-2 flex-row gap-3">
                <Button
                  label="Cancel"
                  variant="outline"
                  className="flex-1"
                  onPress={closeSheet}
                  disabled={saving}
                />
                <Button
                  label={saving ? "Reopening…" : "Reopen"}
                  className="flex-1"
                  onPress={() => void submit()}
                  loading={saving}
                  disabled={!ready}
                />
              </View>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </AppModal>
    </>
  );
}
