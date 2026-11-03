import { useEffect, useRef, useState, type RefObject } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { describeError } from "@/lib/api/errors";
import { TextField } from "@/ui";

import { CodeInsertPicker } from "../components/CodeInsertPicker";
import { CONSULT_LOCKED_MESSAGE } from "../consultLock";
import { useSaveSummary, useSummary } from "../hooks";
import { formatCodeLine, insertAsLines } from "../soapText";
import type { ConsultSummary, DiagnosisCode } from "../types";

type SoapKey = "subjective" | "objective" | "assessment" | "plan";

const SOAP_KEYS: SoapKey[] = ["subjective", "objective", "assessment", "plan"];

const SOAP: { key: SoapKey; label: string; hint: string }[] = [
  {
    key: "subjective",
    label: "Subjective",
    hint: "History, symptoms in the patient's words",
  },
  {
    key: "objective",
    label: "Objective",
    hint: "Exam findings, vitals, investigation results",
  },
  {
    key: "assessment",
    label: "Assessment",
    hint: "Diagnosis / clinical impression. Insert code adds an ICD-10 or SNOMED code",
  },
  {
    key: "plan",
    label: "Plan",
    hint: "Treatment, investigations, follow-up",
  },
];

const AUTOSAVE_MS = 1500;

const EMPTY: Record<SoapKey, string> = {
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
};

type SaveStatus = "idle" | "saving" | "saved";

/**
 * SOAP notes (Practice ClinicalNotesSection). Each note saves itself 1.5 s after
 * typing stops, on leaving the box, and on leaving the screen, so nothing typed
 * depends on remembering a button. Codes go into Assessment as plain text.
 *
 * `flushRef` lets Complete write what is pending first. A button tap does not take
 * focus from a text box here, so without it the last words would reach the server
 * after the consult had locked, and be refused.
 */
export function NotesSection({
  consultationId,
  locked = false,
  flushRef,
}: {
  consultationId: string;
  locked?: boolean;
  flushRef?: RefObject<(() => Promise<boolean>) | null>;
}) {
  const q = useSummary(consultationId);
  const save = useSaveSummary(consultationId);
  const [form, setForm] = useState<Record<SoapKey, string>>(EMPTY);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  /** Saved codes just moved into the text, hidden until the server agrees. */
  const [codesMoved, setCodesMoved] = useState(false);

  const formRef = useRef(form);
  /** The value each note last saved as (or arrived as). Decides what is pending. */
  const savedRef = useRef<Record<SoapKey, string>>({ ...EMPTY });
  const focusedRef = useRef<SoapKey | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Saves run one at a time, so two writes cannot land in the wrong order. */
  const queueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const inFlightRef = useRef(0);
  /** Last caret in Assessment, so a code lands where the doctor was typing. */
  const caretRef = useRef<{ start: number; end: number } | null>(null);

  // Take the server's copy, except a note being typed in, one with unsaved changes,
  // or while a save is running (the answer would be older than what is on screen).
  useEffect(() => {
    const data = q.data;
    if (!data || inFlightRef.current > 0) return;
    const next = { ...formRef.current };
    for (const key of SOAP_KEYS) {
      if (focusedRef.current === key) continue;
      if (formRef.current[key] !== savedRef.current[key]) continue;
      const incoming = data[key] ?? "";
      next[key] = incoming;
      savedRef.current[key] = incoming;
    }
    formRef.current = next;
    setForm(next);
  }, [q.data]);

  const persist = (extra?: Partial<ConsultSummary>): Promise<boolean> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (locked) return Promise.resolve(true);

    const patch: Partial<Record<SoapKey, string>> = {};
    const previous: Partial<Record<SoapKey, string>> = {};
    for (const key of SOAP_KEYS) {
      if (formRef.current[key] !== savedRef.current[key]) {
        patch[key] = formRef.current[key];
        previous[key] = savedRef.current[key];
        savedRef.current[key] = formRef.current[key];
      }
    }
    if (Object.keys(patch).length === 0 && !extra) return queueRef.current;

    inFlightRef.current += 1;
    setStatus("saving");
    setError(null);
    const run = queueRef.current.then(async () => {
      try {
        await save.mutateAsync({ ...patch, ...extra });
        inFlightRef.current -= 1;
        if (inFlightRef.current === 0) setStatus("saved");
        return true;
      } catch (e) {
        // Mark it unsaved again, so the next save or Complete retries it.
        for (const key of SOAP_KEYS) {
          if (key in previous && savedRef.current[key] === patch[key]) {
            savedRef.current[key] = previous[key] ?? "";
          }
        }
        inFlightRef.current -= 1;
        setStatus("idle");
        setError(describeError(e));
        return false;
      }
    });
    queueRef.current = run;
    return run;
  };

  // Handed out through refs so the cleanup below always calls the current one.
  const persistRef = useRef(persist);
  useEffect(() => {
    persistRef.current = persist;
    if (flushRef) flushRef.current = () => persist();
  });

  // Leaving the screen writes what is pending rather than dropping it.
  useEffect(() => {
    return () => {
      void persistRef.current();
    };
  }, []);

  const setField = (key: SoapKey, value: string) => {
    const next = { ...formRef.current, [key]: value };
    formRef.current = next;
    setForm(next);
  };

  const onType = (key: SoapKey, value: string) => {
    setField(key, value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void persist();
    }, AUTOSAVE_MS);
  };

  const addToAssessment = (text: string): void => {
    const current = formRef.current.assessment;
    const sel = caretRef.current ?? {
      start: current.length,
      end: current.length,
    };
    const start = Math.min(sel.start, current.length);
    const end = Math.min(Math.max(sel.end, start), current.length);
    const { value, caret } = insertAsLines(current, text, start, end);
    setField("assessment", value);
    caretRef.current = { start: caret, end: caret };
  };

  const insertCode = (line: string) => {
    addToAssessment(line);
    void persist();
  };

  const savedCodes: DiagnosisCode[] = codesMoved
    ? []
    : (q.data?.diagnosisCodes ?? []);

  /**
   * Older consults hold codes in `diagnosisCodes`, which prints AHEAD of Assessment.
   * Moving them is ONE request, so a printout neither shows them twice nor loses them.
   */
  const copySavedCodes = () => {
    const lines = [...savedCodes]
      .sort(
        (a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary))
      )
      .map((d) => formatCodeLine(d.code, d.system, d.label))
      .filter(Boolean)
      .join("\n");
    if (lines) addToAssessment(lines);
    setCodesMoved(true);
    void persist({ diagnosisCodes: [] }).then((ok) => {
      if (!ok) setCodesMoved(false);
    });
  };

  return (
    <View className="gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <View className="min-w-0 flex-1">
          <Text className="text-lg font-semibold text-brand">
            Clinical notes (SOAP)
          </Text>
          <Text className="text-xs text-neutral-500">
            Subjective / Objective / Assessment / Plan. Codes are inserted as
            text you can edit.
          </Text>
        </View>
        {status === "saving" ? (
          <Text className="text-xs text-neutral-500">Saving…</Text>
        ) : status === "saved" && !error ? (
          <Text className="text-xs text-emerald-600">Saved</Text>
        ) : null}
      </View>

      <View className="flex-row flex-wrap gap-4">
        {SOAP.map((f) => (
          <View
            key={f.key}
            className="gap-1.5"
            style={{ flexGrow: 1, flexBasis: 320, minWidth: 0 }}
          >
            <View
              className="flex-row items-center justify-between gap-2"
              style={{ minHeight: 36 }}
            >
              <Text className="text-sm font-semibold text-neutral-900">
                {f.label}
              </Text>
              {f.key === "assessment" && !locked ? (
                <CodeInsertPicker onInsert={insertCode} />
              ) : null}
            </View>
            <TextField
              value={form[f.key]}
              onChangeText={(v) => onType(f.key, v)}
              placeholder={f.hint}
              multiline
              editable={!locked}
              accessibilityLabel={f.label}
              style={{
                minHeight: 88,
                textAlignVertical: "top",
                opacity: locked ? 0.7 : 1,
              }}
              onFocus={() => {
                focusedRef.current = f.key;
              }}
              onBlur={() => {
                if (focusedRef.current === f.key) focusedRef.current = null;
                void persist();
              }}
              onSelectionChange={
                f.key === "assessment"
                  ? (e) => {
                      caretRef.current = e.nativeEvent.selection;
                    }
                  : undefined
              }
            />

            {f.key === "assessment" && savedCodes.length > 0 ? (
              <View className="flex-row flex-wrap items-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2">
                <Text className="text-xs text-neutral-500">Saved codes:</Text>
                {savedCodes.map((d) => (
                  <View
                    key={`${d.system ?? ""}:${d.code}`}
                    className="flex-row items-center gap-1 rounded bg-white px-1.5 py-0.5"
                    style={{ maxWidth: 240 }}
                  >
                    <Text className="text-xs font-semibold text-neutral-900">
                      {d.code}
                    </Text>
                    {d.label ? (
                      <Text
                        numberOfLines={1}
                        className="shrink text-xs text-neutral-500"
                      >
                        {d.label}
                      </Text>
                    ) : null}
                  </View>
                ))}
                {!locked ? (
                  <Pressable
                    onPress={copySavedCodes}
                    style={{ flexShrink: 0 }}
                    className="ml-auto h-9 flex-row items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 active:bg-neutral-50"
                  >
                    <Ionicons
                      name="clipboard-outline"
                      size={15}
                      color="#111827"
                    />
                    <Text
                      numberOfLines={1}
                      className="text-sm font-medium text-neutral-900"
                    >
                      Copy to Assessment
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        ))}
      </View>

      {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
      {locked ? (
        <Text className="text-xs text-amber-700">{CONSULT_LOCKED_MESSAGE}</Text>
      ) : null}
    </View>
  );
}
