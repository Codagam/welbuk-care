import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

import { describeError } from "@/lib/api/errors";
import { useFacilityId } from "@/lib/auth/store";
import { uploadFile } from "@/lib/api/endpoints/recording";
import { useCreateRecording, useRecordings } from "../hooks";

function extFromUri(uri: string): { ext: string; mime: string } {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".wav")) return { ext: "wav", mime: "audio/wav" };
  if (lower.endsWith(".mp3")) return { ext: "mp3", mime: "audio/mpeg" };
  if (lower.endsWith(".webm")) return { ext: "webm", mime: "audio/webm" };
  return { ext: "m4a", mime: "audio/mp4" };
}

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function RecordingSection({
  consultationId,
  patientId,
  appointmentId,
}: {
  consultationId: string;
  patientId?: string;
  appointmentId?: string;
}) {
  const facilityId = useFacilityId();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const recordings = useRecordings(patientId, consultationId);
  const createRec = useCreateRecording(patientId, consultationId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setError("Microphone permission is required to record.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      setError(describeError(e));
    }
  };

  const stop = async () => {
    setBusy(true);
    setError(null);
    try {
      const durationMs = state.durationMillis ?? 0;
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        setError("Nothing was recorded.");
        return;
      }
      if (!facilityId || !patientId) {
        setError("Missing patient/facility context.");
        return;
      }
      const { ext, mime } = extFromUri(uri);
      const urls = await uploadFile(
        uri,
        `consult-${consultationId}-${Date.now()}.${ext}`,
        mime,
        "consult_audio",
        { consultationId, facilityId, patientId }
      );
      if (urls[0]) {
        await createRec.mutateAsync({
          facilityId,
          patientId,
          consultationId,
          appointmentId,
          kind: "AUDIO",
          url: urls[0],
          mimeType: mime,
          durationSec: Math.round(durationMs / 1000),
        });
      }
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const items = recordings.data ?? [];

  return (
    <View className="gap-4">
      <View className="items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-6">
        <Text className="text-lg font-semibold text-neutral-900">
          Voice recording
        </Text>

        {state.isRecording ? (
          <Text className="text-2xl font-bold tabular-nums text-brand">
            {fmtDuration(state.durationMillis ?? 0)}
          </Text>
        ) : (
          <Text className="text-sm text-neutral-500">
            Record the consultation audio and attach it to this visit.
          </Text>
        )}

        {busy ? (
          <View className="items-center gap-2">
            <ActivityIndicator color="#FD006A" />
            <Text className="text-xs text-neutral-400">Uploading…</Text>
          </View>
        ) : (
          <Pressable
            onPress={state.isRecording ? stop : start}
            className={`h-20 w-20 items-center justify-center rounded-full ${
              state.isRecording ? "bg-red-600" : "bg-brand"
            }`}
          >
            <Ionicons
              name={state.isRecording ? "stop" : "mic"}
              size={34}
              color="#fff"
            />
          </Pressable>
        )}

        {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
      </View>

      <View className="gap-2 rounded-2xl border border-neutral-200 bg-white p-5">
        <Text className="text-base font-semibold text-neutral-900">
          Recordings ({items.length})
        </Text>
        {items.length === 0 ? (
          <Text className="text-sm text-neutral-400">No recordings yet.</Text>
        ) : (
          items.map((r) => (
            <View
              key={r.id}
              className="flex-row items-center gap-3 border-t border-neutral-100 py-2"
            >
              <Ionicons name="musical-notes-outline" size={18} color="#6b7280" />
              <View className="flex-1">
                <Text className="text-sm text-neutral-900">
                  {r.kind === "AUDIO" ? "Audio" : r.kind}
                  {r.durationSec ? ` · ${fmtDuration(r.durationSec * 1000)}` : ""}
                </Text>
                <Text className="text-xs text-neutral-400">
                  {new Date(r.createdAt).toLocaleString()}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}
