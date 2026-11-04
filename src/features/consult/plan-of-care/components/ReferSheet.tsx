import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppModal, Button } from "@/ui";
import { AppAlert } from "@/ui/AppAlert";
import { describeError } from "@/lib/api/errors";
import {
  createReferral,
  listReferralFacilities,
  listReceivingDoctors,
  type ReceivingDoctor,
  type ReferralFacility,
} from "@/lib/api/endpoints/referral";
import { useActiveFacility, useFacilityId } from "@/lib/auth/store";

import {
  PRIORITIES,
  REFERRAL_TYPES,
  referralFormError,
  testGroups,
  testsStillAllowed,
  type ReferralType,
} from "../referralForm";

type PickerName = "types" | "priority" | "tests" | "facility" | "doctor";

const PAGE_SIZE = 10;
const LIST_MAX_HEIGHT = 220;

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <Text className="text-sm font-medium text-neutral-900">{children}</Text>
  );
}

function ReadOnlyField({ value }: { value: string }) {
  return (
    <View className="min-h-11 justify-center rounded-lg bg-neutral-100 px-3 py-2">
      <Text className="text-sm text-neutral-900">{value || "—"}</Text>
    </View>
  );
}

function PickerTrigger({
  label,
  placeholder = false,
  open,
  disabled,
  onPress,
}: {
  label: string;
  placeholder?: boolean;
  open: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ expanded: open, disabled: !!disabled }}
      className={`min-h-11 flex-row items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 ${
        open ? "border-brand" : "border-neutral-300"
      } ${disabled ? "opacity-50" : "active:bg-neutral-50"}`}
    >
      <Text
        numberOfLines={2}
        className={`min-w-0 flex-1 text-sm ${
          placeholder ? "text-neutral-500" : "text-neutral-900"
        }`}
      >
        {label}
      </Text>
      <Ionicons name="swap-vertical" size={14} color="#9ca3af" />
    </Pressable>
  );
}

function OptionRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityState={{ selected: !!selected }}
      className="min-h-11 flex-row items-center gap-2 px-3 py-2 active:bg-neutral-50"
    >
      <View style={{ width: 16 }}>
        {selected ? (
          <Ionicons name="checkmark" size={16} color="#FD006A" />
        ) : null}
      </View>
      <Text className="min-w-0 flex-1 text-sm text-neutral-900">{label}</Text>
    </Pressable>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View className="flex-row items-center gap-1 rounded-md bg-neutral-200 py-1 pl-2 pr-1">
      <Text className="shrink text-sm text-neutral-900">{label}</Text>
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        accessibilityLabel={`Remove ${label}`}
        className="p-0.5"
      >
        <Ionicons name="close" size={14} color="#374151" />
      </Pressable>
    </View>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
}) {
  return (
    <View className="flex-row items-center gap-2 border-b border-neutral-200 px-3">
      <Ionicons name="search-outline" size={15} color="#6b7280" />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        autoCorrect={false}
        className="min-w-0 flex-1 text-sm text-neutral-900"
        style={{ height: 44, paddingVertical: 0 }}
      />
    </View>
  );
}

/** Searches on the server, 10 at a time, so the whole list is never pulled. */
function ServerPicker<T>({
  fetchPage,
  getKey,
  getLabel,
  placeholder,
  emptyText,
  onSelect,
}: {
  fetchPage: (
    search: string,
    page: number
  ) => Promise<{ items: T[]; hasMore: boolean }>;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  placeholder: string;
  emptyText: string;
  onSelect: (item: T) => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(
      () => {
        void (async () => {
          setLoading(true);
          setError(null);
          try {
            const data = await fetchPage(search, page);
            if (cancelled) return;
            setItems((prev) =>
              page === 1 ? data.items : [...prev, ...data.items]
            );
            setHasMore(data.hasMore);
          } catch (e) {
            if (!cancelled) setError(describeError(e));
          } finally {
            if (!cancelled) setLoading(false);
          }
        })();
      },
      page === 1 ? 250 : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [fetchPage, search, page]);

  return (
    <View className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <SearchBox
        value={search}
        onChange={(text) => {
          setSearch(text);
          setPage(1);
        }}
        placeholder={placeholder}
      />
      <ScrollView
        style={{ maxHeight: LIST_MAX_HEIGHT }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {items.map((item) => (
          <OptionRow
            key={getKey(item)}
            label={getLabel(item)}
            onPress={() => onSelect(item)}
          />
        ))}
        {!loading && !error && items.length === 0 ? (
          <Text className="px-3 py-3 text-sm text-neutral-500">{emptyText}</Text>
        ) : null}
        {error ? (
          <Text className="px-3 py-3 text-sm text-red-500">{error}</Text>
        ) : null}
        {loading ? (
          <View className="items-center py-3">
            <ActivityIndicator size="small" color="#FD006A" />
          </View>
        ) : null}
        {hasMore && !loading ? (
          <Pressable
            onPress={() => setPage((p) => p + 1)}
            className="items-center py-3 active:bg-neutral-50"
          >
            <Text className="text-sm font-medium text-brand">Load more</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * Create Referral (Practice ReferralFormDialog, as the consult page opens it): doctor
 * and patient come from the consult and are read-only. The lists open inside the form
 * rather than as a second pop-up over it.
 */
export function ReferSheet({
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
  onClose: () => void;
  patientId?: string;
  patientName: string;
  /** Whole years, or null when unknown. The API takes 0 for unknown. */
  patientAge: number | null;
  patientGender?: string;
  patientPhone?: string;
  doctorId?: string;
  doctorName?: string;
  onCreated?: () => void;
}) {
  const facilityId = useFacilityId() ?? "";
  const facility = useActiveFacility();
  const screen = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [notes, setNotes] = useState("");
  const [types, setTypes] = useState<ReferralType[]>(["Lab"]);
  const [priority, setPriority] = useState<string>("routine");
  const [tests, setTests] = useState<string[]>([]);
  const [toFacility, setToFacility] = useState<ReferralFacility | null>(null);
  const [toDoctor, setToDoctor] = useState<ReceivingDoctor | null>(null);
  const [testQuery, setTestQuery] = useState("");
  const [openPicker, setOpenPicker] = useState<PickerName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSpecialist = types.includes("Specialist");

  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(
      ios ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      ios ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const togglePicker = (name: PickerName) => {
    setTestQuery("");
    setOpenPicker((cur) => (cur === name ? null : name));
  };

  const applyTypes = (next: ReferralType[]) => {
    setTypes(next);
    setTests((prev) => testsStillAllowed(prev, next));
    if (!next.includes("Specialist")) setToDoctor(null);
  };

  const toggleType = (type: ReferralType) => {
    applyTypes(
      types.includes(type)
        ? types.filter((t) => t !== type)
        : [...types, type]
    );
  };

  const toggleTest = (test: string) => {
    setTests((prev) =>
      prev.includes(test) ? prev.filter((t) => t !== test) : [...prev, test]
    );
  };

  const fetchFacilities = useCallback(
    async (search: string, page: number) => {
      const data = await listReferralFacilities({
        search,
        page,
        pageSize: PAGE_SIZE,
      });
      // A clinic does not refer to itself.
      return {
        items: data.items.filter((f) => f.id !== facilityId),
        hasMore: data.hasMore,
      };
    },
    [facilityId]
  );

  const toFacilityId = toFacility?.id ?? "";
  const fetchDoctors = useCallback(
    (search: string, page: number) =>
      listReceivingDoctors({
        fromFacilityId: facilityId,
        toFacilityId,
        search,
        page,
        pageSize: PAGE_SIZE,
      }),
    [facilityId, toFacilityId]
  );

  const doctorLabel = (d: ReceivingDoctor) =>
    `${d.name ?? ""} — ${d.specialization ?? ""}`.trim() || "Doctor";

  const onSubmit = async () => {
    const problem = referralFormError({
      patientName,
      doctorName: doctorName ?? "",
      fromFacilityId: facilityId,
      types,
      tests,
      toFacilityId,
      toDoctorId: toDoctor?.id ?? "",
    });
    setError(problem);
    if (problem || !toFacility) return;

    setSubmitting(true);
    try {
      await createReferral({
        patientName: patientName.trim(),
        patientAge: patientAge ?? 0,
        patientGender: patientGender?.trim() || undefined,
        patientPhone: patientPhone?.trim() || undefined,
        patientId: patientId || undefined,
        referralType: types.join(", "),
        tests,
        priority,
        notes: notes.trim() || undefined,
        doctorName: (doctorName ?? "").trim(),
        doctorId: doctorId || undefined,
        ...(isSpecialist && toDoctor
          ? { toDoctorId: toDoctor.id, toDoctorName: doctorLabel(toDoctor) }
          : {}),
        fromFacilityId: facilityId,
        toFacilityId,
        fromFacilityName: facility?.name || undefined,
        toFacilityName: toFacility.name || undefined,
      });
      onCreated?.();
      Keyboard.dismiss();
      onClose();
      AppAlert.success("Referral issued", "The referral has been created.");
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const groups = testGroups(types, testQuery);

  return (
    <AppModal
      visible
      animationType="fade"
      transparent
      onRequestClose={() => {
        if (!submitting) onClose();
      }}
    >
      <View
        className="flex-1 items-center justify-center bg-black/40 px-4"
        style={{ paddingBottom: keyboardHeight }}
      >
        <View
          className="overflow-hidden rounded-xl bg-white"
          style={{
            width: "100%",
            maxWidth: 1000,
            maxHeight: screen.height - keyboardHeight - 48,
          }}
        >
          <View className="flex-row items-center justify-between border-b border-neutral-200 px-5 py-4">
            <Text className="text-lg font-semibold text-neutral-900">
              Create Referral
            </Text>
            <Pressable
              onPress={onClose}
              disabled={submitting}
              hitSlop={10}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color="#374151" />
            </Pressable>
          </View>

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ padding: 20, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-row flex-wrap gap-4">
              <View className="gap-4" style={{ flexGrow: 1, flexBasis: 300 }}>
                <View className="gap-1.5">
                  <FieldLabel>Referring doctor</FieldLabel>
                  <ReadOnlyField value={doctorName ?? ""} />
                </View>
                <View className="gap-1.5">
                  <FieldLabel>Patient</FieldLabel>
                  <ReadOnlyField
                    value={`${patientName}${patientAge ? `, ${patientAge}y` : ""}`}
                  />
                </View>
              </View>
              <View className="gap-1.5" style={{ flexGrow: 1, flexBasis: 300 }}>
                <FieldLabel>Notes (optional)</FieldLabel>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Notes"
                  placeholderTextColor="#9ca3af"
                  multiline
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                  style={{ minHeight: 88, textAlignVertical: "top" }}
                />
              </View>
            </View>

            <View className="flex-row flex-wrap items-start gap-4">
              <View className="gap-1.5" style={{ flexGrow: 1, flexBasis: 300 }}>
                <FieldLabel>Referral type (select one or more)</FieldLabel>
                {types.length > 0 ? (
                  <View className="flex-row flex-wrap gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
                    {types.map((t) => (
                      <Chip key={t} label={t} onRemove={() => toggleType(t)} />
                    ))}
                  </View>
                ) : null}
                <PickerTrigger
                  label={types.length === 0 ? "Select types…" : "Add more types"}
                  placeholder
                  open={openPicker === "types"}
                  onPress={() => togglePicker("types")}
                />
                {openPicker === "types" ? (
                  <View className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                    {REFERRAL_TYPES.map((t) => (
                      <OptionRow
                        key={t}
                        label={t}
                        selected={types.includes(t)}
                        onPress={() => toggleType(t)}
                      />
                    ))}
                  </View>
                ) : null}
              </View>

              <View className="gap-1.5" style={{ flexGrow: 1, flexBasis: 300 }}>
                <FieldLabel>Priority</FieldLabel>
                <PickerTrigger
                  label={
                    PRIORITIES.find((p) => p.value === priority)?.label ??
                    priority
                  }
                  open={openPicker === "priority"}
                  onPress={() => togglePicker("priority")}
                />
                {openPicker === "priority" ? (
                  <View className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                    {PRIORITIES.map((p) => (
                      <OptionRow
                        key={p.value}
                        label={p.label}
                        selected={priority === p.value}
                        onPress={() => {
                          setPriority(p.value);
                          setOpenPicker(null);
                        }}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            </View>

            <View className="gap-1.5">
              <FieldLabel>Tests / services (select at least one)</FieldLabel>
              <Text className="text-xs text-neutral-500">
                Select referral type(s) above first; tests shown match the
                selected type(s).
              </Text>
              {tests.length > 0 ? (
                <View className="flex-row flex-wrap gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
                  {tests.map((t) => (
                    <Chip key={t} label={t} onRemove={() => toggleTest(t)} />
                  ))}
                </View>
              ) : null}
              <PickerTrigger
                label={
                  types.length === 0
                    ? "Select referral type(s) first"
                    : tests.length === 0
                      ? `Select tests for ${types.join(", ")}`
                      : "Add more tests"
                }
                placeholder
                disabled={types.length === 0}
                open={openPicker === "tests"}
                onPress={() => togglePicker("tests")}
              />
              {openPicker === "tests" && types.length > 0 ? (
                <View className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                  <SearchBox
                    value={testQuery}
                    onChange={setTestQuery}
                    placeholder="Search tests…"
                  />
                  <ScrollView
                    style={{ maxHeight: LIST_MAX_HEIGHT }}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {groups.length === 0 ? (
                      <Text className="px-3 py-3 text-sm text-neutral-500">
                        No tests found.
                      </Text>
                    ) : (
                      groups.map((g) => (
                        <View key={g.type}>
                          <Text className="px-3 pb-1 pt-2.5 text-[11px] font-semibold text-neutral-500">
                            {g.type}
                          </Text>
                          {g.tests.map((t) => (
                            <OptionRow
                              key={t}
                              label={t}
                              selected={tests.includes(t)}
                              onPress={() => toggleTest(t)}
                            />
                          ))}
                        </View>
                      ))
                    )}
                  </ScrollView>
                </View>
              ) : null}
            </View>

            <View className="gap-1.5">
              <View className="flex-row items-center justify-between gap-2">
                <FieldLabel>Refer to facility (required)</FieldLabel>
                {toFacility ? (
                  <Pressable
                    onPress={() => {
                      setToFacility(null);
                      setToDoctor(null);
                    }}
                    hitSlop={8}
                  >
                    <Text className="text-xs font-medium text-brand">Clear</Text>
                  </Pressable>
                ) : null}
              </View>
              <PickerTrigger
                label={toFacility?.name || "Select facility"}
                placeholder={!toFacility}
                open={openPicker === "facility"}
                onPress={() => togglePicker("facility")}
              />
              {openPicker === "facility" ? (
                <ServerPicker<ReferralFacility>
                  fetchPage={fetchFacilities}
                  getKey={(f) => f.id}
                  getLabel={(f) => f.name}
                  placeholder="Search facility…"
                  emptyText="No facility found."
                  onSelect={(f) => {
                    if (f.id !== toFacilityId) setToDoctor(null);
                    setToFacility(f);
                    setOpenPicker(null);
                  }}
                />
              ) : null}
            </View>

            {isSpecialist ? (
              <View className="gap-1.5">
                <View className="flex-row items-center justify-between gap-2">
                  <FieldLabel>
                    Receiving doctor at referred facility{" "}
                    <Text className="text-red-500">*</Text>
                  </FieldLabel>
                  {toDoctor ? (
                    <Pressable onPress={() => setToDoctor(null)} hitSlop={8}>
                      <Text className="text-xs font-medium text-brand">
                        Clear
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text className="text-xs text-neutral-500">
                  Patient will be booked with this doctor when the receiving
                  site creates the appointment.
                </Text>
                {!toFacility ? (
                  <Text className="rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-500">
                    Select &quot;Refer to facility&quot; first to load doctors
                    there.
                  </Text>
                ) : (
                  <>
                    <PickerTrigger
                      label={
                        toDoctor
                          ? doctorLabel(toDoctor)
                          : "Search doctor at receiving facility…"
                      }
                      placeholder={!toDoctor}
                      open={openPicker === "doctor"}
                      onPress={() => togglePicker("doctor")}
                    />
                    {openPicker === "doctor" ? (
                      <ServerPicker<ReceivingDoctor>
                        fetchPage={fetchDoctors}
                        getKey={(d) => d.id}
                        getLabel={doctorLabel}
                        placeholder="Search doctors…"
                        emptyText="No doctors found at this facility."
                        onSelect={(d) => {
                          setToDoctor(d);
                          setOpenPicker(null);
                        }}
                      />
                    ) : null}
                  </>
                )}
              </View>
            ) : null}
          </ScrollView>

          {/* Beside the button that caused it, so a refusal is never off-screen. */}
          {error ? (
            <Text className="border-t border-neutral-200 px-5 pt-3 text-sm text-red-500">
              {error}
            </Text>
          ) : null}
          <View
            className={`flex-row items-center justify-end gap-2 px-5 py-3 ${
              error ? "" : "border-t border-neutral-200"
            }`}
          >
            <Button
              label="Cancel"
              variant="outline"
              size="md"
              disabled={submitting}
              onPress={onClose}
            />
            <Button
              label={submitting ? "Submitting…" : "Issue referral"}
              size="md"
              disabled={submitting}
              onPress={() => void onSubmit()}
            />
          </View>
        </View>
      </View>
    </AppModal>
  );
}
