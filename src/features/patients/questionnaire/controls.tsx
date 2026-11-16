import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { AppModal } from "@/ui/AppModal";
import { searchDrugs } from "@/lib/api/endpoints/drugs";
import { useFacilityId } from "@/lib/auth/store";
import type { YesNo } from "./model";

const BRAND = "#FD006A";

/** Numbered question heading, e.g. "2. Any previous surgeries?". */
export function Question({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <Text className="text-base font-semibold text-neutral-900">
      {children}
      {hint ? (
        <Text className="text-sm font-normal text-neutral-500"> {hint}</Text>
      ) : null}
    </Text>
  );
}

export function FieldError({ message }: { message?: string }) {
  return message ? <Text className="text-sm text-red-500">{message}</Text> : null;
}

/** Yes / No radio pair (Practice RadioGroup). */
export function YesNoRadio({
  value,
  onChange,
}: {
  value: YesNo;
  onChange: (v: YesNo) => void;
}) {
  return (
    <View className="flex-row gap-6 pl-1">
      {(["yes", "no"] as const).map((opt) => (
        <Radio
          key={opt}
          label={opt === "yes" ? "Yes" : "No"}
          selected={value === opt}
          onPress={() => onChange(opt)}
        />
      ))}
    </View>
  );
}

export function Radio({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      hitSlop={6}
      className="flex-row items-center gap-2 py-1"
    >
      <View
        className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
          selected ? "border-brand" : "border-neutral-400"
        }`}
      >
        {selected ? <View className="h-2.5 w-2.5 rounded-full bg-brand" /> : null}
      </View>
      <Text className="text-sm text-neutral-800">{label}</Text>
    </Pressable>
  );
}

export function Checkbox({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      hitSlop={4}
      className="flex-row items-center gap-2 py-1"
    >
      <View
        className={`h-5 w-5 items-center justify-center rounded border ${
          checked ? "border-brand bg-brand" : "border-neutral-400 bg-white"
        }`}
      >
        {checked ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
      </View>
      <Text className="flex-shrink text-sm text-neutral-800">{label}</Text>
    </Pressable>
  );
}

/** Single-line input matching Practice's `<Input>` look. */
export function Input({
  value,
  onChangeText,
  placeholder,
  error,
  onSubmitEditing,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  error?: boolean;
  onSubmitEditing?: () => void;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#9ca3af"
      onSubmitEditing={onSubmitEditing}
      returnKeyType={onSubmitEditing ? "done" : undefined}
      blurOnSubmit={!onSubmitEditing}
      className={`h-11 rounded-xl border bg-white px-3.5 text-base text-neutral-900 ${
        error ? "border-red-400" : "border-neutral-300"
      }`}
      style={{ height: 44, paddingVertical: 0 }}
    />
  );
}

// ── Month / year ────────────────────────────────────────────────────────────

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function yearsFor(futureOnly: boolean): string[] {
  const now = new Date().getFullYear();
  const out: string[] = [];
  if (futureOnly) for (let y = now; y <= now + 20; y++) out.push(String(y));
  else for (let y = now; y >= 1950; y--) out.push(String(y));
  return out;
}

/**
 * "YYYY-MM" picker — Practice `MonthYearSelector`. Picking only a month
 * defaults the year to this year; only a year defaults the month to January.
 * `futureOnly` (insurance validity) hides past years and, this year, past months.
 */
export function MonthYearField({
  value,
  onChange,
  futureOnly = false,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  futureOnly?: boolean;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [year, month] = value.length === 7 ? value.split("-") : ["", ""];
  const now = new Date();
  const thisYear = String(now.getFullYear());
  const thisMonth = now.getMonth() + 1;
  const years = yearsFor(futureOnly);
  const monthAllowed = (m: number) =>
    !futureOnly || !year || year !== thisYear || m >= thisMonth;

  const label =
    month && year ? `${MONTHS[Number(month) - 1] ?? month} ${year}` : "Select month and year";

  const pickMonth = (m: number) => {
    const mm = String(m).padStart(2, "0");
    onChange(`${year || thisYear}-${mm}`);
  };
  const pickYear = (y: string) => {
    let mm = month || "01";
    if (futureOnly && y === thisYear && Number(mm) < thisMonth) {
      mm = String(thisMonth).padStart(2, "0");
    }
    onChange(`${y}-${mm}`);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        className={`h-10 flex-row items-center gap-2 self-start rounded-lg border bg-white px-3 ${
          error ? "border-red-400" : "border-neutral-300"
        }`}
      >
        <Ionicons name="calendar-outline" size={14} color="#6b7280" />
        <Text className={`text-sm ${value ? "text-neutral-900" : "text-neutral-400"}`}>
          {label}
        </Text>
      </Pressable>

      <AppModal
        visible={open}
        transparent
        animationType="fade"
        androidSafeArea={false}
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          className="flex-1 items-center justify-center bg-black/40 px-4"
        >
          <Pressable
            onPress={() => {}}
            style={{ width: "100%", maxWidth: 440, maxHeight: "75%" }}
            className="overflow-hidden rounded-2xl bg-white"
          >
            <View className="flex-row items-center justify-between border-b border-neutral-200 px-4 py-3">
              <Text className="text-base font-semibold text-neutral-900">{label}</Text>
              <View className="flex-row items-center gap-4">
                {value ? (
                  <Pressable
                    onPress={() => {
                      onChange("");
                      setOpen(false);
                    }}
                    hitSlop={8}
                  >
                    <Text className="text-sm font-medium text-neutral-500">Clear</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                  <Text className="text-sm font-semibold text-brand">Done</Text>
                </Pressable>
              </View>
            </View>
            <View className="flex-row" style={{ maxHeight: 360 }}>
              <ScrollView className="flex-1 border-r border-neutral-100">
                <Text className="px-4 pt-3 text-xs font-semibold uppercase text-neutral-500">
                  Month
                </Text>
                {MONTHS.map((name, i) => {
                  const m = i + 1;
                  if (!monthAllowed(m)) return null;
                  const active = Number(month) === m;
                  return (
                    <Pressable
                      key={name}
                      onPress={() => pickMonth(m)}
                      className={`px-4 py-2.5 ${active ? "bg-brand/10" : "active:bg-neutral-50"}`}
                    >
                      <Text
                        className={`text-sm ${active ? "font-semibold text-brand" : "text-neutral-800"}`}
                      >
                        {name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <ScrollView className="flex-1">
                <Text className="px-4 pt-3 text-xs font-semibold uppercase text-neutral-500">
                  Year
                </Text>
                {years.map((y) => {
                  const active = y === year;
                  return (
                    <Pressable
                      key={y}
                      onPress={() => pickYear(y)}
                      className={`px-4 py-2.5 ${active ? "bg-brand/10" : "active:bg-neutral-50"}`}
                    >
                      <Text
                        className={`text-sm ${active ? "font-semibold text-brand" : "text-neutral-800"}`}
                      >
                        {y}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </AppModal>
    </>
  );
}

// ── Medicines ───────────────────────────────────────────────────────────────

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Medicine chips + catalogue search — Practice step 2 autocomplete over
 * `POST /api/drug/search`, labelled "Brand (Generic)". Enter adds the typed
 * text when nothing matches.
 */
export function MedicineInput({
  medicines,
  onChange,
}: {
  medicines: string[];
  onChange: (next: string[]) => void;
}) {
  const facilityId = useFacilityId();
  const [text, setText] = useState("");
  const term = useDebounced(text.trim(), 300);

  const q = useQuery({
    queryKey: ["medicines-search", facilityId, term],
    enabled: term.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await searchDrugs({
        facilityId: facilityId ?? undefined,
        page: 1,
        pageSize: 20,
        search: term,
      });
      return res.drugs
        .map((d) =>
          d.brandName && d.genericName
            ? `${d.brandName} (${d.genericName})`
            : d.brandName || d.genericName || ""
        )
        .filter(Boolean);
    },
  });
  const suggestions = (q.data ?? []).filter((m) => !medicines.includes(m));

  const add = (name: string) => {
    const n = name.trim();
    if (n && !medicines.includes(n)) onChange([...medicines, n]);
    setText("");
  };

  return (
    <View className="gap-2">
      {medicines.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {medicines.map((m) => (
            <View
              key={m}
              className="flex-row items-center gap-1.5 rounded-full bg-neutral-100 py-1 pl-3 pr-1.5"
            >
              <Text className="text-sm text-neutral-800">{m}</Text>
              <Pressable
                onPress={() => onChange(medicines.filter((x) => x !== m))}
                hitSlop={8}
                accessibilityLabel={`Remove ${m}`}
                className="rounded-full p-0.5"
              >
                <Ionicons name="close" size={14} color="#6b7280" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <Input
        value={text}
        onChangeText={setText}
        placeholder="Type to search medicines..."
        onSubmitEditing={() => {
          if (suggestions[0] && suggestions[0].toLowerCase() === text.trim().toLowerCase()) {
            add(suggestions[0]);
          } else add(text);
        }}
      />

      {text.trim() ? (
        <View className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {q.isFetching && !q.data ? (
            <View className="flex-row items-center justify-center gap-2 p-3">
              <ActivityIndicator size="small" color={BRAND} />
              <Text className="text-sm text-neutral-500">Searching...</Text>
            </View>
          ) : suggestions.length > 0 ? (
            <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
              {suggestions.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => add(m)}
                  className="border-b border-neutral-100 px-3 py-2.5 active:bg-neutral-50"
                >
                  <Text className="text-sm text-neutral-800">{m}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Pressable onPress={() => add(text)} className="px-3 py-2.5 active:bg-neutral-50">
              <Text className="text-sm text-neutral-500">
                No medicines found. Tap to add &quot;{text.trim()}&quot;
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}
