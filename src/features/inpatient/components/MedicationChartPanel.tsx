import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button, TextField } from "@/ui";
import { describeError, isModuleNotEnabled } from "@/lib/api/errors";
import {
  searchFacilityDrugs,
  type FacilityDrugItem,
} from "@/lib/api/endpoints/drugs";
import { useFacilityId } from "@/lib/auth/store";
import { useRealtimeToastStore } from "@/lib/realtime/toastStore";
import {
  useAccountMedication,
  useFacilityDrugSearch,
  useMedicationChart,
  useRecordDose,
} from "../hooks";
import type { AuditEditor, MedReconciliation } from "../types";
import { drugSearchLabel, formatDateTime } from "../utils";

const ROUTES = ["Oral", "IV", "IM", "SC", "Topical", "Inhaled", "Other"] as const;
const SEARCH_DEBOUNCE_MS = 300;
const LIST_MAX_HEIGHT = 224; // ~14rem
const ROW_SELECTED = "#F1F5F9";
const CARD_BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const BODY = "#1A1A1A";
const BRAND = "#fd006a";
const AMBER_BG = "#FFFBEB";
const AMBER_BORDER = "#FCD34D";

function useDebounced(value: string, delay: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function medToast(
  title: string,
  opts?: { body?: string; tone?: "success" | "warning" | "error" }
) {
  useRealtimeToastStore.getState().show({
    id: `med-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    body: opts?.body,
    tone: opts?.tone ?? "success",
  });
}

function DrugPicker({
  onSelect,
}: {
  onSelect: (drug: FacilityDrugItem) => void;
}) {
  const facilityId = useFacilityId();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const debounced = useDebounced(query, SEARCH_DEBOUNCE_MS);
  const searchQ = useFacilityDrugSearch(debounced, true);

  const drugs = useMemo(
    () => searchQ.data?.pages.flatMap((p) => p.drugs) ?? [],
    [searchQ.data]
  );

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setActiveId(drugs[0]?.id ?? null);
  }, [drugs]);

  const pick = (d: FacilityDrugItem) => {
    onSelect(d);
  };

  const onListScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (contentSize.height <= layoutMeasurement.height) return;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 48) {
      if (searchQ.hasNextPage && !searchQ.isFetchingNextPage) {
        void searchQ.fetchNextPage();
      }
    }
  };

  const showInitialLoading =
    searchQ.isPending || (searchQ.isFetching && drugs.length === 0);
  const showEmpty =
    !showInitialLoading && !searchQ.isError && drugs.length === 0;

  return (
    <View>
      <TextInput
        ref={inputRef}
        value={query}
        onChangeText={setQuery}
        placeholder="Scan the pack, or search by name…"
        placeholderTextColor="#9ca3af"
        autoFocus
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        className="h-12 rounded-lg border border-neutral-300 bg-white px-4 text-base text-neutral-900"
        style={{
          height: 48,
          minHeight: 48,
          textAlignVertical: "center",
          paddingVertical: 0,
        }}
        onSubmitEditing={() => {
          void (async () => {
            if (submitting) return;
            const q = query.trim();
            if (q === debounced && drugs[0]) {
              pick(drugs[0]);
              return;
            }
            if (!facilityId) return;
            setSubmitting(true);
            try {
              const page = await searchFacilityDrugs(facilityId, {
                q,
                page: 1,
                pageSize: 10,
              });
              if (page.drugs[0]) pick(page.drugs[0]);
            } catch {
              if (drugs[0]) pick(drugs[0]);
            } finally {
              setSubmitting(false);
            }
          })();
        }}
      />

      <View
        className="mt-1 overflow-hidden rounded-lg border"
        style={{ borderColor: CARD_BORDER }}
      >
        {searchQ.isError ? (
          <Text className="px-3 py-3 text-xs text-red-600">
            {describeError(searchQ.error)}
          </Text>
        ) : showInitialLoading ? (
          <View className="items-center py-4">
            <ActivityIndicator color={BRAND} />
          </View>
        ) : showEmpty ? (
          <Text className="px-3 py-3 text-xs" style={{ color: MUTED }}>
            No matching medicine
          </Text>
        ) : (
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: LIST_MAX_HEIGHT }}
            contentContainerStyle={{ paddingVertical: 4 }}
            onScroll={onListScroll}
            scrollEventThrottle={16}
          >
            {drugs.map((d, i) => {
              const selected = activeId === d.id;
              return (
                <Pressable
                  key={d.id}
                  onPress={() => pick(d)}
                  onHoverIn={() => setActiveId(d.id)}
                  className={i > 0 ? "border-t border-neutral-100" : ""}
                  style={({ pressed }) => ({
                    backgroundColor:
                      pressed || selected ? ROW_SELECTED : "transparent",
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                  })}
                >
                  <Text
                    className="text-sm font-medium"
                    style={{ color: BODY }}
                    numberOfLines={1}
                  >
                    {drugSearchLabel(d)}
                  </Text>
                </Pressable>
              );
            })}
            {searchQ.isFetchingNextPage ? (
              <View className="items-center py-2">
                <ActivityIndicator color={BRAND} />
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

export function MedicationChartPanel({
  admissionId,
  editors,
}: {
  admissionId: string;
  editors?: Record<string, AuditEditor>;
}) {
  const chartQ = useMedicationChart(admissionId);
  const record = useRecordDose(admissionId);
  const settle = useAccountMedication(admissionId);

  const [drug, setDrug] = useState<{ id: string; label: string } | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [route, setRoute] = useState("");
  const [settling, setSettling] = useState<MedReconciliation | null>(null);
  const [settleOutcome, setSettleOutcome] = useState<"" | "RETURNED" | "CONSUMED">(
    ""
  );
  const [settleQty, setSettleQty] = useState("");
  const [settleNotes, setSettleNotes] = useState("");

  const outstanding = (chartQ.data?.reconciliation ?? []).filter(
    (r) => r.unaccounted > 0
  );

  const recordDose = async () => {
    if (!drug) return;
    const qty = Math.trunc(Number(quantity));
    if (!Number.isFinite(qty) || qty < 1) return;
    try {
      const out = await record.mutateAsync({
        drugId: drug.id,
        quantity: qty,
        route: route || null,
      });
      if (out.matchedOrder) {
        medToast("Dose recorded — matches the order");
      } else if (out.candidateOrders?.length) {
        medToast("Recorded — the order was not an exact match", {
          body: `Closest: ${out.candidateOrders[0].name ?? "an order"}. Check it against the prescription.`,
          tone: "warning",
        });
      } else {
        medToast("Recorded — no matching order was found", {
          body: "Check it against the doctor's prescription.",
          tone: "warning",
        });
      }
      setDrug(null);
      setQuantity("1");
      setRoute("");
    } catch (err) {
      medToast(
        isModuleNotEnabled(err)
          ? "Inpatient is not available on this deployment."
          : "Could not record the dose",
        { body: isModuleNotEnabled(err) ? undefined : describeError(err), tone: "error" }
      );
    }
  };

  const accountFor = async () => {
    if (!settling || !settleOutcome) return;
    const qty = Math.trunc(Number(settleQty));
    if (!Number.isFinite(qty) || qty < 1 || qty > settling.unaccounted) return;
    if (settleOutcome === "CONSUMED" && settleNotes.trim().length < 3) return;
    try {
      const out = await settle.mutateAsync({
        drugId: settling.drugId,
        quantity: qty,
        outcome: settleOutcome,
        notes: settleNotes.trim() || null,
      });
      medToast(
        out.status === "AWAITING_REVIEW"
          ? "Sent back to the pharmacy for review"
          : "Recorded"
      );
      setSettling(null);
      setSettleOutcome("");
      setSettleQty("");
      setSettleNotes("");
    } catch (err) {
      medToast(
        isModuleNotEnabled(err)
          ? "Inpatient is not available on this deployment."
          : "Could not record it",
        { body: isModuleNotEnabled(err) ? undefined : describeError(err), tone: "error" }
      );
    }
  };

  if (chartQ.isError && isModuleNotEnabled(chartQ.error)) {
    return (
      <Text className="text-sm" style={{ color: MUTED }}>
        Inpatient is not available on this deployment.
      </Text>
    );
  }

  return (
    <View className="gap-5">
      {editors?.medication?.changedBy ? (
        <Text className="text-[11px]" style={{ color: MUTED }}>
          Edited by {editors.medication.changedBy} ·{" "}
          {formatDateTime(String(editors.medication.changedAt))}
        </Text>
      ) : null}

      <View
        className="gap-2 bg-white"
        style={{
          borderRadius: 8,
          borderWidth: 1,
          borderColor: CARD_BORDER,
          padding: 12,
        }}
      >
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="scan-outline" size={16} color={MUTED} />
          <Text className="text-sm font-medium" style={{ color: BODY }}>
            Record a dose
          </Text>
        </View>

        {drug ? (
          <View className="gap-3">
            <View>
              <Text className="text-sm font-semibold" style={{ color: BODY }}>
                {drug.label}
              </Text>
              <Pressable
                onPress={() => {
                  setDrug(null);
                  setQuantity("1");
                  setRoute("");
                }}
                className="mt-0.5"
              >
                <Text className="text-xs underline" style={{ color: MUTED }}>
                  Change
                </Text>
              </Pressable>
            </View>
            <TextField
              label="Units"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
            />
            <View className="gap-1.5">
              <Text className="text-sm font-medium text-neutral-700">Route</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {ROUTES.map((r) => {
                  const active = route === r;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => setRoute(r)}
                      className={`rounded-lg px-3 py-2 ${
                        active ? "bg-brand" : "bg-neutral-100"
                      }`}
                    >
                      <Text
                        numberOfLines={1}
                        className={`text-xs font-medium ${
                          active ? "text-white" : "text-neutral-600"
                        }`}
                      >
                        {r}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <Button
              label="Record"
              size="md"
              loading={record.isPending}
              disabled={record.isPending || Math.trunc(Number(quantity)) < 1}
              onPress={() => void recordDose()}
              style={{ backgroundColor: BRAND }}
            />
          </View>
        ) : (
          <DrugPicker
            onSelect={(d) =>
              setDrug({ id: d.id, label: drugSearchLabel(d) })
            }
          />
        )}
      </View>

      {chartQ.isLoading ? (
        <View className="items-center py-4">
          <ActivityIndicator color={BRAND} />
        </View>
      ) : chartQ.isError ? (
        <Text className="text-sm text-red-600">
          {describeError(chartQ.error)}
        </Text>
      ) : (
        <>
          {outstanding.length > 0 ? (
            <View
              className="gap-2"
              style={{
                borderRadius: 8,
                borderWidth: 1,
                borderColor: AMBER_BORDER,
                backgroundColor: AMBER_BG,
                padding: 12,
              }}
            >
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="warning-outline" size={16} color="#B45309" />
                <Text className="text-sm font-medium" style={{ color: BODY }}>
                  Not yet accounted for
                </Text>
              </View>
              <Text className="text-xs" style={{ color: MUTED }}>
                Issued by the pharmacy but not charted. Say whether it went back or
                was used — a bill is only safe to collect on medicine somebody can
                account for.
              </Text>
              {outstanding.map((row) => (
                <View
                  key={row.drugId}
                  className="rounded-lg bg-white/80 p-2.5"
                >
                  <View className="flex-row items-center justify-between gap-2">
                    <View className="min-w-0 flex-1">
                      <Text
                        className="text-sm font-medium"
                        style={{ color: BODY }}
                      >
                        {row.drugName}
                      </Text>
                      <Text className="text-xs" style={{ color: MUTED }}>
                        {row.dispensed} issued · {row.administered} given
                        {row.settled > 0 ? ` · ${row.settled} settled` : ""} ·{" "}
                        {row.unaccounted} outstanding
                      </Text>
                    </View>
                    {settling?.drugId !== row.drugId ? (
                      <Pressable
                        onPress={() => {
                          setSettling(row);
                          setSettleOutcome("");
                          setSettleQty(String(row.unaccounted));
                          setSettleNotes("");
                        }}
                        style={{ flexShrink: 0 }}
                        className="shrink-0 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5"
                      >
                        <Text
                          numberOfLines={1}
                          className="text-xs font-semibold text-neutral-800"
                        >
                          Account for it
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {settling?.drugId === row.drugId ? (
                    <View className="mt-2.5 gap-2 border-t border-neutral-100 pt-2.5">
                      <Text className="text-xs font-medium text-neutral-700">
                        What happened?
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        <Pressable
                          onPress={() => setSettleOutcome("RETURNED")}
                          style={{ flexShrink: 0 }}
                          className={`shrink-0 rounded-xl border px-3 py-2 ${
                            settleOutcome === "RETURNED"
                              ? "border-brand bg-brand/5"
                              : "border-neutral-200"
                          }`}
                        >
                          <Text
                            numberOfLines={1}
                            className="text-xs font-medium text-neutral-800"
                          >
                            Went back to the pharmacy
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setSettleOutcome("CONSUMED")}
                          style={{ flexShrink: 0 }}
                          className={`shrink-0 rounded-xl border px-3 py-2 ${
                            settleOutcome === "CONSUMED"
                              ? "border-brand bg-brand/5"
                              : "border-neutral-200"
                          }`}
                        >
                          <Text
                            numberOfLines={1}
                            className="text-xs font-medium text-neutral-800"
                          >
                            Used, but never charted
                          </Text>
                        </Pressable>
                      </View>
                      <TextField
                        label="Units"
                        value={settleQty}
                        onChangeText={setSettleQty}
                        keyboardType="number-pad"
                      />
                      {settleOutcome ? (
                        <Text className="text-xs" style={{ color: MUTED }}>
                          {settleOutcome === "RETURNED"
                            ? "The pharmacy decides whether it goes back on the shelf — the ward cannot restock its own returns."
                            : "Nothing moves; the units already left stock when they were issued. This records who accounted for them."}
                        </Text>
                      ) : null}
                      <TextField
                        label={
                          settleOutcome === "CONSUMED"
                            ? "What happened to them?"
                            : "Notes (optional)"
                        }
                        value={settleNotes}
                        onChangeText={setSettleNotes}
                        placeholder={
                          settleOutcome === "CONSUMED"
                            ? "e.g. part vial discarded after the dose"
                            : "Anything the pharmacy should know"
                        }
                      />
                      <View className="flex-row gap-2">
                        <View className="flex-1">
                          <Button
                            label="Record"
                            size="md"
                            loading={settle.isPending}
                            disabled={
                              !settleOutcome ||
                              settle.isPending ||
                              Math.trunc(Number(settleQty)) < 1 ||
                              Math.trunc(Number(settleQty)) >
                                row.unaccounted ||
                              (settleOutcome === "CONSUMED" &&
                                settleNotes.trim().length < 3)
                            }
                            onPress={() => void accountFor()}
                            style={{ backgroundColor: BRAND }}
                          />
                        </View>
                        <Button
                          label="Cancel"
                          variant="ghost"
                          size="md"
                          onPress={() => setSettling(null)}
                        />
                      </View>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          <View className="gap-2">
            <Text className="text-sm font-medium" style={{ color: BODY }}>
              Doses given
            </Text>
            {(chartQ.data?.administrations ?? []).length === 0 ? (
              <View
                className="px-3 py-5"
                style={{
                  borderRadius: 8,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: CARD_BORDER,
                }}
              >
                <Text
                  className="text-center text-sm font-medium"
                  style={{ color: BODY }}
                >
                  Nothing charted yet
                </Text>
                <Text
                  className="mt-1 text-center text-xs"
                  style={{ color: MUTED }}
                >
                  Doses you record will be listed here, newest first.
                </Text>
              </View>
            ) : (
              <View
                className="overflow-hidden"
                style={{
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: CARD_BORDER,
                }}
              >
                {(chartQ.data?.administrations ?? []).map((a, i) => (
                  <View
                    key={a.id}
                    className={`flex-row items-start gap-2 px-3 py-2.5 ${
                      i > 0 ? "border-t border-neutral-100" : ""
                    }`}
                  >
                    <View className="min-w-0 flex-1">
                      <Text
                        className="text-sm font-medium"
                        style={{ color: BODY }}
                      >
                        {a.drugName}
                      </Text>
                      <Text className="text-xs" style={{ color: MUTED }}>
                        {a.quantity} unit{a.quantity === 1 ? "" : "s"}
                        {a.route ? ` · ${a.route}` : ""} ·{" "}
                        {formatDateTime(a.administeredAt)} · {a.administeredBy}
                      </Text>
                    </View>
                    {!a.matchedOrder ? (
                      <View
                        style={{ flexShrink: 0 }}
                        className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5"
                      >
                        <Text
                          numberOfLines={1}
                          className="text-[10px] font-medium text-amber-800"
                        >
                          No matching order
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}
