import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppAlert, AppModal, Button } from "@/ui";
import { describeError } from "@/lib/api/errors";
import type { AiConsentState } from "@/lib/api/endpoints/speakadoc";
import { useRecordAiConsent } from "./hooks";

/**
 * The consent ask, as one step of pressing record (Practice
 * `AiCaptureConsentDialog`). Opens on the first press, carries the sentence to
 * read aloud, and the confirm both records the answer and starts recording.
 * Asked once per patient per clinic; the server keeps the answer.
 */
export function AiConsentSheet({
  visible,
  onClose,
  consultationId,
  state,
  onConsented,
}: {
  visible: boolean;
  onClose: () => void;
  consultationId: string;
  state: AiConsentState | undefined;
  /** Called once everything needed is on file. */
  onConsented: () => void;
}) {
  const record = useRecordAiConsent();
  const [clinicianAgreed, setClinicianAgreed] = useState(false);

  const missing = state?.missingPurposes ?? [];
  const clinicianNeeded = state ? state.clinician.consentedAt == null : false;
  const asks = (state?.patient ?? []).filter((p) => missing.includes(p.purpose));
  const previouslyDeclined = asks.some((p) => p.decision === "WITHDRAWN");
  const canConfirm = Boolean(state) && (!clinicianNeeded || clinicianAgreed);

  // A tick remembered from an earlier open is not an agreement given now, so
  // every way out of the sheet clears it.
  const close = () => {
    setClinicianAgreed(false);
    onClose();
  };

  const confirm = async () => {
    try {
      const result = await record.mutateAsync({
        consultationId,
        grants: missing.map((purpose) => ({ purpose, decision: "GRANTED" as const })),
        clinicianAgreed: clinicianNeeded ? clinicianAgreed : undefined,
      });
      close();
      // iOS drops a modal presented while another is still dismissing, so the
      // recorder waits for this sheet to finish closing.
      if (result.ready) setTimeout(onConsented, Platform.OS === "ios" ? 400 : 0);
    } catch (e) {
      // Loud, and recording does not start: a quiet failure would leave the
      // doctor believing consent was captured.
      AppAlert.alert("Could not record consent", describeError(e));
    }
  };

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View className="flex-1 items-center justify-center bg-black/50 px-4">
        <View className="w-full max-w-lg rounded-2xl bg-white p-5">
          <View className="mb-1 flex-row items-center gap-2">
            <Ionicons name="mic" size={18} color="#FD006A" />
            <Text className="text-lg font-semibold text-neutral-900">
              Before you record
            </Text>
          </View>
          <Text className="mb-4 text-sm text-neutral-500">
            {previouslyDeclined
              ? "This patient declined previously. Ask again only if they have changed their mind."
              : "Read this to the patient, then confirm what they said. You will not be asked again for this patient at this clinic."}
          </Text>

          {!state ? (
            <View className="items-center py-6">
              <ActivityIndicator color="#FD006A" />
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 14 }}>
              {asks.map((ask) => (
                <View key={ask.purpose} className="border-l-2 border-brand pl-3">
                  <Text className="text-sm leading-5 text-neutral-900">{ask.script}</Text>
                </View>
              ))}
              {clinicianNeeded ? (
                <Pressable
                  onPress={() => setClinicianAgreed((v) => !v)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: clinicianAgreed }}
                  className="flex-row items-start gap-2 rounded-lg bg-neutral-100 p-3"
                >
                  <Ionicons
                    name={clinicianAgreed ? "checkbox" : "square-outline"}
                    size={20}
                    color={clinicianAgreed ? "#FD006A" : "#6b7280"}
                  />
                  <Text className="flex-1 text-xs leading-5 text-neutral-600">
                    {state.clinician.script}
                  </Text>
                </Pressable>
              ) : null}
            </ScrollView>
          )}

          <View className="mt-5 flex-row justify-end gap-2">
            <Button
              label="Not now"
              variant="ghost"
              onPress={close}
              disabled={record.isPending}
            />
            <Button
              label={record.isPending ? "Saving…" : "Patient agreed — start recording"}
              onPress={() => void confirm()}
              disabled={!canConfirm || record.isPending}
            />
          </View>
        </View>
      </View>
    </AppModal>
  );
}
