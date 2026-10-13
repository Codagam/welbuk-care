import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useFacilityDoctors } from "@/features/walk-in/hooks";
import { Button } from "@/ui";
import { PlanEditorSheet } from "../components/PlanEditorSheet";
import { useDentalConsult } from "../DentalConsultContext";
import type { DentalTreatmentPlanRow } from "../types";
import {
  isPlanBillable,
  planRowBillableFee,
  randomId,
  toDateOnly,
  todayYmd,
} from "../utils";

/**
 * Treatment(s) list — same card as Practice `DentalTreatmentPlanSection`:
 * tooth badge, treated name, "Planned · Done · treated" line, the still-PENDING
 * suggestions, status, fee, Edit and the provider chips.
 *
 * Deliberately NO Payment button: Care is consultation-only. Treated work
 * reaches the bill in Practice on its own (only `done`, or `in-progress` with
 * a fee — a suggested treatment is never billed).
 */

const STATUS_LABEL: Record<DentalTreatmentPlanRow["status"], string> = {
  planned: "Planned",
  "in-progress": "In progress",
  done: "Done",
};

const STATUS_PILL: Record<
  DentalTreatmentPlanRow["status"],
  { bg: string; text: string }
> = {
  planned: { bg: "bg-neutral-100", text: "text-neutral-600" },
  "in-progress": { bg: "bg-amber-50", text: "text-amber-700" },
  done: { bg: "bg-emerald-50", text: "text-emerald-700" },
};

/** DD-MM-YYYY, as Practice prints plan dates. */
function formatPlanRowDate(value?: string): string {
  const d = toDateOnly(value);
  if (!d || d.length < 10) return "";
  const [y, m, day] = d.split("-");
  return `${day}-${m}-${y}`;
}

function formatRupees(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/** Tooth number without the "Tooth " prefix some older rows carry. */
function toothLabelOf(row: DentalTreatmentPlanRow): string {
  return String(row.findingSummary?.tooth ?? "")
    .replace(/^Tooth\s+/i, "")
    .trim();
}

function treatedNamesOf(row: DentalTreatmentPlanRow): string[] {
  return (row.selectedActuals ?? [])
    .map((a) => a.name.trim())
    .filter(Boolean);
}

/**
 * Suggestions on this finding that have NOT been ticked as treated yet. They
 * stay on the plan (and off the bill) until treated; without this line a
 * partly treated row hides them.
 */
function pendingSuggestions(row: DentalTreatmentPlanRow): string[] {
  const treated = new Set(treatedNamesOf(row).map((n) => n.toLowerCase()));
  return (row.findingSummary?.suggestedOptions ?? [])
    .map((s) => String(s).trim())
    .filter((s) => s && !treated.has(s.toLowerCase()));
}

/** What was done; for a row nothing has been done on yet, what is planned. */
function rowTitle(row: DentalTreatmentPlanRow): string {
  const treated = treatedNamesOf(row);
  if (treated.length > 0) return treated.join(", ");
  return (
    row.actualTreatment?.trim() ||
    row.treatmentName?.trim() ||
    row.plannedTreatment?.trim() ||
    "Untitled treatment"
  );
}

export function DentalPlanSection() {
  const dental = useDentalConsult();
  const [editRow, setEditRow] = useState<DentalTreatmentPlanRow | null>(null);
  const doctors = useFacilityDoctors().data ?? [];

  /** Providers store either the Mongo id or the numeric doctorId. */
  const doctorName = (stored: string): string | null => {
    const s = String(stored ?? "").trim();
    if (!s) return null;
    const hit = doctors.find(
      (d) => d.id === s || (d.doctorId != null && String(d.doctorId) === s)
    );
    return hit?.name ?? null;
  };

  const feesFor = (row: DentalTreatmentPlanRow) =>
    planRowBillableFee(
      row,
      row.diagnosisEntryId
        ? dental.entries.find((e) => e.id === row.diagnosisEntryId)
            ?.suggestedTreatmentFees
        : undefined,
      dental.catalog
    );

  const treatedTotal = dental.planItems
    .filter(isPlanBillable)
    .reduce((s, i) => s + feesFor(i), 0);

  const addStandalone = () => {
    setEditRow({
      id: randomId(),
      treatmentName: "",
      plannedDate: todayYmd(),
      plannedTime: "10:00",
      status: "planned",
      providers: [{ doctorId: "", role: "Primary", fee: 0 }],
      totalFee: 0,
      selectedActuals: [],
    });
  };

  if (dental.loading) {
    return (
      <View className="items-center py-10">
        <ActivityIndicator color="#FD006A" />
      </View>
    );
  }

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-neutral-900">
          Treatment(s)
        </Text>
        <Text className="text-sm font-semibold text-brand">
          Treated ₹{formatRupees(treatedTotal)}
        </Text>
      </View>

      {dental.planItems.length === 0 ? (
        <Text className="text-sm text-neutral-400">
          No treatments yet. Use Treat on a finding, or add a standalone
          treatment.
        </Text>
      ) : (
        dental.planItems.map((it) => {
          const tooth = toothLabelOf(it);
          const pending = pendingSuggestions(it);
          const pill = STATUS_PILL[it.status] ?? STATUS_PILL.planned;
          const treatedNames = treatedNamesOf(it).join(", ");
          const planned = formatPlanRowDate(it.plannedDate);
          const done = formatPlanRowDate(it.actualDate);
          const metaParts = [
            planned
              ? `Planned: ${planned}${it.plannedTime ? ` ${it.plannedTime}` : ""}`
              : "",
            // A "Done" date only means something once something was treated.
            done && (treatedNames || it.status === "done") ? `Done: ${done}` : "",
            treatedNames,
          ].filter(Boolean);
          const providers = (it.providers ?? []).flatMap((p) => {
            const name = doctorName(p.doctorId);
            return name ? [{ ...p, name }] : [];
          });

          return (
            <View
              key={it.id}
              className="gap-3 rounded-2xl border border-neutral-200 bg-white p-4"
            >
              <View className="flex-row items-start gap-3">
                {tooth ? (
                  <View className="items-center gap-1">
                    <Text className="text-[10px] text-neutral-500">Tooth</Text>
                    <View className="h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-brand/10">
                      <Text className="text-xs font-semibold text-neutral-900">
                        {tooth}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <View className="flex-1 gap-1">
                  <Text className="text-base font-semibold text-neutral-900">
                    {rowTitle(it)}
                  </Text>
                  {metaParts.length > 0 ? (
                    <Text className="text-xs text-neutral-500">
                      {metaParts.join(" · ")}
                    </Text>
                  ) : null}
                  {pending.length > 0 ? (
                    <Text className="text-xs text-amber-700">
                      Pending: {pending.join(", ")}
                    </Text>
                  ) : null}
                </View>

                <View className="items-end gap-2">
                  <View className="flex-row items-center gap-2">
                    <View className={`rounded-full px-2 py-0.5 ${pill.bg}`}>
                      <Text className={`text-xs font-medium ${pill.text}`}>
                        {STATUS_LABEL[it.status] ?? it.status}
                      </Text>
                    </View>
                    <Text className="text-sm font-semibold text-brand">
                      ₹ {formatRupees(feesFor(it))}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setEditRow(it)}
                    className="rounded-lg px-3 py-1.5 active:bg-neutral-100"
                  >
                    <Text className="text-sm font-semibold text-neutral-900">
                      Edit
                    </Text>
                  </Pressable>
                </View>
              </View>

              {providers.length > 0 ? (
                <View className="flex-row flex-wrap gap-1">
                  {providers.map((p, idx) => (
                    <View
                      key={`${p.doctorId}-${idx}`}
                      className="rounded-md bg-neutral-100 px-2 py-0.5"
                    >
                      <Text className="text-[11px] text-neutral-700">
                        {p.name} ({p.role}) — ₹{formatRupees(Number(p.fee) || 0)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <Button label="+ Add treatment" variant="outline" onPress={addStandalone} />

      {dental.error ? (
        <Text className="text-sm text-red-500">{dental.error}</Text>
      ) : null}
      {dental.statusMsg ? (
        <Text className="text-sm text-emerald-600">{dental.statusMsg}</Text>
      ) : null}

      <Text className="text-center text-xs text-neutral-400">
        Suggested treatments stay on the plan as Pending and are not billed.
        Only items ticked as Treated go to billing.
      </Text>

      <PlanEditorSheet
        visible={!!editRow}
        row={editRow}
        catalog={dental.catalog}
        finding={
          editRow?.diagnosisEntryId
            ? dental.entries.find((e) => e.id === editRow.diagnosisEntryId) ??
              null
            : null
        }
        facilityId={dental.facilityId}
        defaultDoctorId={dental.defaultDoctorId}
        saving={dental.saving}
        onClose={() => setEditRow(null)}
        onSave={(row) => {
          const next = dental.planItems.some((p) => p.id === row.id)
            ? dental.planItems.map((p) => (p.id === row.id ? row : p))
            : [...dental.planItems, row];
          void dental.savePlan(next).then(() => setEditRow(null));
        }}
      />
    </View>
  );
}
