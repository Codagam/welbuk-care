/**
 * Growth charts drawn with plain Views — Care has no SVG / chart library, and
 * adding a native one needs a new dev build. Port of Practice
 * `components/vaccimon/who-growth-chart.tsx` (recharts there).
 *
 * The WHO bands are drawn as one column per reference row (monthly), so they
 * step rather than curve; the centile lines and the child's own line are exact
 * straight segments between points.
 */
import { useMemo, useState } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { WellnessRow } from "@/lib/api/endpoints/vaccimon";

import {
  DAYS_PER_MONTH,
  WHO_CENTILES,
  WHO_MAX_AGE_DAYS,
  ageInDays,
  assessGrowth,
  formatCentile,
  formatZ,
  referenceCurves,
  type GrowthAssessment,
  type GrowthFlag,
  type GrowthIndicator,
  type GrowthSex,
} from "./who-growth";

const BRAND = "#FD006A";
const BAND = "#0d9488"; // teal, like Practice --chart-2
const CHART_H = 280;
const PAD = { left: 40, right: 28, top: 8, bottom: 26 };

export type Metric = "weightKg" | "heightCm" | "headCircumferenceCm";

export const METRICS: Record<
  Metric,
  { label: string; short: string; unit: string; indicator: GrowthIndicator }
> = {
  weightKg: { label: "Weight", short: "Weight", unit: "kg", indicator: "weight" },
  heightCm: { label: "Height / length", short: "Length", unit: "cm", indicator: "length" },
  headCircumferenceCm: {
    label: "Head circumference",
    short: "Head",
    unit: "cm",
    indicator: "head",
  },
};
export const METRIC_KEYS = Object.keys(METRICS) as Metric[];

export function ageInMonths(
  dob: string | null | undefined,
  on: string
): number | null {
  if (!dob) return null;
  const days = ageInDays(dob, on);
  return days >= 0 ? Math.round((days / DAYS_PER_MONTH) * 10) / 10 : null;
}

export function ageLabel(months: number): string {
  if (months < 0.05) return "Birth";
  if (months < 24) return `${months.toFixed(months < 1 ? 1 : 0)} mo`;
  const y = Math.floor(months / 12);
  const m = Math.round(months - y * 12);
  return m ? `${y}y ${m}m` : `${y}y`;
}

export function assessRow(
  row: WellnessRow,
  metric: Metric,
  dob: string | null | undefined,
  sex: GrowthSex | null
): GrowthAssessment | null {
  const value = row[metric];
  if (value == null || !dob || !sex) return null;
  return assessGrowth({
    indicator: METRICS[metric].indicator,
    sex,
    days: ageInDays(dob, row.measuredOn),
    value,
    lengthPosition: row.lengthPosition,
  });
}

const FLAG_STYLE: Record<
  GrowthFlag,
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  ok: { icon: "checkmark-circle-outline", color: "#047857" },
  watch: { icon: "warning-outline", color: "#b45309" },
  alert: { icon: "alert-circle-outline", color: "#dc2626" },
};

/** "42nd centile" with an icon, so the flag never rests on colour alone. */
export function CentileTag({
  assessment,
  withLabel,
}: {
  assessment: GrowthAssessment;
  withLabel?: boolean;
}) {
  const s = FLAG_STYLE[assessment.flag];
  return (
    <View className="flex-row items-center gap-1">
      <Ionicons name={s.icon} size={13} color={s.color} />
      <Text style={{ color: s.color }} className="text-xs">
        {formatCentile(assessment.centile)}
        {withLabel && assessment.flag !== "ok" ? ` · ${assessment.label}` : ""}
      </Text>
    </View>
  );
}

/** Latest value + centile per measure; also the way to switch the chart. */
export function GrowthMetricTiles({
  rows,
  metric,
  onSelect,
  dateOfBirth,
  sex,
}: {
  rows: WellnessRow[];
  metric: Metric;
  onSelect: (m: Metric) => void;
  dateOfBirth?: string | null;
  sex: GrowthSex | null;
}) {
  return (
    <View className="flex-row gap-2">
      {METRIC_KEYS.map((m) => {
        const latest = [...rows]
          .filter((r) => r[m] != null)
          .sort(
            (a, b) =>
              new Date(b.measuredOn).getTime() - new Date(a.measuredOn).getTime()
          )[0];
        const a = latest ? assessRow(latest, m, dateOfBirth, sex) : null;
        const active = m === metric;
        return (
          <Pressable
            key={m}
            onPress={() => onSelect(m)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`min-h-[76px] flex-1 justify-between gap-1 rounded-xl border p-3 ${
              active ? "border-brand bg-brand/5" : "border-neutral-200 bg-white"
            }`}
          >
            <Text className="text-xs font-medium text-neutral-500">
              {METRICS[m].label}
            </Text>
            {latest ? (
              <Text className="text-lg font-semibold text-neutral-900">
                {latest[m]}
                <Text className="text-xs font-normal text-neutral-500">
                  {" "}
                  {METRICS[m].unit}
                </Text>
              </Text>
            ) : (
              <Text className="text-sm text-neutral-400">—</Text>
            )}
            {a ? <CentileTag assessment={a} /> : <View style={{ height: 16 }} />}
          </Pressable>
        );
      })}
    </View>
  );
}

function chartSpanMonths(maxAge: number): number {
  return [12, 24, 36, 48, 60].find((s) => s >= maxAge + 2) ?? 60;
}
function ticksFor(span: number): number[] {
  const step = span <= 12 ? 2 : span <= 24 ? 3 : 6;
  const out: number[] = [];
  for (let m = 0; m <= span; m += step) out.push(m);
  return out;
}
function tickLabel(m: number): string {
  if (m === 0) return "Birth";
  if (m % 12 === 0) return `${m / 12}y`;
  if (m < 24) return `${m}m`;
  return `${Math.floor(m / 12)}½y`;
}
function niceDomain(values: number[]): [number, number] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.06 || 1;
  const step = hi - lo > 40 ? 10 : hi - lo > 12 ? 2 : 1;
  return [
    Math.max(0, Math.floor((lo - pad) / step) * step),
    Math.ceil((hi + pad) / step) * step,
  ];
}
function yTicks([lo, hi]: [number, number]): number[] {
  const raw = (hi - lo) / 5;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 5, 10].map((k) => k * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
    out.push(Math.round(v * 100) / 100);
  }
  return out;
}

/** A straight line between two points, as a rotated View. */
function Segment({
  x1,
  y1,
  x2,
  y2,
  color,
  width = 1,
  opacity = 1,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width?: number;
  opacity?: number;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.5) return null;
  const angle = Math.atan2(dy, dx);
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: (x1 + x2) / 2 - len / 2,
        top: (y1 + y2) / 2 - width / 2,
        width: len,
        height: width,
        backgroundColor: color,
        opacity,
        transform: [{ rotate: `${angle}rad` }],
      }}
    />
  );
}

type Plot = { x: number; y: number };

function Axes({
  width,
  xTicks,
  xOf,
  yTickValues,
  yOf,
  xLabel,
}: {
  width: number;
  xTicks: number[];
  xOf: (v: number) => number;
  yTickValues: number[];
  yOf: (v: number) => number;
  xLabel: (v: number) => string;
}) {
  return (
    <>
      {yTickValues.map((v) => (
        <View key={`y-${v}`} pointerEvents="none">
          <View
            style={{
              position: "absolute",
              left: PAD.left,
              width: width - PAD.left - PAD.right,
              top: yOf(v),
              height: 1,
              backgroundColor: "#e5e7eb",
            }}
          />
          <Text
            style={{ position: "absolute", left: 0, width: PAD.left - 6, top: yOf(v) - 7 }}
            className="text-right text-[10px] text-neutral-500"
          >
            {v}
          </Text>
        </View>
      ))}
      {xTicks.map((v) => (
        <Text
          key={`x-${v}`}
          pointerEvents="none"
          style={{
            position: "absolute",
            top: CHART_H - PAD.bottom + 6,
            left: xOf(v) - 22,
            width: 44,
          }}
          className="text-center text-[10px] text-neutral-500"
        >
          {xLabel(v)}
        </Text>
      ))}
    </>
  );
}

function ChildLine({
  points,
  selected,
  onSelect,
}: {
  points: Plot[];
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  return (
    <>
      {points.slice(1).map((p, i) => (
        <Segment
          key={`c-${i}`}
          x1={points[i].x}
          y1={points[i].y}
          x2={p.x}
          y2={p.y}
          color={BRAND}
          width={2.5}
        />
      ))}
      {points.map((p, i) => (
        <Pressable
          key={`d-${i}`}
          onPress={() => onSelect(i)}
          hitSlop={10}
          style={{
            position: "absolute",
            left: p.x - (selected === i ? 7 : 5),
            top: p.y - (selected === i ? 7 : 5),
            width: selected === i ? 14 : 10,
            height: selected === i ? 14 : 10,
            borderRadius: 7,
            backgroundColor: BRAND,
            borderWidth: 2,
            borderColor: "#fff",
          }}
        />
      ))}
    </>
  );
}

function useWidth() {
  const [width, setWidth] = useState(0);
  return {
    width,
    onLayout: (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width),
  };
}

export function WhoGrowthChart({
  rows,
  metric,
  dateOfBirth,
  sex,
}: {
  rows: WellnessRow[];
  metric: Metric;
  dateOfBirth: string;
  sex: GrowthSex;
}) {
  const { indicator, unit, label } = METRICS[metric];
  const { width, onLayout } = useWidth();
  const [selected, setSelected] = useState<number | null>(null);

  const model = useMemo(() => {
    const measured = rows
      .filter((r) => r[metric] != null)
      .map((r) => ({ r, days: ageInDays(dateOfBirth, r.measuredOn) }))
      .filter((p) => p.days >= 0);
    const inRange = measured
      .filter((p) => p.days <= WHO_MAX_AGE_DAYS)
      .sort((a, b) => a.days - b.days);
    const maxAge = inRange.reduce((m, p) => Math.max(m, p.days / DAYS_PER_MONTH), 0);
    const span = chartSpanMonths(maxAge);
    const ref = referenceCurves(indicator, sex, span);
    const child = inRange.map(({ r, days }) => ({
      x: days / DAYS_PER_MONTH,
      value: r[metric] as number,
      on: r.measuredOn,
      assessment: assessRow(r, metric, dateOfBirth, sex),
    }));
    const domain = niceDomain([
      ...ref.flatMap((p) => [p.p3, p.p97]),
      ...child.map((c) => c.value),
    ]);
    return { ref, child, span, domain, beyond: measured.length - inRange.length };
  }, [rows, metric, dateOfBirth, sex, indicator]);

  const latest = model.child[model.child.length - 1] ?? null;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = CHART_H - PAD.top - PAD.bottom;
  const xOf = (m: number) => PAD.left + (m / model.span) * plotW;
  const yOf = (v: number) =>
    PAD.top +
    (1 - (v - model.domain[0]) / (model.domain[1] - model.domain[0])) * plotH;
  const sel = selected != null ? model.child[selected] : null;

  return (
    <View className="gap-2">
      {latest?.assessment && latest.assessment.flag !== "ok" ? (
        <View
          className={`flex-row items-start gap-2 rounded-xl border px-3 py-2 ${
            latest.assessment.flag === "alert"
              ? "border-red-300 bg-red-50"
              : "border-amber-300 bg-amber-50"
          }`}
        >
          <CentileTag assessment={latest.assessment} />
          <Text className="min-w-0 flex-1 text-sm text-neutral-800">
            Latest {label.toLowerCase()} is{" "}
            <Text className="font-semibold">
              {latest.assessment.label.toLowerCase()}
            </Text>{" "}
            for age ({formatZ(latest.assessment.z)}).
          </Text>
        </View>
      ) : null}

      <Text className="text-xs text-neutral-500">{unit}</Text>
      <View
        onLayout={onLayout}
        style={{ height: CHART_H, width: "100%" }}
        accessibilityLabel={`${label} for age against WHO reference ranges, 3rd to 97th centile.${
          latest?.assessment
            ? ` Latest ${latest.value} ${unit} at ${ageLabel(latest.x)}, ${formatCentile(latest.assessment.centile)} centile.`
            : ""
        }`}
      >
        {width > 0 ? (
          <>
            <Axes
              width={width}
              xTicks={ticksFor(model.span)}
              xOf={xOf}
              yTickValues={yTicks(model.domain)}
              yOf={yOf}
              xLabel={tickLabel}
            />
            {/* Bands: one column per monthly reference row. */}
            {model.ref.slice(0, -1).map((p, i) => {
              const next = model.ref[i + 1];
              const left = xOf(p.x);
              const w = Math.max(1, xOf(next.x) - left + 0.5);
              return (
                <View key={`b-${i}`} pointerEvents="none">
                  <View
                    style={{
                      position: "absolute",
                      left,
                      width: w,
                      top: yOf(Math.max(p.p97, next.p97)),
                      height: yOf(Math.min(p.p3, next.p3)) - yOf(Math.max(p.p97, next.p97)),
                      backgroundColor: BAND,
                      opacity: 0.1,
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      left,
                      width: w,
                      top: yOf((p.p85 + next.p85) / 2),
                      height: yOf((p.p15 + next.p15) / 2) - yOf((p.p85 + next.p85) / 2),
                      backgroundColor: BAND,
                      opacity: 0.18,
                    }}
                  />
                </View>
              );
            })}
            {WHO_CENTILES.map((c) => (
              <View key={c.key} pointerEvents="none">
                {model.ref.slice(1).map((p, i) => (
                  <Segment
                    key={`${c.key}-${i}`}
                    x1={xOf(model.ref[i].x)}
                    y1={yOf(model.ref[i][c.key])}
                    x2={xOf(p.x)}
                    y2={yOf(p[c.key])}
                    color={BAND}
                    width={c.centile === 50 ? 1.5 : 1}
                    opacity={c.centile === 50 ? 0.9 : 0.45}
                  />
                ))}
                {model.ref.length > 0 ? (
                  <Text
                    style={{
                      position: "absolute",
                      left: xOf(model.ref[model.ref.length - 1].x) + 3,
                      top: yOf(model.ref[model.ref.length - 1][c.key]) - 7,
                      color: BAND,
                    }}
                    className="text-[10px]"
                  >
                    {c.centile}
                  </Text>
                ) : null}
              </View>
            ))}
            <ChildLine
              points={model.child.map((c) => ({ x: xOf(c.x), y: yOf(c.value) }))}
              selected={selected}
              onSelect={(i) => setSelected(selected === i ? null : i)}
            />
          </>
        ) : null}
      </View>

      {sel ? (
        <View className="flex-row flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
          <Text className="text-sm font-semibold text-neutral-900">
            {sel.value} {unit}
          </Text>
          <Text className="text-xs text-neutral-500">
            {new Date(sel.on).toLocaleDateString("en-IN")} · age {ageLabel(sel.x)}
          </Text>
          {sel.assessment ? <CentileTag assessment={sel.assessment} withLabel /> : null}
        </View>
      ) : (
        <Text className="text-xs text-neutral-400">Tap a point for its value.</Text>
      )}

      <View className="flex-row flex-wrap gap-x-4 gap-y-1">
        <Legend swatch={{ backgroundColor: BRAND, borderRadius: 5 }} label="This child" />
        <Legend swatch={{ backgroundColor: BAND, height: 2 }} label="Median (50th)" />
        <Legend swatch={{ backgroundColor: BAND, opacity: 0.4 }} label="15th–85th" />
        <Legend swatch={{ backgroundColor: BAND, opacity: 0.18 }} label="3rd–97th" />
      </View>
      <Text className="text-xs text-neutral-500">
        WHO Child Growth Standards (2006), {sex === "male" ? "boys" : "girls"},
        birth to 5 years.
        {indicator === "length"
          ? " Lying length to 2 years, standing height after; a value measured the other way is adjusted by 0.7 cm."
          : ""}
        {model.beyond > 0
          ? ` ${model.beyond} measurement${model.beyond === 1 ? "" : "s"} after age 5 ${model.beyond === 1 ? "is" : "are"} in the table, not the chart.`
          : ""}
      </Text>
    </View>
  );
}

function Legend({
  swatch,
  label,
}: {
  swatch: Record<string, string | number>;
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View style={{ width: 14, height: 10, ...swatch }} />
      <Text className="text-xs text-neutral-500">{label}</Text>
    </View>
  );
}

/** The patient's own values with no reference, when WHO ranges cannot be drawn. */
export function PlainGrowthChart({
  rows,
  metric,
  dateOfBirth,
  reason,
}: {
  rows: WellnessRow[];
  metric: Metric;
  dateOfBirth?: string | null;
  reason: string;
}) {
  const { unit } = METRICS[metric];
  const { width, onLayout } = useWidth();
  const [selected, setSelected] = useState<number | null>(null);
  const byAge =
    rows.length > 0 &&
    rows.every((r) => ageInMonths(dateOfBirth, r.measuredOn) != null);
  const points = rows
    .filter((r) => r[metric] != null)
    .map((r) => ({
      x: byAge
        ? (ageInMonths(dateOfBirth, r.measuredOn) as number)
        : new Date(r.measuredOn).getTime(),
      value: r[metric] as number,
      on: r.measuredOn,
    }))
    .sort((a, b) => a.x - b.x);

  const xs = points.map((p) => p.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const domain = niceDomain(points.map((p) => p.value));
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = CHART_H - PAD.top - PAD.bottom;
  const xOf = (v: number) =>
    PAD.left + (xMax === xMin ? plotW / 2 : ((v - xMin) / (xMax - xMin)) * plotW);
  const yOf = (v: number) =>
    PAD.top + (1 - (v - domain[0]) / (domain[1] - domain[0])) * plotH;
  const xTicks =
    points.length <= 1 ? xs : [xMin, xMin + (xMax - xMin) / 2, xMax];
  const fmtX = (v: number) =>
    byAge ? ageLabel(v) : new Date(v).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  const sel = selected != null ? points[selected] : null;

  return (
    <View className="gap-2">
      <Text className="text-xs text-neutral-500">{unit}</Text>
      <View onLayout={onLayout} style={{ height: CHART_H, width: "100%" }}>
        {width > 0 && points.length > 0 ? (
          <>
            <Axes
              width={width}
              xTicks={xTicks}
              xOf={xOf}
              yTickValues={yTicks(domain)}
              yOf={yOf}
              xLabel={fmtX}
            />
            <ChildLine
              points={points.map((p) => ({ x: xOf(p.x), y: yOf(p.value) }))}
              selected={selected}
              onSelect={(i) => setSelected(selected === i ? null : i)}
            />
          </>
        ) : null}
      </View>
      {sel ? (
        <Text className="text-sm text-neutral-800">
          <Text className="font-semibold">
            {sel.value} {unit}
          </Text>{" "}
          · {new Date(sel.on).toLocaleDateString("en-IN")}
          {byAge ? ` · age ${ageLabel(sel.x)}` : ""}
        </Text>
      ) : null}
      <Text className="text-xs text-neutral-500">{reason}</Text>
    </View>
  );
}

