import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { Button, TextField } from "@/ui";
import { searchFacilityDrugs } from "@/lib/api/endpoints/drugs";
import { describeError } from "@/lib/api/errors";
import { useFacilityId } from "@/lib/auth/store";
import {
  useAccountMedication,
  useMedicationChart,
  useRecordDose,
} from "../hooks";
import type { AuditEditor, MedReconciliation } from "../types";
import { drugSearchLabel, formatDateTime } from "../utils";

const ROUTES = ["Oral", "IV", "IM", "SC", "Topical", "Inhaled", "Other"] as const;

function useDebounced(value: string, delay: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function MedicationChartPanel({
  admissionId,
  editors,
}: {
  admissionId: string;
  editors?: Record<string, AuditEditor>;
}) {
  const facilityId = useFacilityId();
  const chartQ = useMedicationChart(admissionId);
  const record = useRecordDose(admissionId);
  const settle = useAccountMedication(admissionId);

  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 250);
  const [drug, setDrug] = useState<{ id: string; label: string } | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [route, setRoute] = useState("");
  const [settling, setSettling] = useState<MedReconciliation | null>(null);
  const [settleOutcome, setSettleOutcome] = useState<"" | "RETURNED" | "CONSUMED">(
    ""
  );
  const [settleQty, setSettleQty] = useState("");
  const [settleNotes, setSettleNotes] = useState("");

  const searchQ = useQuery({
    queryKey: ["facility-drugs-search", facilityId, debounced],
    enabled: !!facilityId && !drug && debounced.trim().length > 0,
    queryFn: ({ signal }) =>
      searchFacilityDrugs(facilityId!, debounced.trim(), signal),
  });

  const outstanding = (chartQ.data?.reconciliation ?? []).filter(
    (r) => r.unaccounted > 0
  );

  const recordDose = async () => {
    if (!drug) return;
    const qty = Math.trunc(Number(quantity));
    if (!Number.isFinite(qty) || qty < 1) {
      Alert.alert("Units", "Enter a whole number of units.");
      return;
    }
    try {
      const out = await record.mutateAsync({
        drugId: drug.id,
        quantity: qty,
        route: route || null,
      });
      if (out.matchedOrder) {
        Alert.alert("Dose recorded", "Matches the order.");
      } else if (out.candidateOrders?.length) {
        Alert.alert(
          "Recorded — the order was not an exact match",
          `Closest: ${out.candidateOrders[0].name ?? "an order"}. Check it against the prescription.`
        );
      } else {
        Alert.alert(
          "Recorded — no matching order was found",
          "Check it against the doctor's prescription."
        );
      }
      setDrug(null);
      setQuery("");
      setQuantity("1");
      setRoute("");
    } catch (err) {
      Alert.alert("Could not record the dose", describeError(err));
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
      Alert.alert(
        out.status === "AWAITING_REVIEW"
          ? "Sent back to the pharmacy for review"
          : "Recorded"
      );
      setSettling(null);
      setSettleOutcome("");
      setSettleQty("");
      setSettleNotes("");
    } catch (err) {
      Alert.alert("Could not record it", describeError(err));
    }
  };

  if (chartQ.isLoading) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator color="#FD006A" />
      </View>
    );
  }

  if (chartQ.isError) {
    return (
      <Text className="text-sm text-red-600">
        {describeError(chartQ.error)}
      </Text>
    );
  }

  return (
    <View className="gap-5">
      {editors?.medication?.changedBy ? (
        <Text className="text-[11px] text-neutral-500">
          Edited by {editors.medication.changedBy} ·{" "}
          {formatDateTime(String(editors.medication.changedAt))}
        </Text>
      ) : null}

      <View className="gap-2 rounded-xl border border-neutral-200 p-3">
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="barcode-outline" size={16} color="#737373" />
          <Text className="text-sm font-medium text-neutral-900">
            Record a dose
          </Text>
        </View>

        {drug ? (
          <View className="gap-3">
            <View>
              <Text className="text-sm font-semibold text-neutral-900">
                {drug.label}
              </Text>
              <Pressable onPress={() => setDrug(null)} className="mt-0.5">
                <Text className="text-xs text-neutral-500 underline">Change</Text>
              </Pressable>
            </View>
            <TextField
              label="Units"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
            />
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
                    onPress={() => setRoute(active ? "" : r)}
                    className={`rounded-full px-3 py-2 ${
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
            <Button
              label="Record"
              size="md"
              loading={record.isPending}
              disabled={record.isPending || Math.trunc(Number(quantity)) < 1}
              onPress={() => void recordDose()}
            />
          </View>
        ) : (
          <View>
            <TextField
              value={query}
              onChangeText={setQuery}
              placeholder="Scan the pack, or search by name…"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={() => {
                const first = searchQ.data?.[0];
                if (first) {
                  setDrug({ id: first.id, label: drugSearchLabel(first) });
                  setQuery("");
                }
              }}
            />
            {searchQ.isFetching ? (
              <ActivityIndicator className="mt-2" color="#FD006A" />
            ) : null}
            {(searchQ.data ?? []).length > 0 ? (
              <View className="mt-1 overflow-hidden rounded-xl border border-neutral-200">
                {(searchQ.data ?? []).slice(0, 8).map((d, i) => (
                  <Pressable
                    key={d.id}
                    onPress={() => {
                      setDrug({ id: d.id, label: drugSearchLabel(d) });
                      setQuery("");
                    }}
                    className={`px-3 py-2.5 active:bg-neutral-50 ${
                      i > 0 ? "border-t border-neutral-100" : ""
                    }`}
                  >
                    <Text className="text-sm font-medium text-neutral-900">
                      {drugSearchLabel(d)}
                    </Text>
                    {d.genericName && d.genericName !== d.name ? (
                      <Text className="text-xs text-neutral-500">
                        {d.genericName}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : query.trim() && !searchQ.isFetching && searchQ.isSuccess ? (
              <Text className="mt-2 text-xs text-neutral-500">
                No matching medicine
              </Text>
            ) : null}
          </View>
        )}
      </View>

      {outstanding.length > 0 ? (
        <View className="gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="warning-outline" size={16} color="#B45309" />
            <Text className="text-sm font-medium text-amber-900">
              Not yet accounted for
            </Text>
          </View>
          <Text className="text-xs text-amber-800/80">
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
                  <Text className="text-sm font-medium text-neutral-900">
                    {row.drugName}
                  </Text>
                  <Text className="text-xs text-neutral-500">
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
                    className="shrink-0 rounded-lg border border-neutral-200 px-2.5 py-1.5"
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
                    <Text className="text-xs text-neutral-500">
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
                          Math.trunc(Number(settleQty)) > row.unaccounted ||
                          (settleOutcome === "CONSUMED" &&
                            settleNotes.trim().length < 3)
                        }
                        onPress={() => void accountFor()}
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
        <Text className="text-sm font-medium text-neutral-900">Doses given</Text>
        {(chartQ.data?.administrations ?? []).length === 0 ? (
          <View className="rounded-xl border border-dashed border-neutral-200 px-3 py-5">
            <Text className="text-center text-sm font-medium text-neutral-800">
              Nothing charted yet
            </Text>
            <Text className="mt-1 text-center text-xs text-neutral-500">
              Doses you record will be listed here, newest first.
            </Text>
          </View>
        ) : (
          <View className="overflow-hidden rounded-xl border border-neutral-200">
            {(chartQ.data?.administrations ?? []).map((a, i) => (
              <View
                key={a.id}
                className={`flex-row items-start gap-2 px-3 py-2.5 ${
                  i > 0 ? "border-t border-neutral-100" : ""
                }`}
              >
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-medium text-neutral-900">
                    {a.drugName}
                  </Text>
                  <Text className="text-xs text-neutral-500">
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
    </View>
  );
}
