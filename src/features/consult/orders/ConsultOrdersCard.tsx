import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppModal, Button, Segmented } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { useRealtimeToastStore } from "@/lib/realtime/toastStore";
import type {
  OrderDestination,
  OrdersView,
  OrderTabView,
  OrderService,
} from "@/lib/api/endpoints/orders";

import {
  useAddOrderLine,
  useConsultOrders,
  useInvalidateConsultOrders,
  useOrderDestinations,
  usePatchOrderDraft,
  useReceivingDoctors,
  useRemoveOrderLine,
  useSendOrderTab,
} from "./hooks";
import {
  ADMISSION_WARDS,
  catalogueFor,
  formatOrderDateTime,
  formatOrderRupees,
  ORDER_KIND_META,
  ORDER_KINDS,
  ORDER_PRIORITIES,
  REFERRAL_STATUS_LABEL,
  sameOrderLine,
  type OrderDraft,
  type OrderKind,
} from "./orders";

const BRAND = "#FD006A";
const SUGGESTION_LIMIT = 12;

function toast(title: string, tone: "success" | "error" = "success") {
  useRealtimeToastStore.getState().show({
    id: `orders-${Date.now()}`,
    title,
    tone,
  });
}

/**
 * Orders & referrals, inline on the consult — the Care port of Practice
 * `components/consult/orders/consult-orders-card.tsx`, on the same API.
 *
 * One tab per kind of order, each with its own draft. Lines print on the
 * prescription as soon as they are added. A tab with a destination can be
 * sent now; anything not sent goes out when the consult is completed. A tab
 * left on "Print only" is never sent. The clinic's own rate-card services
 * come first and, done in-house, are billed. Day care goes on the bill.
 */
export function ConsultOrdersCard({
  consultationId,
  facilityId,
}: {
  consultationId: string;
  facilityId: string;
}) {
  const [active, setActive] = useState<OrderKind>("LAB");
  const q = useConsultOrders(consultationId);
  const afterChange = useInvalidateConsultOrders(consultationId);

  if (q.isPending) {
    return (
      <View className="flex-row items-center gap-2 py-6">
        <ActivityIndicator color={BRAND} />
        <Text className="text-sm text-neutral-500">Loading orders…</Text>
      </View>
    );
  }
  if (q.isError || !q.data) {
    return (
      <View className="flex-row items-center justify-between gap-2 rounded-xl border border-dashed border-neutral-300 p-3">
        <Text className="flex-1 text-sm text-neutral-500">
          Could not load orders.
        </Text>
        <Button
          label="Try again"
          variant="outline"
          size="md"
          onPress={() => void q.refetch()}
        />
      </View>
    );
  }

  const data = q.data;

  return (
    <View className="gap-3">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        className="border-b border-neutral-200"
      >
        {ORDER_KINDS.map((kind) => {
          const tab = data.tabs[kind];
          const unsent = tab.lines.length;
          const done = tab.sent.length + tab.billed.length > 0;
          const isActive = kind === active;
          return (
            <Pressable
              key={kind}
              onPress={() => setActive(kind)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={{ flexGrow: 1, minWidth: 96 }}
              className={`min-h-[48px] flex-row items-center justify-center gap-1.5 border-b-2 px-4 ${
                isActive ? "border-brand" : "border-transparent"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  isActive ? "text-neutral-900" : "text-neutral-600"
                }`}
              >
                {ORDER_KIND_META[kind].label}
              </Text>
              {unsent > 0 ? (
                <View className="min-w-[20px] items-center rounded-full bg-brand px-1.5">
                  <Text className="text-[11px] font-semibold leading-5 text-white">
                    {unsent}
                  </Text>
                </View>
              ) : done ? (
                <Ionicons
                  name="checkmark-circle-outline"
                  size={15}
                  color="#059669"
                  accessibilityLabel="sent"
                />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {data.locked ? (
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="lock-closed-outline" size={14} color="#6b7280" />
          <Text className="text-xs text-neutral-500">
            This consult is completed. Reopen it to add or send orders.
          </Text>
        </View>
      ) : null}

      <OrderTab
        key={active}
        kind={active}
        consultationId={consultationId}
        facilityId={facilityId}
        tab={data.tabs[active]}
        recent={data.recent[active] ?? []}
        services={data.services[active] ?? []}
        locked={data.locked}
        onChanged={afterChange}
      />
    </View>
  );
}

type Suggestion = {
  key: string;
  name: string;
  service: OrderService | null;
  recent: boolean;
};

function OrderTab({
  kind,
  consultationId,
  facilityId,
  tab,
  recent,
  services,
  locked,
  onChanged,
}: {
  kind: OrderKind;
  consultationId: string;
  facilityId: string;
  tab: OrdersView["tabs"][OrderKind];
  recent: string[];
  services: OrderService[];
  locked: boolean;
  onChanged: () => Promise<void>;
}) {
  const meta = ORDER_KIND_META[kind];
  const [query, setQuery] = useState("");
  const [picker, setPicker] = useState<null | "destination" | "doctor" | "ward">(
    null
  );
  const { draft, lines, sent, billed } = tab;
  const isDayCare = kind === "DAYCARE";
  const isAdmission = kind === "ADMISSION";

  const destinationsQ = useOrderDestinations(
    facilityId,
    meta.referralType,
    !locked && !isDayCare
  );
  const options = destinationsQ.data ?? [];
  const destination =
    options.find((o) => o.id === draft.destinationFacilityId) ?? null;
  const needsDoctor =
    kind === "SPECIALIST" && destination != null && !destination.partner;
  const doctorsQ = useReceivingDoctors(
    facilityId,
    destination?.id ?? null,
    needsDoctor && !locked
  );

  const addLine = useAddOrderLine(consultationId, kind);
  const removeLine = useRemoveOrderLine(consultationId);
  const patchDraft = usePatchOrderDraft(consultationId, kind);
  const send = useSendOrderTab(consultationId, kind);

  const add = (input: { testName?: string; treatmentTypeId?: string }) => {
    if (addLine.isPending) return;
    addLine.mutate(input, {
      onSuccess: async () => {
        setQuery("");
        await onChanged();
      },
      onError: (e) => toast(describeError(e), "error"),
    });
  };

  const remove = (id: string) =>
    removeLine.mutate(id, {
      onSuccess: () => void onChanged(),
      onError: (e) => toast(describeError(e), "error"),
    });

  const patch = (p: Partial<OrderDraft>) =>
    patchDraft.mutate(p, {
      onSuccess: () => void onChanged(),
      onError: async (e) => {
        toast(describeError(e), "error");
        await onChanged();
      },
    });

  const runSend = () =>
    send.mutate(undefined, {
      onSuccess: async (res) => {
        const r = res.sent[0];
        const billNote =
          r && r.billed > 0
            ? ` · ${r.billed} added to the bill`
            : r && r.unpriced > 0
              ? ` · ${r.unpriced} not priced, not billed`
              : "";
        toast(
          isDayCare
            ? `Added to the bill${r && r.unpriced > 0 ? ` (${r.unpriced} not priced)` : ""}`
            : `${meta.label} order sent to ${destination?.name ?? "the provider"}${billNote}`
        );
        await onChanged();
      },
      onError: (e) => toast(describeError(e), "error"),
    });

  // Every name already ordered on this consult — the server refuses a repeat.
  const taken = useCallback(
    (name: string) =>
      lines.some((l) => sameOrderLine(l.testName, name)) ||
      sent.some((s) => s.lines.some((n) => sameOrderLine(n, name))) ||
      billed.some((b) => sameOrderLine(b.testName, name)),
    [lines, sent, billed]
  );

  // Clinic services first (priced, billed in-house), then recent picks, then the standard list.
  const suggestions = useMemo((): Suggestion[] => {
    const qq = query.trim().toLowerCase();
    const match = (name: string) =>
      !taken(name) && (!qq || name.toLowerCase().includes(qq));
    const serviceChips: Suggestion[] = services
      .filter((s) => match(s.name))
      .map((s) => ({
        key: `s:${s.treatmentTypeId}`,
        name: s.name,
        service: s,
        recent: false,
      }));
    if (isDayCare) return serviceChips.slice(0, SUGGESTION_LIMIT);
    const isService = (name: string) =>
      services.some((s) => sameOrderLine(s.name, name));
    const recentChips: Suggestion[] = recent
      .filter((n) => match(n) && !isService(n))
      .map((n) => ({ key: `r:${n}`, name: n, service: null, recent: true }));
    const standardChips: Suggestion[] = catalogueFor(kind)
      .filter(
        (n) =>
          match(n) && !isService(n) && !recent.some((r) => sameOrderLine(r, n))
      )
      .map((n) => ({ key: `c:${n}`, name: n, service: null, recent: false }));
    return [...serviceChips, ...recentChips, ...standardChips].slice(
      0,
      SUGGESTION_LIMIT
    );
  }, [query, services, recent, kind, isDayCare, taken]);

  const typed = query.trim();
  const typedIsNew =
    !isDayCare &&
    typed.length >= 2 &&
    !taken(typed) &&
    !suggestions.some((s) => sameOrderLine(s.name, typed));

  const submitTyped = () => {
    if (!typed || addLine.isPending) return;
    const exact = suggestions.find((s) => sameOrderLine(s.name, typed));
    if (exact?.service) add({ treatmentTypeId: exact.service.treatmentTypeId });
    else if (!isDayCare) add({ testName: exact?.name ?? typed });
  };

  const busy = removeLine.isPending || send.isPending;
  const canSend =
    !locked &&
    lines.length > 0 &&
    (isDayCare ||
      (destination != null && (!needsDoctor || !!draft.toDoctorId)));
  const admissionAdvised = isAdmission && lines.length > 0;

  const sendLabel = isDayCare
    ? "Add to bill"
    : isAdmission
      ? "Send admission request"
      : `Send ${lines.length} ${lines.length === 1 ? meta.itemNoun : `${meta.itemNoun}s`}`;

  return (
    <View className="gap-3">
      {!locked && isAdmission && !admissionAdvised ? (
        <AdmissionStart
          disabled={addLine.isPending}
          onAdvise={(reason) => add({ testName: reason })}
        />
      ) : null}

      {!locked && !isAdmission ? (
        <View className="gap-2">
          <View className="flex-row gap-2">
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={submitTyped}
              returnKeyType="done"
              blurOnSubmit={false}
              placeholder={
                isDayCare
                  ? "Search day-care procedures…"
                  : `Search or type a ${meta.itemNoun}…`
              }
              placeholderTextColor="#9ca3af"
              accessibilityLabel={`Add ${meta.itemNoun}`}
              className="min-h-[48px] flex-1 rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900"
            />
            {typedIsNew ? (
              <Pressable
                onPress={submitTyped}
                disabled={addLine.isPending}
                className="min-h-[48px] flex-row items-center gap-1 rounded-xl border border-neutral-300 px-3 active:bg-neutral-100"
              >
                <Ionicons name="add" size={18} color="#374151" />
                <Text className="text-sm font-medium text-neutral-800">
                  Add “{typed.length > 18 ? `${typed.slice(0, 18)}…` : typed}”
                </Text>
              </Pressable>
            ) : null}
          </View>

          {suggestions.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {suggestions.map((s) => (
                <Pressable
                  key={s.key}
                  disabled={addLine.isPending}
                  onPress={() =>
                    add(
                      s.service
                        ? { treatmentTypeId: s.service.treatmentTypeId }
                        : { testName: s.name }
                    )
                  }
                  accessibilityHint={
                    s.service ? "In-house service on your rate card" : undefined
                  }
                  className={`min-h-[36px] flex-row items-center gap-1 rounded-full border px-3 py-1.5 ${
                    s.service
                      ? "border-emerald-600/40 bg-emerald-50"
                      : s.recent
                        ? "border-brand/40 bg-brand/5"
                        : "border-neutral-200 bg-white"
                  } ${addLine.isPending ? "opacity-50" : ""}`}
                >
                  <Ionicons name="add" size={13} color="#6b7280" />
                  <Text className="text-xs text-neutral-800">{s.name}</Text>
                  {s.service ? (
                    <Text className="text-xs text-neutral-500">
                      ·{" "}
                      {s.service.fee != null
                        ? formatOrderRupees(s.service.fee)
                        : "not priced"}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : isDayCare && services.length === 0 ? (
            <Text className="text-xs text-neutral-500">
              No day-care procedures set up. Ask your facility admin to mark
              services as “Day care” in Practice → Facility → Clinic → Service
              Rate Card.
            </Text>
          ) : null}
        </View>
      ) : null}

      {lines.length > 0 ? (
        <View
          className="flex-row flex-wrap gap-2"
          accessibilityLabel={`${meta.label} orders not yet sent`}
        >
          {lines.map((l) => (
            <View
              key={l.id}
              className="flex-row items-center gap-1 rounded-lg border border-brand/30 bg-brand/10 py-1.5 pl-3 pr-1"
            >
              <Text className="text-sm font-medium text-neutral-900">
                {l.testName}
                {l.instructions ? (
                  <Text className="font-normal text-neutral-500">
                    {" "}
                    ({l.instructions})
                  </Text>
                ) : null}
                {l.treatmentTypeId && l.feeRupees != null ? (
                  <Text className="font-normal text-neutral-500">
                    {" "}
                    · {formatOrderRupees(l.feeRupees)}
                  </Text>
                ) : null}
              </Text>
              {!locked ? (
                <Pressable
                  onPress={() => remove(l.id)}
                  disabled={removeLine.isPending}
                  hitSlop={8}
                  accessibilityLabel={`Remove ${l.testName}`}
                  className="h-7 w-7 items-center justify-center rounded"
                >
                  <Ionicons name="close" size={16} color="#374151" />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : sent.length === 0 &&
        billed.length === 0 &&
        (locked || !isAdmission) ? (
        <Text className="text-sm text-neutral-500">
          No {meta.label.toLowerCase()} orders yet.
        </Text>
      ) : null}

      {!locked && lines.length > 0 ? (
        <View className="gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          {!isDayCare ? (
            <>
              <View className="gap-1">
                <Text className="text-xs font-medium text-neutral-500">
                  {isAdmission ? "Admit at" : "Send to"}
                </Text>
                <SelectButton
                  label={
                    destination
                      ? `${destination.label}${destination.source === "recent" ? " · used before" : ""}`
                      : isAdmission
                        ? "Print only — advise the patient"
                        : "Print only — patient chooses"
                  }
                  loading={destinationsQ.isPending}
                  disabled={busy}
                  onPress={() => setPicker("destination")}
                />
                {destinationsQ.isSuccess && options.length === 0 ? (
                  <Text className="text-xs text-neutral-500">
                    No{" "}
                    {isAdmission
                      ? "admission hospitals"
                      : `${meta.label.toLowerCase()} providers`}{" "}
                    set up — ask your facility admin (Practice → Facility →
                    Clinic → Referral providers).
                  </Text>
                ) : null}
              </View>
              <View className="gap-1">
                <Text className="text-xs font-medium text-neutral-500">
                  {isAdmission ? "Urgency" : "Priority"}
                </Text>
                <Segmented
                  options={ORDER_PRIORITIES}
                  value={draft.priority}
                  onChange={(v) => patch({ priority: v })}
                  disabled={busy}
                />
              </View>
            </>
          ) : null}

          {isAdmission ? (
            <View className="flex-row gap-3">
              <View className="flex-1 gap-1">
                <Text className="text-xs font-medium text-neutral-500">
                  Ward
                </Text>
                <SelectButton
                  label={draft.ward ?? "Choose a ward"}
                  placeholder={!draft.ward}
                  disabled={busy}
                  onPress={() => setPicker("ward")}
                />
              </View>
              <StayField
                key={`stay-${draft.expectedStayDays ?? ""}`}
                initial={draft.expectedStayDays}
                disabled={busy}
                onSave={(days) => patch({ expectedStayDays: days })}
              />
            </View>
          ) : null}

          {needsDoctor ? (
            <View className="gap-1">
              <Text className="text-xs font-medium text-neutral-500">
                Doctor
              </Text>
              <SelectButton
                label={
                  draft.toDoctorName ??
                  (doctorsQ.isPending ? "Loading doctors…" : "Choose the doctor")
                }
                placeholder={!draft.toDoctorId}
                loading={doctorsQ.isPending}
                disabled={busy || doctorsQ.isPending}
                onPress={() => setPicker("doctor")}
              />
            </View>
          ) : null}

          {!isDayCare ? (
            <NoteField
              key={`${kind}-${draft.note}`}
              initial={draft.note}
              disabled={busy}
              placeholder={
                isAdmission
                  ? "e.g. Needs IV antibiotics; diabetic"
                  : "e.g. Fasting sample; suspected hypothyroidism"
              }
              onSave={(note) => patch({ note })}
            />
          ) : null}

          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Text className="min-w-0 flex-1 text-xs text-neutral-500">
              {sendHint({ isDayCare, destination, lines })}
            </Text>
            <Button
              label={sendLabel}
              size="md"
              onPress={runSend}
              loading={send.isPending}
              disabled={
                !canSend || busy || patchDraft.isPending || addLine.isPending
              }
              icon={
                <Ionicons
                  name={isDayCare ? "receipt-outline" : "send"}
                  size={15}
                  color="#fff"
                />
              }
            />
          </View>
        </View>
      ) : null}

      {sent.length > 0 ? (
        <View className="gap-2" accessibilityLabel={`${meta.label} orders sent`}>
          {sent.map((s) => (
            <View
              key={s.referralId}
              className="rounded-xl border border-neutral-200 px-3 py-2.5"
            >
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                <Text className="min-w-0 flex-1 text-sm font-semibold text-neutral-900">
                  Sent to {s.toFacilityName}
                  {s.toDoctorName ? ` · ${s.toDoctorName}` : ""}
                </Text>
                <View
                  className={`rounded-md px-2 py-0.5 ${
                    s.status === "cancelled" ? "bg-red-100" : "bg-neutral-200"
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      s.status === "cancelled"
                        ? "text-red-700"
                        : "text-neutral-700"
                    }`}
                  >
                    {REFERRAL_STATUS_LABEL[s.status] ?? s.status}
                  </Text>
                </View>
              </View>
              <Text className="mt-0.5 text-xs text-neutral-500">
                {s.lines.join(", ") || "—"} · {formatOrderDateTime(s.sentAt)}
                {s.sentVia === "complete" ? " · on Complete" : ""}
                {s.priority && s.priority !== "routine"
                  ? ` · ${s.priority.toUpperCase()}`
                  : ""}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {billed.length > 0 ? (
        <View className="gap-2" accessibilityLabel={`${meta.label} on the bill`}>
          {billed.map((b) => (
            <View
              key={b.id}
              className="flex-row flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 px-3 py-2.5"
            >
              <Text className="text-sm font-semibold text-neutral-900">
                {b.testName}
              </Text>
              <Text className="text-xs text-neutral-500">
                {b.billed ? "On the bill" : "Done · not priced"} ·{" "}
                {formatOrderDateTime(b.sentAt)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <OptionSheet
        open={picker === "destination"}
        title={isAdmission ? "Admit at" : "Send to"}
        onClose={() => setPicker(null)}
        selectedId={draft.destinationFacilityId ?? PRINT_ONLY}
        options={[
          {
            id: PRINT_ONLY,
            label: isAdmission
              ? "Print only — advise the patient"
              : "Print only — patient chooses",
          },
          ...options.map((o) => ({
            id: o.id,
            label: o.label,
            detail: o.source === "recent" ? "Used before" : undefined,
          })),
        ]}
        onSelect={(id) =>
          patch({ destinationFacilityId: id === PRINT_ONLY ? null : id })
        }
      />
      <OptionSheet
        open={picker === "ward"}
        title="Ward"
        onClose={() => setPicker(null)}
        selectedId={draft.ward ?? ""}
        options={ADMISSION_WARDS.map((w) => ({ id: w, label: w }))}
        onSelect={(id) => patch({ ward: id as OrderDraft["ward"] })}
      />
      <OptionSheet
        open={picker === "doctor"}
        title="Doctor"
        onClose={() => setPicker(null)}
        selectedId={draft.toDoctorId ?? ""}
        emptyText="No doctors found at this facility."
        options={(doctorsQ.data ?? []).map((d) => ({
          id: d.id,
          label: d.name,
          detail: d.specialization ?? undefined,
        }))}
        onSelect={(id) => {
          const d = doctorsQ.data?.find((x) => x.id === id);
          patch({
            toDoctorId: id,
            toDoctorName: d
              ? [d.name, d.specialization].filter(Boolean).join(" — ")
              : null,
          });
        }}
      />
    </View>
  );
}

const PRINT_ONLY = "__print_only__";

function sendHint({
  isDayCare,
  destination,
  lines,
}: {
  isDayCare: boolean;
  destination: OrderDestination | null;
  lines: OrderTabView["lines"];
}): string {
  if (isDayCare) {
    return "Goes on this visit's bill at the rate-card price. Added automatically on Complete.";
  }
  if (!destination) return "Prints on the prescription. Nothing is sent.";
  const later = "Not sent yet — it goes out on Complete if you don't send now.";
  if (destination.source === "internal") {
    const priced = lines.filter(
      (l) => l.treatmentTypeId && l.feeRupees != null && l.feeRupees > 0
    ).length;
    return priced > 0
      ? `Done in this clinic; ${priced} priced ${priced === 1 ? "item goes" : "items go"} on the bill. ${later}`
      : `Done in this clinic. ${later}`;
  }
  return `Prints “Referred to ${destination.name}”. ${later}`;
}

/** The first step of the Admission tab: why. Ward, stay and where come next. */
function AdmissionStart({
  disabled,
  onAdvise,
}: {
  disabled: boolean;
  onAdvise: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const ok = reason.trim().length >= 3;
  return (
    <View className="gap-1.5">
      <Text className="text-xs font-medium text-neutral-500">
        Reason for admission
      </Text>
      <View className="flex-row gap-2">
        <TextInput
          value={reason}
          onChangeText={setReason}
          onSubmitEditing={() => ok && onAdvise(reason.trim())}
          placeholder="e.g. Dengue with low platelets"
          placeholderTextColor="#9ca3af"
          className="min-h-[48px] flex-1 rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900"
        />
        <Button
          label="Advise admission"
          size="md"
          onPress={() => onAdvise(reason.trim())}
          disabled={!ok || disabled}
          loading={disabled}
        />
      </View>
    </View>
  );
}

function StayField({
  initial,
  disabled,
  onSave,
}: {
  initial: number | null;
  disabled: boolean;
  onSave: (days: number | null) => void;
}) {
  const [value, setValue] = useState(initial ? String(initial) : "");
  return (
    <View className="flex-1 gap-1">
      <Text className="text-xs font-medium text-neutral-500">
        Expected stay (days)
      </Text>
      <TextInput
        value={value}
        editable={!disabled}
        keyboardType="number-pad"
        onChangeText={(t) => setValue(t.replace(/\D/g, "").slice(0, 3))}
        onBlur={() => {
          const days = value ? Number(value) : null;
          if (days !== initial) onSave(days);
        }}
        placeholder="e.g. 3"
        placeholderTextColor="#9ca3af"
        className="min-h-[48px] rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900"
      />
    </View>
  );
}

/** Saved on blur, so typing a note does not write on every key. */
function NoteField({
  initial,
  disabled,
  placeholder,
  onSave,
}: {
  initial: string;
  disabled: boolean;
  placeholder: string;
  onSave: (note: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <View className="gap-1">
      <Text className="text-xs font-medium text-neutral-500">
        Note for the provider <Text className="font-normal">(optional)</Text>
      </Text>
      <TextInput
        value={value}
        editable={!disabled}
        multiline
        numberOfLines={2}
        onChangeText={setValue}
        onBlur={() => {
          if (value.trim() !== initial.trim()) onSave(value.trim());
        }}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        style={{ minHeight: 64, textAlignVertical: "top" }}
        className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
      />
    </View>
  );
}

function SelectButton({
  label,
  onPress,
  disabled,
  loading,
  placeholder,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={`min-h-[48px] flex-row items-center justify-between gap-2 rounded-xl border border-neutral-300 bg-white px-3 ${
        disabled ? "opacity-50" : "active:bg-neutral-50"
      }`}
    >
      <Text
        numberOfLines={1}
        className={`min-w-0 flex-1 text-base ${
          placeholder ? "text-neutral-400" : "text-neutral-900"
        }`}
      >
        {label}
      </Text>
      {loading ? (
        <ActivityIndicator size="small" color={BRAND} />
      ) : (
        <Ionicons name="chevron-down" size={18} color="#6b7280" />
      )}
    </Pressable>
  );
}

function OptionSheet({
  open,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
  emptyText,
}: {
  open: boolean;
  title: string;
  options: { id: string; label: string; detail?: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  emptyText?: string;
}) {
  return (
    <AppModal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      androidSafeArea={false}
    >
      <Pressable
        onPress={onClose}
        className="flex-1 items-center justify-center bg-black/40 px-4"
      >
        <Pressable
          onPress={() => {}}
          style={{ width: "100%", maxWidth: 480, maxHeight: "75%" }}
          className="overflow-hidden rounded-2xl bg-white"
        >
          <View className="flex-row items-center justify-between border-b border-neutral-200 px-4 py-3">
            <Text className="text-base font-semibold text-neutral-900">
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </Pressable>
          </View>
          <ScrollView>
            {options.length === 0 ? (
              <Text className="px-4 py-6 text-center text-sm text-neutral-500">
                {emptyText ?? "Nothing to choose."}
              </Text>
            ) : (
              options.map((o) => {
                const selected = o.id === selectedId;
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => {
                      onClose();
                      if (!selected) onSelect(o.id);
                    }}
                    className={`min-h-[52px] flex-row items-center gap-3 border-b border-neutral-100 px-4 py-3 ${
                      selected ? "bg-brand/5" : "active:bg-neutral-50"
                    }`}
                  >
                    <View className="min-w-0 flex-1">
                      <Text className="text-base text-neutral-900">
                        {o.label}
                      </Text>
                      {o.detail ? (
                        <Text className="text-xs text-neutral-500">
                          {o.detail}
                        </Text>
                      ) : null}
                    </View>
                    {selected ? (
                      <Ionicons name="checkmark" size={20} color={BRAND} />
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </AppModal>
  );
}
