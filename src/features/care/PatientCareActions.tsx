import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

import { Button, TextField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { useAuthUser, useFacilityId } from "@/lib/auth/store";
import {
  createRecording,
  listRecordings,
  uploadFile,
} from "@/lib/api/endpoints/recording";
import { CALL_PRIORITIES, CALL_TYPES } from "./types";
import { useAssignStaff, useRaiseCall } from "./hooks";

function extFromUri(uri: string): { ext: string; mime: string } {
  const l = uri.toLowerCase();
  if (l.endsWith(".wav")) return { ext: "wav", mime: "audio/wav" };
  if (l.endsWith(".mp3")) return { ext: "mp3", mime: "audio/mpeg" };
  return { ext: "m4a", mime: "audio/mp4" };
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            className={`rounded-full px-3 py-1.5 ${active ? "bg-brand" : "bg-neutral-100"}`}
          >
            <Text
              className={`text-xs font-medium ${active ? "text-brand-foreground" : "text-neutral-600"}`}
            >
              {o.toLowerCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PatientCareActions({ patientId }: { patientId: string }) {
  const user = useAuthUser();
  const facilityId = useFacilityId();
  const assign = useAssignStaff();
  const raise = useRaiseCall();

  const [callType, setCallType] = useState<string>("ASSISTANCE");
  const [priority, setPriority] = useState<string>("NORMAL");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const rstate = useAudioRecorderState(recorder);
  const [busyRec, setBusyRec] = useState(false);

  const recs = useQuery({
    queryKey: ["patient-recordings", patientId, facilityId],
    enabled: !!patientId && !!facilityId,
    queryFn: () => listRecordings({ facilityId: facilityId!, patientId }),
  });

  const onAssign = async () => {
    setErr(null);
    setMsg(null);
    if (!user) return;
    try {
      await assign.mutateAsync({ patientId, staffUserId: user.id });
      setMsg("Assigned to you.");
    } catch (e) {
      setErr(describeError(e));
    }
  };

  const onRaise = async () => {
    setErr(null);
    setMsg(null);
    try {
      await raise.mutateAsync({
        patientId,
        type: callType,
        priority,
        note: note.trim() || undefined,
      });
      setNote("");
      setMsg("Care request sent.");
    } catch (e) {
      setErr(describeError(e));
    }
  };

  const startRec = async () => {
    setErr(null);
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setErr("Microphone permission is required.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      setErr(describeError(e));
    }
  };

  const stopRec = async () => {
    setBusyRec(true);
    setErr(null);
    try {
      const durationMs = rstate.durationMillis ?? 0;
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri || !facilityId) return;
      const { ext, mime } = extFromUri(uri);
      const urls = await uploadFile(
        uri,
        `care-${patientId}-${Date.now()}.${ext}`,
        mime,
        "care_recording",
        { facilityId, patientId }
      );
      if (urls[0]) {
        await createRecording({
          facilityId,
          patientId,
          kind: "AUDIO",
          url: urls[0],
          mimeType: mime,
          durationSec: Math.round(durationMs / 1000),
        });
        recs.refetch();
      }
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusyRec(false);
    }
  };

  const recCount = recs.data?.length ?? 0;

  return (
    <View className="gap-4">
      {msg ? <Text className="text-sm text-emerald-600">{msg}</Text> : null}
      {err ? <Text className="text-sm text-red-500">{err}</Text> : null}

      <View className="flex-row gap-3">
        <Button
          label="Assign to me"
          variant="outline"
          className="flex-1"
          onPress={onAssign}
          loading={assign.isPending}
        />
        <Pressable
          onPress={rstate.isRecording ? stopRec : startRec}
          disabled={busyRec}
          className={`h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl ${
            rstate.isRecording ? "bg-red-600" : "bg-brand"
          }`}
        >
          {busyRec ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons
              name={rstate.isRecording ? "stop" : "mic"}
              size={18}
              color="#fff"
            />
          )}
          <Text className="text-sm font-semibold text-brand-foreground">
            {rstate.isRecording
              ? `Stop (${Math.floor((rstate.durationMillis ?? 0) / 1000)}s)`
              : "Record"}
          </Text>
        </Pressable>
      </View>

      <View className="gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <Text className="text-base font-semibold text-neutral-900">
          Raise a care request
        </Text>
        <Chips options={CALL_TYPES} value={callType} onChange={setCallType} />
        <Chips options={CALL_PRIORITIES} value={priority} onChange={setPriority} />
        <TextField
          value={note}
          onChangeText={setNote}
          placeholder="Note (optional)"
          multiline
          style={{ minHeight: 44, textAlignVertical: "top" }}
        />
        <Button label="Page assigned staff" onPress={onRaise} loading={raise.isPending} />
      </View>

      {recCount > 0 ? (
        <Text className="text-xs text-neutral-400">
          {recCount} recording{recCount === 1 ? "" : "s"} captured for this patient.
        </Text>
      ) : null}
    </View>
  );
}
