import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Button, TextField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { useDiagnosisSearch, useSaveSummary, useSummary } from "../hooks";
import type { DiagnosisCode } from "../types";
import { useCardFocusHighlight } from "../useCardFocusHighlight";

type SoapKey = "subjective" | "objective" | "assessment" | "plan";

const SOAP: { key: SoapKey; label: string; placeholder: string }[] = [
  { key: "subjective", label: "Subjective", placeholder: "Complaints, history…" },
  { key: "objective", label: "Objective", placeholder: "Exam findings…" },
  { key: "assessment", label: "Assessment", placeholder: "Diagnosis, impression…" },
  { key: "plan", label: "Plan", placeholder: "Treatment plan, follow-up…" },
];

export function NotesSection({ consultationId }: { consultationId: string }) {
  const q = useSummary(consultationId);
  const save = useSaveSummary(consultationId);
  const { highlighted, onFocus, onBlur } = useCardFocusHighlight();
  const [form, setForm] = useState<Record<SoapKey, string>>({
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
  });
  const [codes, setCodes] = useState<DiagnosisCode[]>([]);
  const [dxQuery, setDxQuery] = useState("");
  const dx = useDiagnosisSearch(dxQuery);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (q.data) {
      setForm({
        subjective: q.data.subjective ?? "",
        objective: q.data.objective ?? "",
        assessment: q.data.assessment ?? "",
        plan: q.data.plan ?? "",
      });
      setCodes(q.data.diagnosisCodes ?? []);
    }
  }, [q.data]);

  const set = (k: SoapKey, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  const addCode = (c: DiagnosisCode) => {
    if (codes.some((x) => x.code === c.code)) return;
    setCodes([...codes, { ...c, isPrimary: codes.length === 0 }]);
    setDxQuery("");
    setSaved(false);
  };
  const removeCode = (code: string) => {
    setCodes(codes.filter((c) => c.code !== code));
    setSaved(false);
  };

  const onSave = async () => {
    setError(null);
    try {
      await save.mutateAsync({ ...form, diagnosisCodes: codes });
      setSaved(true);
    } catch (e) {
      setError(describeError(e));
    }
  };

  return (
    <View
      className={`gap-4 rounded-2xl border bg-white p-5 ${
        highlighted ? "border-brand" : "border-neutral-200"
      }`}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-neutral-900">
          Clinical notes (SOAP)
        </Text>
        {q.data?.isAIGenerated ? (
          <View className="rounded-full bg-violet-50 px-2.5 py-1">
            <Text className="text-[11px] font-medium text-violet-700">
              AI draft — review
            </Text>
          </View>
        ) : null}
      </View>

      {SOAP.map((f) => (
        <TextField
          key={f.key}
          label={f.label}
          value={form[f.key]}
          onChangeText={(v) => set(f.key, v)}
          placeholder={f.placeholder}
          multiline
          style={{ minHeight: 72, textAlignVertical: "top" }}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      ))}

      <View className="gap-2">
        <Text className="text-sm font-medium text-neutral-700">
          Diagnosis (ICD-10)
        </Text>
        {codes.length ? (
          <View className="flex-row flex-wrap gap-2">
            {codes.map((c) => (
              <Pressable
                key={c.code}
                onPress={() => removeCode(c.code)}
                className="flex-row items-center gap-1 rounded-full bg-brand-50 px-3 py-1"
              >
                <Text className="text-xs font-medium text-brand-700">
                  {c.code}
                  {c.isPrimary ? " ★" : ""}
                </Text>
                <Text className="text-xs text-brand-400">✕</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <TextField
          value={dxQuery}
          onChangeText={setDxQuery}
          placeholder="Search ICD-10 code or term…"
          autoCapitalize="none"
          onFocus={onFocus}
          onBlur={onBlur}
        />
        {dxQuery.trim().length >= 2 ? (
          <View className="overflow-hidden rounded-xl border border-neutral-200">
            {dx.isLoading ? (
              <Text className="px-3 py-2 text-sm text-neutral-400">Searching…</Text>
            ) : (dx.data ?? []).length === 0 ? (
              <Text className="px-3 py-2 text-sm text-neutral-400">No matches.</Text>
            ) : (
              (dx.data ?? []).slice(0, 8).map((c) => (
                <Pressable
                  key={c.code}
                  onPress={() => addCode(c)}
                  className="border-b border-neutral-100 px-3 py-2 active:bg-neutral-50"
                >
                  <Text className="text-sm font-medium text-neutral-900">
                    {c.code}
                  </Text>
                  <Text className="text-xs text-neutral-500" numberOfLines={1}>
                    {c.label}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        ) : null}
      </View>

      {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
      {saved ? <Text className="text-sm text-emerald-600">Notes saved.</Text> : null}

      <Button label="Save notes" onPress={onSave} loading={save.isPending} />
    </View>
  );
}
