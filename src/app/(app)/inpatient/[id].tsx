import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button, Screen, TextField, TopBar } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { useCanAccessInpatient } from "@/features/permissions/hooks";
import {
  useDischargeAdmission,
  useInpatientAdmission,
  useInpatientBillHydration,
  useSaveInpatientBill,
} from "@/features/inpatient/hooks";
import { ServicePicker } from "@/features/inpatient/ServicePicker";
import type { BillItem } from "@/features/inpatient/types";
import {
  billLineCategoryLabel,
  buildBaseItems,
  calcBillTotals,
  CAT_COLOR,
  formatInr,
  formatPersonNameTitleCase,
  inpatientRouteSegment,
  ipDaysBetween,
  patchRoomRentLineRates,
  patientDisplayName,
  ratePerDayFromRoom,
  recomputeLine,
  todayYmd,
  toDisplayDateDdMmYyyy,
} from "@/features/inpatient/utils";

export default function InpatientBillScreen() {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const admissionId = typeof routeId === "string" ? routeId : routeId?.[0];
  const router = useRouter();
  const { canAccess, isLoading: accessLoading } = useCanAccessInpatient();

  const admissionQ = useInpatientAdmission(admissionId);
  const admission = admissionQ.data;

  const billQ = useInpatientBillHydration(admissionId, admission?.status);
  const saveBill = useSaveInpatientBill(admissionId);
  const discharge = useDischargeAdmission(admissionId);

  const [items, setItems] = useState<BillItem[]>([]);
  const [discountPct, setDiscountPct] = useState(0);
  const [notes, setNotes] = useState("");
  /** Mongo admission id we last hydrated editor state for. */
  const [hydratedAdmissionId, setHydratedAdmissionId] = useState<string | null>(
    null
  );

  // Prefer IP serial in the URL once known (web parity).
  useEffect(() => {
    if (!admission || !admissionId) return;
    const preferred = inpatientRouteSegment(admission);
    if (preferred !== admissionId) {
      router.replace({
        pathname: "/inpatient/[id]",
        params: { id: preferred },
      });
    }
  }, [admission, admissionId, router]);

  // Hydrate local editor once when admission + bill query settle.
  useEffect(() => {
    if (!admission || billQ.isLoading) return;
    if (hydratedAdmissionId === admission.id) return;

    const bill = billQ.data?.bill;
    if (bill?.items?.length) {
      setItems(patchRoomRentLineRates(bill.items as BillItem[], admission.room));
      setNotes(typeof bill.notes === "string" ? bill.notes : "");
      setDiscountPct(
        typeof bill.discountPct === "number" ? bill.discountPct : 0
      );
    } else {
      setItems(buildBaseItems(admission));
      setNotes(admission.notes ?? "");
      setDiscountPct(0);
    }
    setHydratedAdmissionId(admission.id);
  }, [admission, billQ.data, billQ.isLoading, hydratedAdmissionId]);

  const totals = useMemo(
    () => calcBillTotals(items, discountPct),
    [items, discountPct]
  );

  const patientName = admission
    ? formatPersonNameTitleCase(patientDisplayName(admission))
    : "";
  const days = admission
    ? ipDaysBetween(admission.admitDate, admission.dischargeDate)
    : 0;
  const roomRate = admission ? ratePerDayFromRoom(admission.room) : 0;
  const isDischarged =
    String(admission?.status ?? "").toUpperCase() === "DISCHARGED";
  const hasFinalBill = (admission?.bills?.length ?? 0) > 0;
  const busy = saveBill.isPending || discharge.isPending;
  const readOnly = isDischarged && hasFinalBill;

  const updateQty = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        return recomputeLine({ ...it, qty: Math.max(1, (it.qty || 1) + delta) });
      })
    );
  };

  const updateField = (
    id: string,
    field: "rate" | "discountPct" | "taxRate",
    raw: string
  ) => {
    const n = Number(raw.replace(/[^0-9.]/g, ""));
    const value = Number.isFinite(n) ? Math.max(0, n) : 0;
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const next =
          field === "discountPct" || field === "taxRate"
            ? Math.min(100, value)
            : value;
        return recomputeLine({ ...it, [field]: next });
      })
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const persist = async (status: "draft" | "final") => {
    if (!admission || !admissionId) return;
    if (items.length === 0) {
      Alert.alert("Add items", "Add at least one bill line before saving.");
      return;
    }
    if (status === "final" && isDischarged) {
      Alert.alert("Already discharged", "This admission is already discharged.");
      return;
    }

    try {
      const result = await saveBill.mutateAsync({
        status,
        items,
        notes,
        discountPct,
        totals,
      });

      if (status === "draft") {
        Alert.alert("Saved", "Draft bill saved.");
        return;
      }

      // Web finalize also discharges when still admitted.
      if (!isDischarged) {
        await discharge.mutateAsync(todayYmd());
      }

      Alert.alert(
        "Finalised",
        result.ledgerInvoiceId
          ? "Bill finalised and patient discharged. Settle the ledger invoice on Practice web if needed."
          : "Bill finalised and patient discharged."
      );
      setHydratedAdmissionId(null);
      await admissionQ.refetch();
      await billQ.refetch();
    } catch (err) {
      Alert.alert(
        status === "draft" ? "Could not save draft" : "Could not finalise",
        describeError(err)
      );
    }
  };

  if (accessLoading) {
    return (
      <Screen>
        <TopBar title="In-Patient Bill" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FD006A" />
        </View>
      </Screen>
    );
  }

  if (!canAccess) {
    return (
      <Screen>
        <TopBar title="In-Patient Bill" />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-neutral-600">
            You do not have permission to view inpatient billing.
          </Text>
        </View>
      </Screen>
    );
  }

  if (
    admissionQ.isLoading ||
    (admission && billQ.isLoading && hydratedAdmissionId !== admission.id)
  ) {
    return (
      <Screen>
        <TopBar title="In-Patient Bill" />
        <View className="flex-1 items-center justify-center gap-2">
          <ActivityIndicator color="#FD006A" />
          <Text className="text-sm text-neutral-500">Loading admission…</Text>
        </View>
      </Screen>
    );
  }

  if (admissionQ.isError || !admission) {
    return (
      <Screen>
        <TopBar title="In-Patient Bill" />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm font-medium text-neutral-900">
            Admission not found
          </Text>
          <Text className="mt-1 text-center text-sm text-neutral-500">
            {admissionQ.isError
              ? describeError(admissionQ.error)
              : "Check the link or return to the inpatient list."}
          </Text>
          <View className="mt-4">
            <Button
              label="Back to Inpatients"
              variant="outline"
              size="md"
              onPress={() => router.replace("/inpatient")}
            />
          </View>
        </View>
      </Screen>
    );
  }

  const admitDateLabel = new Date(admission.admitDate).toISOString().slice(0, 10);
  const ipLabel =
    admission.ipSerial != null
      ? `IP-${admission.ipSerial}`
      : `IP-${admission.id.slice(-6).toUpperCase()}`;

  return (
    <Screen>
      <TopBar
        title="In-Patient Bill"
        subtitle={patientName}
        right={
          <Pressable
            onPress={() => router.replace("/inpatient")}
            hitSlop={8}
            className="rounded-lg px-2 py-1 active:bg-neutral-100"
          >
            <Text className="text-sm font-semibold text-neutral-700">List</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
        keyboardShouldPersistTaps="always"
      >
        <View className="rounded-2xl border border-neutral-200 bg-white p-4">
          <View className="flex-row items-start justify-between gap-2">
            <View className="min-w-0 flex-1">
              <Text className="text-lg font-semibold text-neutral-900">
                {patientName}
              </Text>
              <Text className="mt-0.5 text-xs text-neutral-500">
                {ipLabel}
                {admission.patient.patientId != null
                  ? ` · #${admission.patient.patientId}`
                  : ""}
              </Text>
              <Text className="mt-1 text-sm text-neutral-600">
                {admission.room.displayName}
                {admission.diagnosis?.trim()
                  ? ` · ${admission.diagnosis.trim()}`
                  : ""}
              </Text>
            </View>
            <View
              className={`rounded-full px-2.5 py-1 ${
                isDischarged ? "bg-emerald-50" : "bg-neutral-100"
              }`}
            >
              <Text
                className={`text-[10px] font-semibold ${
                  isDischarged ? "text-emerald-700" : "text-neutral-700"
                }`}
              >
                {isDischarged ? "Discharged" : "Admitted"}
              </Text>
            </View>
          </View>

          <View className="mt-3 flex-row flex-wrap gap-x-4 gap-y-2 border-t border-neutral-100 pt-3">
            <Meta
              label="Doctor"
              value={(admission.doctor.name ?? "—").trim() || "—"}
            />
            <Meta
              label="Admitted"
              value={`${toDisplayDateDdMmYyyy(admitDateLabel)} · ${days}d`}
            />
            <Meta
              label="Room rent"
              value={`${formatInr(days * roomRate)} (${formatInr(roomRate)}/d)`}
            />
          </View>
        </View>

        <View className="rounded-2xl border border-neutral-200 bg-white p-4">
          <Text className="mb-3 text-base font-semibold text-neutral-900">
            Inpatient Billing Details
          </Text>

          {!readOnly ? (
            <View className="mb-3">
              <ServicePicker items={items} setItems={setItems} />
            </View>
          ) : null}

          {items.length === 0 ? (
            <Text className="py-6 text-center text-sm text-neutral-500">
              No bill lines yet.
            </Text>
          ) : (
            <View className="gap-2">
              {items.map((it) => {
                const color = CAT_COLOR[it.catId] ?? "#6B7280";
                return (
                  <View
                    key={it.id}
                    className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5"
                  >
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="min-w-0 flex-1">
                        <Text
                          className="text-sm font-semibold text-neutral-900"
                          numberOfLines={2}
                        >
                          {it.name}
                        </Text>
                        <Text
                          className="mt-0.5 text-[10px] font-medium"
                          style={{ color }}
                        >
                          {billLineCategoryLabel(it.catId)}
                        </Text>
                      </View>
                      <View className="items-end gap-1">
                        <Text className="font-mono text-sm font-semibold text-neutral-900">
                          {formatInr(it.lineTotal + it.taxAmt)}
                        </Text>
                        {!readOnly ? (
                          <Pressable
                            onPress={() => removeItem(it.id)}
                            hitSlop={6}
                            accessibilityLabel="Remove line"
                          >
                            <Ionicons
                              name="close"
                              size={18}
                              color="#DC2626"
                            />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>

                    <View className="mt-2 flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        {!readOnly ? (
                          <>
                            <Pressable
                              onPress={() => updateQty(it.id, -1)}
                              className="h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white"
                            >
                              <Text className="text-base font-bold text-neutral-700">
                                −
                              </Text>
                            </Pressable>
                            <Text className="min-w-[20px] text-center text-sm font-semibold">
                              {it.qty}
                            </Text>
                            <Pressable
                              onPress={() => updateQty(it.id, 1)}
                              className="h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white"
                            >
                              <Text className="text-base font-bold text-neutral-700">
                                +
                              </Text>
                            </Pressable>
                          </>
                        ) : (
                          <Text className="text-xs text-neutral-500">
                            Qty {it.qty}
                          </Text>
                        )}
                      </View>
                    </View>

                    {!readOnly ? (
                      <View className="mt-2 flex-row gap-2">
                        <View style={{ flex: 1.4 }} className="min-w-0">
                          <LineField
                            label="Rate"
                            value={String(it.rate)}
                            onChangeText={(t) => updateField(it.id, "rate", t)}
                          />
                        </View>
                        <View className="min-w-0 flex-1">
                          <LineField
                            label="Disc %"
                            value={String(it.discountPct || 0)}
                            onChangeText={(t) =>
                              updateField(it.id, "discountPct", t)
                            }
                          />
                        </View>
                        <View className="min-w-0 flex-1">
                          <LineField
                            label="Tax %"
                            value={String(it.taxRate || 0)}
                            onChangeText={(t) =>
                              updateField(it.id, "taxRate", t)
                            }
                          />
                        </View>
                      </View>
                    ) : (
                      <Text className="mt-1 text-xs text-neutral-500">
                        {formatInr(it.rate)} × {it.qty}
                        {it.discountPct
                          ? ` · disc ${it.discountPct}%`
                          : ""}
                        {it.taxRate ? ` · tax ${it.taxRate}%` : ""}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <View className="mt-4 gap-1.5 border-t border-neutral-100 pt-3">
            <TotalRow label="Subtotal" value={formatInr(totals.subtotal)} />
            <TotalRow
              label="Discount"
              value={`−${formatInr(totals.overallDisc)}`}
            />
            <TotalRow label="Tax" value={formatInr(totals.totalTax)} />
            <TotalRow
              label="Patient payable"
              value={formatInr(totals.patientPayable)}
              bold
            />
          </View>

          {!readOnly ? (
            <View className="mt-3">
              <TextField
                label="Overall discount %"
                value={String(discountPct || "")}
                onChangeText={(t) => {
                  const n = Number(t.replace(/[^0-9.]/g, ""));
                  setDiscountPct(
                    Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0
                  );
                }}
                keyboardType="decimal-pad"
              />
            </View>
          ) : null}
        </View>

        <View className="rounded-2xl border border-neutral-200 bg-white p-4">
          <TextField
            label="Notes / discharge remarks"
            value={notes}
            onChangeText={setNotes}
            multiline
            editable={!readOnly}
            placeholder="Discharge summary, remarks…"
            style={{ minHeight: 88, textAlignVertical: "top" }}
          />
        </View>

        {!readOnly ? (
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button
                label="Save draft"
                variant="outline"
                loading={busy && saveBill.variables?.status === "draft"}
                disabled={busy}
                onPress={() => void persist("draft")}
              />
            </View>
            <View className="flex-1">
              <Button
                label="Finalise"
                loading={busy && saveBill.variables?.status === "final"}
                disabled={busy || isDischarged}
                onPress={() => {
                  Alert.alert(
                    "Finalise bill?",
                    "This saves a FINAL bill and discharges the patient.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Finalise",
                        style: "destructive",
                        onPress: () => void persist("final"),
                      },
                    ]
                  );
                }}
              />
            </View>
          </View>
        ) : (
          <Text className="text-center text-xs text-neutral-500">
            Final bill on file — editing is locked after discharge.
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}

function LineField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
}) {
  return (
    <View className="w-full gap-1">
      <Text className="text-[10px] font-medium text-neutral-500">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        numberOfLines={1}
        className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-900"
        style={{
          height: 44,
          minHeight: 44,
          paddingVertical: 0,
          textAlignVertical: "center",
          // Android otherwise adds extra font padding that clips digits.
          includeFontPadding: false,
        }}
      />
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-[40%]">
      <Text className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </Text>
      <Text className="text-sm font-semibold text-neutral-900" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function TotalRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text
        className={`text-sm ${bold ? "font-semibold text-neutral-900" : "text-neutral-600"}`}
      >
        {label}
      </Text>
      <Text
        className={`font-mono text-sm ${bold ? "font-bold text-neutral-900" : "font-semibold text-neutral-800"}`}
      >
        {value}
      </Text>
    </View>
  );
}
