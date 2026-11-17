import { useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button, DateField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { SectionChrome } from "@/features/consult/components/SectionChrome";
import {
  addChartRows,
  fetchChart,
  removeChartRow,
  SOURCE_LABEL,
  todayIso,
  vaccimonKeys,
  verifyChartRow,
  type ChartKind,
  type ImmunizationList,
  type ImmunizationRow,
  type RecordSource,
  type RecordVerification,
  type ScreeningList,
  type WellnessList,
  type WellnessRow,
} from "@/lib/api/endpoints/vaccimon";

import {
  BRAND,
  ChoiceChips,
  Dialog,
  EmptyNote,
  fieldInputClass,
  formatShortDate,
  ReasonDialog,
  showToast,
} from "../components/kit";
import {
  CentileTag,
  GrowthMetricTiles,
  METRIC_KEYS,
  METRICS,
  PlainGrowthChart,
  WhoGrowthChart,
  ageInMonths,
  ageLabel,
  assessRow,
  type Metric,
} from "./GrowthChart";
import {
  describeScreening,
  isAttentionResult,
  screeningTest,
  type ScreeningTest,
} from "./screening";
import { DOSE_LABELS, OTHER_VACCINE_CODE, VACCINE_CATALOG } from "./vaccine-catalog";
import {
  WHO_MAX_AGE_DAYS,
  ageInDays,
  growthSexFromGender,
} from "./who-growth";

type Tab = "vaccines" | "growth" | "screening";

/**
 * "Vaccines & wellness" on the patient record — Care port of Practice
 * `components/vaccimon/vaccine-wellness-card.tsx`. Fills from the clinic and
 * from the family's Welbuk Health app. Other clinics' entries stay hidden
 * until cross-clinic consent exists; the count is shown so nobody assumes the
 * chart is complete.
 *
 * Not ported: "Read a vaccination card" (on-device OCR). Practice runs
 * tesseract.js in the browser; Care has no OCR module.
 */
export function VaccineWellnessCard({
  patientId,
  facilityId,
  canEdit,
  dateOfBirth,
  gender,
}: {
  patientId: string;
  facilityId: string;
  canEdit: boolean;
  dateOfBirth?: string | null;
  gender?: string | null;
}) {
  const enabled = !!patientId && !!facilityId;
  const [tab, setTab] = useState<Tab>("vaccines");

  const vaccines = useQuery({
    queryKey: vaccimonKeys.immunizations(patientId, facilityId),
    enabled,
    queryFn: () =>
      fetchChart<ImmunizationList>("immunizations", patientId, facilityId),
  });
  const growth = useQuery({
    queryKey: vaccimonKeys.wellness(patientId, facilityId),
    enabled,
    queryFn: () => fetchChart<WellnessList>("wellness", patientId, facilityId),
  });
  const screening = useQuery({
    queryKey: vaccimonKeys.screenings(patientId, facilityId),
    enabled,
    queryFn: () => fetchChart<ScreeningList>("screenings", patientId, facilityId),
  });

  const hidden =
    (vaccines.data?.hiddenFromOtherClinics ?? 0) +
    (growth.data?.hiddenFromOtherClinics ?? 0) +
    (screening.data?.hiddenFromOtherClinics ?? 0);
  const loading = vaccines.isLoading || growth.isLoading || screening.isLoading;
  const failed = vaccines.error || growth.error || screening.error;

  const count = (n: number | undefined) => (n ? ` (${n})` : "");
  const tabs: { key: Tab; label: string }[] = [
    { key: "vaccines", label: `Vaccines${count(vaccines.data?.records.length)}` },
    { key: "growth", label: `Growth${count(growth.data?.measurements.length)}` },
    {
      key: "screening",
      label: `Screening${count(screening.data?.screenings.length)}`,
    },
  ];

  return (
    <SectionChrome title="Vaccines & wellness" icon="medkit-outline">
      <Text className="mb-3 text-xs text-neutral-500">
        Doses, growth measurements and hearing / vision screening, for any age —
        from this clinic and from the family&apos;s Welbuk Health app.
      </Text>
      {hidden > 0 ? (
        <View className="mb-3 flex-row items-start gap-2 rounded-xl bg-neutral-100 px-3 py-2">
          <Ionicons name="eye-off-outline" size={14} color="#6b7280" />
          <Text className="min-w-0 flex-1 text-xs text-neutral-600">
            {hidden} {hidden === 1 ? "entry was" : "entries were"} recorded at
            another clinic and {hidden === 1 ? "is" : "are"} not shown here.
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View className="flex-row items-center gap-2 py-6">
          <ActivityIndicator color={BRAND} />
          <Text className="text-sm text-neutral-500">Loading…</Text>
        </View>
      ) : failed ? (
        <Text className="py-4 text-sm text-red-500">{describeError(failed)}</Text>
      ) : (
        <View className="gap-3">
          <View className="flex-row gap-1 self-start rounded-xl bg-neutral-100 p-1">
            {tabs.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t.key }}
                className={`min-h-[36px] justify-center rounded-lg px-3 ${
                  tab === t.key ? "bg-white" : ""
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    tab === t.key ? "text-neutral-900" : "text-neutral-500"
                  }`}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === "vaccines" ? (
            <VaccineSection
              patientId={patientId}
              facilityId={facilityId}
              data={vaccines.data}
              canEdit={canEdit}
            />
          ) : tab === "growth" ? (
            <GrowthSection
              patientId={patientId}
              facilityId={facilityId}
              data={growth.data}
              canEdit={canEdit}
              dateOfBirth={dateOfBirth}
              gender={gender}
            />
          ) : (
            <ScreeningSection data={screening.data} />
          )}
        </View>
      )}
    </SectionChrome>
  );
}

/* ───────────────────────── shared row bits ───────────────────────── */

function Pill({
  label,
  tone,
  icon,
}: {
  label: string;
  tone: "solid" | "soft" | "outline" | "muted";
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const box = {
    solid: "bg-brand",
    soft: "bg-neutral-200",
    outline: "border border-neutral-300",
    muted: "border border-neutral-200",
  }[tone];
  const text = {
    solid: "text-white",
    soft: "text-neutral-700",
    outline: "text-neutral-700",
    muted: "text-neutral-500",
  }[tone];
  return (
    <View className={`flex-row items-center gap-1 rounded-md px-1.5 py-0.5 ${box}`}>
      {icon ? (
        <Ionicons name={icon} size={11} color={tone === "solid" ? "#fff" : "#374151"} />
      ) : null}
      <Text className={`text-[11px] ${text}`}>{label}</Text>
    </View>
  );
}

/** Where an entry came from and whether a doctor checked it, by LABEL. */
function ProvenanceBadges({
  source,
  verification,
}: {
  source: RecordSource;
  verification: RecordVerification;
}) {
  return (
    <View className="flex-row flex-wrap items-center gap-1">
      <Pill
        label={SOURCE_LABEL[source] ?? source}
        tone={source === "CLINIC_RECORDED" ? "soft" : "outline"}
      />
      {verification === "CLINIC_VERIFIED" ? (
        <Pill label="Verified" tone="solid" icon="checkmark-circle" />
      ) : (
        <Pill label="Not verified" tone="muted" />
      )}
    </View>
  );
}

function RowActions({
  canVerify,
  canRemove,
  verifying,
  onVerify,
  onRemove,
}: {
  canVerify: boolean;
  canRemove: boolean;
  verifying: boolean;
  onVerify: () => void;
  onRemove: () => void;
}) {
  if (!canVerify && !canRemove) return null;
  return (
    <View className="mt-2 flex-row justify-end gap-2 border-t border-neutral-100 pt-2">
      {canVerify ? (
        <Button
          label="Verify"
          variant="outline"
          size="md"
          loading={verifying}
          onPress={onVerify}
          icon={<Ionicons name="checkmark-done-outline" size={16} color="#111827" />}
        />
      ) : null}
      {canRemove ? (
        <Button
          label="Remove"
          variant="outline"
          size="md"
          onPress={onRemove}
          icon={<Ionicons name="trash-outline" size={16} color="#111827" />}
        />
      ) : null}
    </View>
  );
}

/** Verify / remove for one chart, shared by both sections. */
function useChartRowActions(kind: ChartKind, patientId: string, facilityId: string) {
  const qc = useQueryClient();
  const key =
    kind === "immunizations"
      ? vaccimonKeys.immunizations(patientId, facilityId)
      : vaccimonKeys.wellness(patientId, facilityId);
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const verify = useMutation({
    mutationFn: (id: string) => verifyChartRow(kind, id, patientId, facilityId),
    onSuccess: async () => {
      showToast("Marked as verified");
      await refresh();
    },
    onError: (e) => showToast(describeError(e), "error"),
  });
  const remove = useMutation({
    mutationFn: (args: { id: string; reason: string }) =>
      removeChartRow(kind, args.id, patientId, facilityId, args.reason),
    onSuccess: async () => {
      showToast("Entry removed");
      await refresh();
    },
    onError: (e) => showToast(describeError(e), "error"),
  });
  const add = useMutation({
    mutationFn: (row: unknown) =>
      addChartRows(kind, { patientId, facilityId, rows: [row] }),
    onSuccess: refresh,
  });
  return { verify, remove, add };
}

function FormLabel({ children }: { children: ReactNode }) {
  return <Text className="text-sm font-medium text-neutral-700">{children}</Text>;
}

function Input({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad";
}) {
  return (
    <View className="min-w-[160px] flex-1 gap-1">
      <FormLabel>{label}</FormLabel>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        keyboardType={keyboardType}
        className={fieldInputClass()}
      />
    </View>
  );
}

/* ───────────────────────────── Vaccines ───────────────────────────── */

type VaccineDraft = {
  vaccineCode: string;
  vaccineName: string;
  doseLabel: string | null;
  givenOn: string;
  productName: string;
  lotNumber: string;
  givenAtName: string;
  notes: string;
};
const EMPTY_VACCINE: VaccineDraft = {
  vaccineCode: "",
  vaccineName: "",
  doseLabel: null,
  givenOn: "",
  productName: "",
  lotNumber: "",
  givenAtName: "",
  notes: "",
};

function VaccineSection({
  patientId,
  facilityId,
  data,
  canEdit,
}: {
  patientId: string;
  facilityId: string;
  data: ImmunizationList | undefined;
  canEdit: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ImmunizationRow | null>(null);
  const { verify, remove, add } = useChartRowActions(
    "immunizations",
    patientId,
    facilityId
  );
  const records = data?.records ?? [];

  return (
    <View className="gap-3">
      {canEdit ? (
        <View className="flex-row">
          <Button
            label="Add vaccine"
            size="md"
            onPress={() => setAdding(true)}
            icon={<Ionicons name="add" size={18} color="#fff" />}
          />
        </View>
      ) : null}

      {records.length === 0 ? (
        <EmptyNote
          icon="bandage-outline"
          title="No vaccines recorded yet"
          description="Add doses given here or elsewhere. Entries the family adds in Welbuk Health appear here too."
        />
      ) : (
        <View className="gap-2">
          {records.map((r) => (
            <View key={r.id} className="rounded-xl border border-neutral-200 p-3">
              <View className="flex-row flex-wrap items-start justify-between gap-2">
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold text-neutral-900">
                    {r.vaccineName}
                    {r.doseLabel ? (
                      <Text className="font-normal text-neutral-500">
                        {" "}
                        · {r.doseLabel}
                      </Text>
                    ) : null}
                  </Text>
                  <Text className="text-xs text-neutral-500">
                    Given {formatShortDate(r.givenOn)}
                    {r.givenAtName ? ` · ${r.givenAtName}` : ""}
                  </Text>
                  {r.productName || r.lotNumber ? (
                    <Text className="text-xs text-neutral-500">
                      {[r.productName, r.lotNumber].filter(Boolean).join(" · ")}
                    </Text>
                  ) : null}
                  {r.notes ? (
                    <Text className="mt-0.5 text-xs text-neutral-500">{r.notes}</Text>
                  ) : null}
                </View>
                <ProvenanceBadges source={r.source} verification={r.verification} />
              </View>
              {canEdit ? (
                <RowActions
                  canVerify={!!data?.canVerify && r.verification === "UNVERIFIED"}
                  canRemove={r.ownedByThisClinic}
                  verifying={verify.isPending && verify.variables === r.id}
                  onVerify={() => verify.mutate(r.id)}
                  onRemove={() => setRemoveTarget(r)}
                />
              ) : null}
            </View>
          ))}
        </View>
      )}

      {adding ? (
        <AddVaccineDialog
          pending={add.isPending}
          onClose={() => setAdding(false)}
          onSave={(draft) =>
            add.mutate(
              {
                ...draft,
                vaccineName:
                  draft.vaccineCode === OTHER_VACCINE_CODE ? draft.vaccineName : undefined,
              },
              {
                onSuccess: () => {
                  showToast("Vaccine added");
                  setAdding(false);
                },
                onError: (e) => showToast(describeError(e), "error"),
              }
            )
          }
        />
      ) : null}

      <ReasonDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="Remove entry"
        description={
          removeTarget
            ? `${removeTarget.vaccineName}, ${formatShortDate(removeTarget.givenOn)}. The entry is kept in the audit trail with your name and reason. To correct it, remove it and add it again.`
            : undefined
        }
        confirmLabel="Remove"
        placeholder="e.g. Wrong date entered"
        pending={remove.isPending}
        onConfirm={(reason) =>
          removeTarget &&
          remove.mutate(
            { id: removeTarget.id, reason },
            { onSuccess: () => setRemoveTarget(null) }
          )
        }
      />
    </View>
  );
}

function AddVaccineDialog({
  pending,
  onClose,
  onSave,
}: {
  pending: boolean;
  onClose: () => void;
  onSave: (draft: VaccineDraft) => void;
}) {
  const [d, setD] = useState<VaccineDraft>(EMPTY_VACCINE);
  const [pickVaccine, setPickVaccine] = useState(false);
  const set = (patch: Partial<VaccineDraft>) => setD((p) => ({ ...p, ...patch }));
  const canSave =
    !!d.vaccineCode &&
    !!d.givenOn &&
    (d.vaccineCode !== OTHER_VACCINE_CODE || d.vaccineName.trim().length > 0);
  const vaccineLabel =
    d.vaccineCode === OTHER_VACCINE_CODE
      ? "Other…"
      : VACCINE_CATALOG.find((v) => v.code === d.vaccineCode)?.name;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add vaccine"
      description="Record a dose given here or elsewhere. A doctor's entry is marked verified; anyone else's waits for a doctor to verify it."
      maxWidth={600}
      footer={
        <>
          <Button label="Cancel" variant="outline" size="md" onPress={onClose} disabled={pending} />
          <Button
            label="Save"
            size="md"
            loading={pending}
            disabled={!canSave}
            onPress={() => onSave(d)}
          />
        </>
      }
    >
      <View className="gap-1">
        <FormLabel>Vaccine</FormLabel>
        <Pressable
          onPress={() => setPickVaccine((v) => !v)}
          className="min-h-[48px] flex-row items-center justify-between rounded-xl border border-neutral-300 bg-white px-3"
        >
          <Text
            className={`text-base ${vaccineLabel ? "text-neutral-900" : "text-neutral-400"}`}
          >
            {vaccineLabel ?? "Choose a vaccine"}
          </Text>
          <Ionicons
            name={pickVaccine ? "chevron-up" : "chevron-down"}
            size={18}
            color="#6b7280"
          />
        </Pressable>
        {pickVaccine ? (
          <ScrollView
            nestedScrollEnabled
            style={{ maxHeight: 240 }}
            className="rounded-xl border border-neutral-200"
          >
            {[
              ...VACCINE_CATALOG.map((v) => ({ code: v.code, name: v.name })),
              { code: OTHER_VACCINE_CODE, name: "Other…" },
            ].map((v) => (
              <Pressable
                key={v.code}
                onPress={() => {
                  set({ vaccineCode: v.code });
                  setPickVaccine(false);
                }}
                className={`min-h-[44px] flex-row items-center justify-between border-b border-neutral-100 px-3 ${
                  d.vaccineCode === v.code ? "bg-brand/5" : "active:bg-neutral-50"
                }`}
              >
                <Text className="text-sm text-neutral-900">{v.name}</Text>
                {d.vaccineCode === v.code ? (
                  <Ionicons name="checkmark" size={18} color={BRAND} />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>

      {d.vaccineCode === OTHER_VACCINE_CODE ? (
        <Input
          label="Vaccine name"
          value={d.vaccineName}
          onChangeText={(v) => set({ vaccineName: v })}
        />
      ) : null}

      <View className="gap-1">
        <FormLabel>Dose</FormLabel>
        <ChoiceChips
          options={["Not stated", ...DOSE_LABELS] as readonly string[]}
          value={d.doseLabel ?? "Not stated"}
          onChange={(v) => set({ doseLabel: v === "Not stated" ? null : v })}
        />
      </View>

      <DateField
        label="Given on"
        value={d.givenOn}
        onChange={(v) => set({ givenOn: v })}
        maximumDate={todayIso()}
      />

      <View className="flex-row flex-wrap gap-3">
        <Input
          label="Product (optional)"
          value={d.productName}
          onChangeText={(v) => set({ productName: v })}
        />
        <Input
          label="Lot / batch (optional)"
          value={d.lotNumber}
          onChangeText={(v) => set({ lotNumber: v })}
        />
      </View>
      <Input
        label="Given at (optional)"
        value={d.givenAtName}
        placeholder="Leave blank if given here"
        onChangeText={(v) => set({ givenAtName: v })}
      />
      <Input label="Notes (optional)" value={d.notes} onChangeText={(v) => set({ notes: v })} />
    </Dialog>
  );
}

/* ────────────────────────────── Growth ────────────────────────────── */

type GrowthDraft = {
  measuredOn: string;
  weightKg: string;
  heightCm: string;
  lengthPosition: "" | "recumbent" | "standing";
  headCircumferenceCm: string;
  notes: string;
};
const EMPTY_GROWTH: GrowthDraft = {
  measuredOn: "",
  weightKg: "",
  heightCm: "",
  lengthPosition: "",
  headCircumferenceCm: "",
  notes: "",
};

/**
 * Measurements against the WHO Child Growth Standards (birth to 5 years).
 * Needs a date of birth and a male/female sex; without either, or past five
 * years, the values are plotted on their own.
 */
function GrowthSection({
  patientId,
  facilityId,
  data,
  canEdit,
  dateOfBirth,
  gender,
}: {
  patientId: string;
  facilityId: string;
  data: WellnessList | undefined;
  canEdit: boolean;
  dateOfBirth?: string | null;
  gender?: string | null;
}) {
  const [metric, setMetric] = useState<Metric>("weightKg");
  const [adding, setAdding] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<WellnessRow | null>(null);
  const { verify, remove, add } = useChartRowActions("wellness", patientId, facilityId);

  const rows = useMemo(() => data?.measurements ?? [], [data]);
  const sex = growthSexFromGender(gender);
  const hasMetric = rows.some((r) => r[metric] != null);
  const anyUnderFive =
    !!dateOfBirth &&
    rows.some((r) => {
      if (r[metric] == null) return false;
      const days = ageInDays(dateOfBirth, r.measuredOn);
      return days >= 0 && days <= WHO_MAX_AGE_DAYS;
    });
  const plainReason = !dateOfBirth
    ? "Add the patient's date of birth to compare with WHO reference ranges."
    : !sex
      ? "Set the patient's sex to male or female to compare with WHO reference ranges, which are published separately for boys and girls."
      : "WHO reference ranges here cover birth to 5 years, so these measurements are plotted on their own.";

  return (
    <View className="gap-3">
      {canEdit ? (
        <View className="flex-row">
          <Button
            label="Add measurement"
            size="md"
            onPress={() => setAdding(true)}
            icon={<Ionicons name="add" size={18} color="#fff" />}
          />
        </View>
      ) : null}

      {rows.length === 0 ? (
        <EmptyNote
          icon="resize-outline"
          title="No measurements yet"
          description="Record weight, height or length, and head circumference at each visit to build this patient's growth chart."
        />
      ) : (
        <>
          <GrowthMetricTiles
            rows={rows}
            metric={metric}
            onSelect={setMetric}
            dateOfBirth={dateOfBirth}
            sex={sex}
          />
          {!hasMetric ? (
            <Text className="rounded-xl border border-neutral-200 p-4 text-sm text-neutral-500">
              No {METRICS[metric].label.toLowerCase()} recorded yet.
            </Text>
          ) : anyUnderFive && sex && dateOfBirth ? (
            <WhoGrowthChart rows={rows} metric={metric} dateOfBirth={dateOfBirth} sex={sex} />
          ) : (
            <PlainGrowthChart
              rows={rows}
              metric={metric}
              dateOfBirth={dateOfBirth}
              reason={plainReason}
            />
          )}

          <View className="gap-2">
            {rows.map((r) => {
              const age = ageInMonths(dateOfBirth, r.measuredOn);
              return (
                <View key={r.id} className="rounded-xl border border-neutral-200 p-3">
                  <View className="flex-row flex-wrap items-start justify-between gap-2">
                    <View>
                      <Text className="text-sm font-semibold text-neutral-900">
                        {formatShortDate(r.measuredOn)}
                      </Text>
                      {age != null ? (
                        <Text className="text-xs text-neutral-500">
                          {age < 0.05 ? "Birth" : `Age ${ageLabel(age)}`}
                        </Text>
                      ) : null}
                    </View>
                    <ProvenanceBadges source={r.source} verification={r.verification} />
                  </View>
                  <View className="mt-2 flex-row gap-2">
                    {METRIC_KEYS.map((m) => {
                      const a = assessRow(r, m, dateOfBirth, sex);
                      return (
                        <View key={m} className="min-w-0 flex-1">
                          <Text className="text-xs text-neutral-500">{METRICS[m].short}</Text>
                          <Text className="text-sm font-medium text-neutral-900">
                            {r[m] != null ? `${r[m]} ${METRICS[m].unit}` : "—"}
                          </Text>
                          {a ? <CentileTag assessment={a} /> : null}
                        </View>
                      );
                    })}
                  </View>
                  {r.lengthPosition && r.heightCm != null ? (
                    <Text className="mt-1 text-xs text-neutral-500">
                      Length measured {r.lengthPosition === "recumbent" ? "lying" : "standing"}
                    </Text>
                  ) : null}
                  {canEdit ? (
                    <RowActions
                      canVerify={!!data?.canVerify && r.verification === "UNVERIFIED"}
                      canRemove={r.ownedByThisClinic}
                      verifying={verify.isPending && verify.variables === r.id}
                      onVerify={() => verify.mutate(r.id)}
                      onRemove={() => setRemoveTarget(r)}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        </>
      )}

      {adding ? (
        <AddMeasurementDialog
          pending={add.isPending}
          onClose={() => setAdding(false)}
          onSave={(d) =>
            add.mutate(
              {
                measuredOn: d.measuredOn,
                weightKg: d.weightKg || null,
                heightCm: d.heightCm || null,
                lengthPosition: d.lengthPosition || null,
                headCircumferenceCm: d.headCircumferenceCm || null,
                notes: d.notes,
              },
              {
                onSuccess: () => {
                  showToast("Measurement added");
                  setAdding(false);
                },
                onError: (e) => showToast(describeError(e), "error"),
              }
            )
          }
        />
      ) : null}

      <ReasonDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="Remove entry"
        description={
          removeTarget
            ? `Measurement on ${formatShortDate(removeTarget.measuredOn)}. The entry is kept in the audit trail with your name and reason. To correct it, remove it and add it again.`
            : undefined
        }
        confirmLabel="Remove"
        placeholder="e.g. Wrong date entered"
        pending={remove.isPending}
        onConfirm={(reason) =>
          removeTarget &&
          remove.mutate(
            { id: removeTarget.id, reason },
            { onSuccess: () => setRemoveTarget(null) }
          )
        }
      />
    </View>
  );
}

const POSITION_LABEL = {
  "": "Not stated",
  recumbent: "Lying (length)",
  standing: "Standing (height)",
} as const;

function AddMeasurementDialog({
  pending,
  onClose,
  onSave,
}: {
  pending: boolean;
  onClose: () => void;
  onSave: (d: GrowthDraft) => void;
}) {
  const [d, setD] = useState<GrowthDraft>(EMPTY_GROWTH);
  const set = (patch: Partial<GrowthDraft>) => setD((p) => ({ ...p, ...patch }));
  const decimal = (v: string) => v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
  const canSave =
    !!d.measuredOn && (!!d.weightKg || !!d.heightCm || !!d.headCircumferenceCm);

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add measurement"
      description="Enter what was measured. Leave a field blank if it was not taken."
      maxWidth={600}
      footer={
        <>
          <Button label="Cancel" variant="outline" size="md" onPress={onClose} disabled={pending} />
          <Button
            label="Save"
            size="md"
            loading={pending}
            disabled={!canSave}
            onPress={() => onSave(d)}
          />
        </>
      }
    >
      <DateField
        label="Measured on"
        value={d.measuredOn}
        onChange={(v) => set({ measuredOn: v })}
        maximumDate={todayIso()}
      />
      <View className="flex-row flex-wrap gap-3">
        <Input
          label="Weight (kg)"
          value={d.weightKg}
          keyboardType="decimal-pad"
          onChangeText={(v) => set({ weightKg: decimal(v) })}
        />
        <Input
          label="Head circumference (cm)"
          value={d.headCircumferenceCm}
          keyboardType="decimal-pad"
          onChangeText={(v) => set({ headCircumferenceCm: decimal(v) })}
        />
      </View>
      <Input
        label="Height / length (cm)"
        value={d.heightCm}
        keyboardType="decimal-pad"
        onChangeText={(v) => set({ heightCm: decimal(v) })}
      />
      <View className="gap-1">
        <FormLabel>Measured</FormLabel>
        <ChoiceChips
          options={["", "recumbent", "standing"] as const}
          value={d.lengthPosition}
          onChange={(v) => set({ lengthPosition: v })}
          labels={POSITION_LABEL}
        />
      </View>
      <Input label="Notes (optional)" value={d.notes} onChangeText={(v) => set({ notes: v })} />
    </Dialog>
  );
}

/* ───────────────────────────── Screening ───────────────────────────── */

const GROUPS: { group: ScreeningTest["group"]; icon: keyof typeof Ionicons.glyphMap }[] = [
  { group: "Hearing", icon: "ear-outline" },
  { group: "Vision", icon: "eye-outline" },
  { group: "Development", icon: "leaf-outline" },
];

/**
 * Hearing, vision and development results, for any age. Recorded from a
 * consult's well-child check; read here.
 */
function ScreeningSection({ data }: { data?: ScreeningList }) {
  const rows = data?.screenings ?? [];
  if (rows.length === 0) {
    return (
      <EmptyNote
        icon="ear-outline"
        title="No screening recorded"
        description="Hearing, vision and development results are added from a consult's well-child check."
      />
    );
  }
  return (
    <View className="gap-4">
      {GROUPS.map(({ group, icon }) => {
        const inGroup = rows.filter((r) => screeningTest(r.testKey)?.group === group);
        if (inGroup.length === 0) return null;
        return (
          <View key={group} className="gap-2">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name={icon} size={13} color="#6b7280" />
              <Text className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {group}
              </Text>
            </View>
            <View className="overflow-hidden rounded-xl border border-neutral-200">
              {inGroup.map((r, i) => {
                const attention = isAttentionResult(r.result);
                return (
                  <View
                    key={r.id}
                    className={`flex-row flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 ${
                      i < inGroup.length - 1 ? "border-b border-neutral-100" : ""
                    }`}
                  >
                    <Text style={{ width: 96 }} className="text-xs text-neutral-500">
                      {formatShortDate(r.testedOn)}
                    </Text>
                    <Text className="text-sm text-neutral-900">
                      {screeningTest(r.testKey)?.label ?? r.testKey}
                    </Text>
                    <View
                      className={`rounded-md border px-1.5 py-0.5 ${
                        attention ? "border-amber-300" : "border-emerald-300"
                      }`}
                    >
                      <Text
                        className={`text-[11px] ${
                          attention ? "text-amber-800" : "text-emerald-800"
                        }`}
                      >
                        {describeScreening(r)}
                      </Text>
                    </View>
                    {r.notes ? (
                      <Text className="text-xs text-neutral-500">{r.notes}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}
