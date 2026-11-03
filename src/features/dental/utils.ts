import type {
  DentalTreatmentPlanRow,
  DiagnosisDetailsEntry,
  TeethStates,
  TreatmentProvider,
} from "./types";

export type DentalDiagnosisClonePair = {
  sourceId: string;
  newId: string;
  toothId: string;
};

export function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `care-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Same slug rules as Practice diagnosis-types autocomplete / POST route. */
export function slugFromLabel(label: string): string {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") || "diagnosis"
  );
}

export function uniqueValueFromSlug(
  base: string,
  selectedValues: string[]
): string {
  let value = base;
  let n = 1;
  while (selectedValues.includes(value)) {
    value = `${base}_${++n}`;
  }
  return value;
}

export function normalizeFee(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Duplicate findings onto clone targets. Skips existing toothId+problem pairs.
 * Returns cloned pairs + skipped count (for toast).
 */
export function cloneFindingsToTeeth(
  entries: DiagnosisDetailsEntry[],
  selectedTooth: string,
  cloneToToothIds: string[]
): {
  entries: DiagnosisDetailsEntry[];
  clonedPairs: DentalDiagnosisClonePair[];
  skippedCount: number;
} {
  const rawTargets = cloneToToothIds.map((t) => String(t).trim()).filter(Boolean);
  const targets = [...new Set(rawTargets)].filter((t) => t !== selectedTooth);
  if (targets.length === 0) {
    return { entries, clonedPairs: [], skippedCount: 0 };
  }

  const result = [...entries];
  const keySet = new Set(result.map((e) => `${e.toothId}\t${e.problem}`));
  const sourceRows = result.filter((e) => e.toothId === selectedTooth);
  const clonedPairs: DentalDiagnosisClonePair[] = [];
  let skippedCount = 0;

  for (const tid of targets) {
    for (const src of sourceRows) {
      const key = `${tid}\t${src.problem}`;
      if (keySet.has(key)) {
        skippedCount += 1;
        continue;
      }
      const newId = randomId();
      keySet.add(key);
      clonedPairs.push({ sourceId: src.id, newId, toothId: tid });
      result.push({ ...src, id: newId, toothId: tid });
    }
  }

  return { entries: result, clonedPairs, skippedCount };
}

/** Match plan row to FDI tooth via findingSummary.tooth formats. */
export function planRowBelongsToTooth(
  row: DentalTreatmentPlanRow,
  toothId: string
): boolean {
  const raw = row.findingSummary?.tooth?.trim() ?? "";
  if (!raw) return false;
  if (raw === toothId) return true;
  const m = /^Tooth\s+(.+)$/i.exec(raw);
  const bare = (m?.[1] ?? raw).trim();
  return bare === toothId;
}

export function filterPlanRowsAfterRemovingTooth(
  plan: DentalTreatmentPlanRow[],
  toothId: string,
  removedDiagnosisIds: Set<string>
): DentalTreatmentPlanRow[] {
  return plan.filter((row) => {
    const did = String(row.diagnosisEntryId ?? "").trim();
    if (did && removedDiagnosisIds.has(did)) return false;
    if (planRowBelongsToTooth(row, toothId)) return false;
    return true;
  });
}

/**
 * Append plan rows for cloned diagnosis ids (Practice planRowsWithClonedDiagnosisLinks).
 */
export function planRowsWithClonedDiagnosisLinks(
  plan: DentalTreatmentPlanRow[],
  pairs: DentalDiagnosisClonePair[]
): DentalTreatmentPlanRow[] {
  if (pairs.length === 0) return plan;

  const existingDiagnosisIds = new Set(
    plan
      .map((r) => String(r.diagnosisEntryId ?? "").trim())
      .filter(Boolean)
  );

  const additions: DentalTreatmentPlanRow[] = [];
  for (const { sourceId, newId, toothId } of pairs) {
    const newKey = String(newId).trim();
    if (!newKey || existingDiagnosisIds.has(newKey)) continue;

    const sourceRow = plan.find(
      (row) => String(row.diagnosisEntryId ?? "") === String(sourceId)
    );
    if (!sourceRow) continue;

    const fs = sourceRow.findingSummary;
    additions.push({
      ...sourceRow,
      id: randomId(),
      diagnosisEntryId: newId,
      findingSummary: fs
        ? { ...fs, tooth: `Tooth ${toothId}` }
        : {
            tooth: `Tooth ${toothId}`,
            conditionsText: "",
            clinicalNote: "",
            suggestedOptions: [],
          },
      linkedFollowUpAppointmentId: undefined,
    });
    existingDiagnosisIds.add(newKey);
  }

  if (additions.length === 0) return plan;
  return [...plan, ...additions];
}

export function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toDateOnly(v: unknown): string {
  if (v == null || typeof v !== "string") return "";
  return v.includes("T") ? v.slice(0, 10) : v.trim();
}

export function clampDateToToday(ymd: string): string {
  const d = toDateOnly(ymd);
  if (!d) return todayYmd();
  return d < todayYmd() ? todayYmd() : d;
}

export function normalizeTimeHHmm(v?: string | null): string {
  const t = (v ?? "").trim();
  if (/^\d{1,2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(":");
    return `${h.padStart(2, "0")}:${m}`;
  }
  return "10:00";
}

export function feeStringFromCatalogDefault(
  catalogDefaultFee?: number
): string {
  if (catalogDefaultFee === undefined) return "";
  if (!Number.isFinite(catalogDefaultFee) || catalogDefaultFee < 0) return "";
  return String(Math.round(catalogDefaultFee * 100) / 100);
}

/*
 * Treatment discounts are ENTERED IN RUPEES (mirrors Practice
 * `components/consult/diagnosis-dialog/utils.ts`). The rate card's
 * `maxDiscountPercent` stays a percent on the catalogue and is converted to
 * rupees per row. On save the finding carries net fees, original fees and a
 * DERIVED, UNROUNDED percent — see `feeMapsFromTreatmentRows`.
 */

export function formatMoneyLikeInput(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function getEffectiveDiscountCap(
  maxDiscountPercent?: number | null
): number {
  if (
    typeof maxDiscountPercent === "number" &&
    Number.isFinite(maxDiscountPercent)
  ) {
    return Math.min(100, Math.max(0, maxDiscountPercent));
  }
  return 100;
}

/** Original fee text. The discount never overwrites it. */
export function originalFeeText(row: { feeBase?: string; fee?: string }): string {
  const base = String(row.feeBase ?? "").trim();
  return base || String(row.fee ?? "").trim();
}

/**
 * Rate-card percent cap → rupees for THIS row, rounded DOWN to the paisa so
 * the largest allowed amount can never derive a percent above the cap
 * (15% of ₹333.33 is ₹49.9995 → ₹49.99, not ₹50).
 */
export function discountCapRupees(
  feeBase: string,
  maxDiscountPercent?: number | null
): number {
  const base = Number(String(feeBase ?? "").trim());
  if (!Number.isFinite(base) || base <= 0) return 0;
  const pct = getEffectiveDiscountCap(maxDiscountPercent);
  return Math.floor(base * pct + 1e-6) / 100;
}

/** Net = original − amount, bounded by the cap and by the fee. Empty → original. */
export function computeDiscountedFee(
  feeBase: string,
  discountAmount: string,
  capRupees: number
): string {
  const base = Number(String(feeBase).trim());
  if (!Number.isFinite(base) || base < 0) return "";
  const raw = String(discountAmount ?? "").trim();
  if (!raw) return formatMoneyLikeInput(base);
  const discount = Number(raw);
  if (!Number.isFinite(discount)) return formatMoneyLikeInput(base);
  const bounded = Math.min(capRupees, base, Math.max(0, discount));
  return formatMoneyLikeInput(base - bounded);
}

/** Saved row's discount rebuilt as original − net (exact). "" = no discount. */
export function discountAmountFromFees(feeBase: string, fee: string): string {
  const base = Number(String(feeBase ?? "").trim());
  const net = Number(String(fee ?? "").trim());
  if (!Number.isFinite(base) || !Number.isFinite(net)) return "";
  const amount = base - net;
  return amount > 0.005 ? formatMoneyLikeInput(amount) : "";
}

/**
 * The three fee maps written onto a finding. The percent is derived from
 * (original − net) and deliberately UNROUNDED: Practice recomputes the billed
 * line as `original × (1 − pct/100)`, so ₹100 off ₹300 stored as 33.33 would
 * bill ₹200.01.
 */
export function feeMapsFromTreatmentRows(
  rows: {
    treatmentName?: string;
    fee?: string;
    feeBase?: string;
    discountAmount?: string;
  }[]
): {
  suggestedTreatmentFees: Record<string, number>;
  suggestedTreatmentFeeBases: Record<string, number>;
  suggestedTreatmentDiscountPcts: Record<string, number>;
} {
  const suggestedTreatmentFees: Record<string, number> = {};
  const suggestedTreatmentFeeBases: Record<string, number> = {};
  const suggestedTreatmentDiscountPcts: Record<string, number> = {};
  for (const row of rows) {
    const name = String(row.treatmentName ?? "").trim();
    if (!name) continue;
    const net = Number(row.fee);
    if (Number.isFinite(net) && net >= 0) suggestedTreatmentFees[name] = net;
    const base = Number(originalFeeText(row));
    if (Number.isFinite(base) && base >= 0) {
      suggestedTreatmentFeeBases[name] = base;
    }
    if (
      String(row.discountAmount ?? "").trim() &&
      Number.isFinite(base) &&
      base > 0 &&
      Number.isFinite(net) &&
      net >= 0 &&
      base - net > 0.005
    ) {
      suggestedTreatmentDiscountPcts[name] = ((base - net) / base) * 100;
    }
  }
  return {
    suggestedTreatmentFees,
    suggestedTreatmentFeeBases,
    suggestedTreatmentDiscountPcts,
  };
}

/** `{ name: number }` map from loose JSON; drops blank keys and non-finite values. */
export function parseNamedNumberMap(
  raw: unknown
): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k).trim();
    const n = Number(v);
    if (!key || !Number.isFinite(n) || n < 0) continue;
    out[key] = n;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function deriveTeethStates(
  entries: DiagnosisDetailsEntry[]
): TeethStates {
  const byTooth = new Map<
    string,
    { problem: string; note: string; priority: number }
  >();
  for (const e of entries) {
    if (!e.toothId || byTooth.has(e.toothId)) continue;
    byTooth.set(e.toothId, {
      problem: e.problem,
      note: e.note ?? "",
      priority: 1,
    });
  }
  return Object.fromEntries(byTooth);
}

export function treatmentOrderFromEntries(
  entries: DiagnosisDetailsEntry[]
): string[] {
  return Array.from(new Set(entries.map((e) => e.toothId).filter(Boolean)));
}

export function parseTreatmentProviders(
  raw: unknown
): TreatmentProvider[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: TreatmentProvider[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const doctorId = typeof o.doctorId === "string" ? o.doctorId : "";
    if (!doctorId.trim()) continue;
    const role =
      typeof o.role === "string" && o.role.trim() ? o.role : "Primary";
    const feeRaw = o.fee;
    const fee =
      typeof feeRaw === "number"
        ? feeRaw
        : typeof feeRaw === "string"
          ? Number(feeRaw) || 0
          : 0;
    out.push({ doctorId, role, fee });
  }
  return out.length > 0 ? out : undefined;
}

export function mapRawToDiagnosisEntries(
  rawEntries: unknown[]
): DiagnosisDetailsEntry[] {
  return rawEntries.map((raw) => {
    const e = (raw && typeof raw === "object" ? raw : {}) as Record<
      string,
      unknown
    >;
    return {
      // Keep every field Practice wrote, including ones Care does not know.
      // `PUT /api/consult/dental` overwrites the whole document, so a field
      // dropped here is deleted on the next save (this is how Practice-entered
      // discounts used to vanish).
      ...e,
      id: typeof e.id === "string" ? e.id : randomId(),
      toothId: typeof e.toothId === "string" ? e.toothId : "",
      suggestedTreatmentFeeBases: parseNamedNumberMap(
        e.suggestedTreatmentFeeBases
      ),
      suggestedTreatmentDiscountPcts: parseNamedNumberMap(
        e.suggestedTreatmentDiscountPcts
      ),
      problem: typeof e.problem === "string" ? e.problem : "",
      note: typeof e.note === "string" ? e.note : undefined,
      fee: typeof e.fee === "number" ? e.fee : undefined,
      suggestedTreatmentFees:
        e.suggestedTreatmentFees &&
        typeof e.suggestedTreatmentFees === "object" &&
        !Array.isArray(e.suggestedTreatmentFees)
          ? Object.fromEntries(
              Object.entries(
                e.suggestedTreatmentFees as Record<string, unknown>
              )
                .map(([k, v]) => [k, Number(v)])
                .filter(
                  ([k, v]) => Boolean(String(k).trim()) && Number.isFinite(v)
                )
            )
          : undefined,
      suggestedTreatmentNextDates: (() => {
        const rawDates = e.suggestedTreatmentNextDates;
        if (!rawDates || typeof rawDates !== "object" || Array.isArray(rawDates))
          return undefined;
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(
          rawDates as Record<string, unknown>
        )) {
          const key = String(k).trim();
          if (!key) continue;
          const d = toDateOnly(String(v));
          if (d) out[key] = d;
        }
        return Object.keys(out).length > 0 ? out : undefined;
      })(),
      nextAppointmentDate: toDateOnly(e.nextAppointmentDate) || undefined,
      nextAppointmentTime:
        typeof e.nextAppointmentTime === "string" &&
        e.nextAppointmentTime.trim()
          ? e.nextAppointmentTime.trim()
          : undefined,
      nextAppointmentReason:
        typeof e.nextAppointmentReason === "string"
          ? e.nextAppointmentReason
          : undefined,
      suggestedTreatments: Array.isArray(e.suggestedTreatments)
        ? e.suggestedTreatments.filter((t): t is string => typeof t === "string")
        : undefined,
      treatmentStatus:
        e.treatmentStatus === "planned" ||
        e.treatmentStatus === "in-progress" ||
        e.treatmentStatus === "done"
          ? e.treatmentStatus
          : undefined,
      treatmentProviders: parseTreatmentProviders(e.treatmentProviders),
    };
  });
}

export function mapRawToPlanRows(raw: unknown[]): DentalTreatmentPlanRow[] {
  return raw.map((item, i) => {
    const r = (item && typeof item === "object" ? item : {}) as Record<
      string,
      unknown
    >;
    const status =
      r.status === "planned" ||
      r.status === "in-progress" ||
      r.status === "done"
        ? r.status
        : "planned";
    const providers = parseTreatmentProviders(r.providers) ?? [];
    const findingSummary =
      r.findingSummary && typeof r.findingSummary === "object"
        ? (r.findingSummary as DentalTreatmentPlanRow["findingSummary"])
        : null;
    return {
      // Keep every field Practice wrote (originalFeesByName, discountPctsByName,
      // discountPct, …). PATCH replaces the whole `treatmentPlanItems` array,
      // so anything dropped here is erased server-side — and the doctor's
      // discount voucher disappears with it.
      ...r,
      id: typeof r.id === "string" ? r.id : randomId(),
      treatmentName:
        typeof r.treatmentName === "string"
          ? r.treatmentName
          : `Treatment ${i + 1}`,
      treatmentNames: Array.isArray(r.treatmentNames)
        ? r.treatmentNames.filter((t): t is string => typeof t === "string")
        : undefined,
      treatmentOther:
        typeof r.treatmentOther === "string" ? r.treatmentOther : undefined,
      plannedDate: toDateOnly(r.plannedDate) || undefined,
      plannedTime:
        typeof r.plannedTime === "string" ? r.plannedTime : undefined,
      actualDate: toDateOnly(r.actualDate) || undefined,
      plannedTreatment:
        typeof r.plannedTreatment === "string"
          ? r.plannedTreatment
          : undefined,
      actualTreatment:
        typeof r.actualTreatment === "string" ? r.actualTreatment : undefined,
      status,
      providers,
      totalFee: typeof r.totalFee === "number" ? r.totalFee : undefined,
      diagnosisEntryId:
        typeof r.diagnosisEntryId === "string"
          ? r.diagnosisEntryId
          : undefined,
      findingSummary,
      selectedActuals: Array.isArray(r.selectedActuals)
        ? (r.selectedActuals as DentalTreatmentPlanRow["selectedActuals"])
        : undefined,
      linkedFollowUpAppointmentId:
        typeof r.linkedFollowUpAppointmentId === "string"
          ? r.linkedFollowUpAppointmentId
          : undefined,
    };
  });
}

export function mergeSuggestedTreatmentsFromPrior(
  current: DiagnosisDetailsEntry[],
  prior: DiagnosisDetailsEntry[]
): DiagnosisDetailsEntry[] {
  return current.map((entry) => {
    const match = prior.find(
      (p) => p.toothId === entry.toothId && p.problem === entry.problem
    );
    if (!match) return entry;

    const hasSug =
      Array.isArray(entry.suggestedTreatments) &&
      entry.suggestedTreatments.some((t) => String(t).trim());
    const hasFees =
      entry.suggestedTreatmentFees &&
      Object.keys(entry.suggestedTreatmentFees).length > 0;
    const hasRowDates =
      entry.suggestedTreatmentNextDates &&
      Object.keys(entry.suggestedTreatmentNextDates).length > 0;
    const hasProviders =
      Array.isArray(entry.treatmentProviders) &&
      entry.treatmentProviders.length > 0;

    const nextDate = (entry.nextAppointmentDate ?? "").trim();
    const nextTime = (entry.nextAppointmentTime ?? "").trim();
    const nextReason = (entry.nextAppointmentReason ?? "").trim();

    return {
      ...entry,
      suggestedTreatments: hasSug
        ? entry.suggestedTreatments
        : match.suggestedTreatments,
      // The three fee maps travel together: net, original and discount
      // describe one decision, and mixing a current net with a prior original
      // would invent a discount nobody gave.
      suggestedTreatmentFees: hasFees
        ? entry.suggestedTreatmentFees
        : match.suggestedTreatmentFees,
      suggestedTreatmentFeeBases: hasFees
        ? entry.suggestedTreatmentFeeBases
        : match.suggestedTreatmentFeeBases,
      suggestedTreatmentDiscountPcts: hasFees
        ? entry.suggestedTreatmentDiscountPcts
        : match.suggestedTreatmentDiscountPcts,
      suggestedTreatmentNextDates: hasRowDates
        ? entry.suggestedTreatmentNextDates
        : match.suggestedTreatmentNextDates,
      treatmentProviders: hasProviders
        ? entry.treatmentProviders
        : match.treatmentProviders,
      nextAppointmentDate: nextDate || match.nextAppointmentDate,
      nextAppointmentTime: nextTime || match.nextAppointmentTime,
      nextAppointmentReason: nextReason || match.nextAppointmentReason,
    };
  });
}

export function entriesToPostBody(entries: DiagnosisDetailsEntry[]) {
  return entries.map((e) => ({
    // Unknown fields round-trip untouched; the ones Care owns are set below.
    ...e,
    id: e.id,
    toothId: e.toothId,
    problem: e.problem,
    note: e.note ?? "",
    priority: 1,
    fee: e.fee,
    suggestedTreatmentFees: e.suggestedTreatmentFees ?? undefined,
    suggestedTreatmentFeeBases: e.suggestedTreatmentFeeBases ?? undefined,
    suggestedTreatmentDiscountPcts:
      e.suggestedTreatmentDiscountPcts ?? undefined,
    suggestedTreatmentNextDates: e.suggestedTreatmentNextDates ?? undefined,
    nextAppointmentDate: e.nextAppointmentDate,
    nextAppointmentTime: e.nextAppointmentTime,
    nextAppointmentReason: e.nextAppointmentReason,
    suggestedTreatments: e.suggestedTreatments ?? [],
    treatmentStatus: e.treatmentStatus ?? "planned",
    treatmentProviders: e.treatmentProviders ?? [],
  }));
}

/** Look up fee for one treatment name from finding map or catalog. */
export function feeForTreatmentName(
  name: string,
  fees?: Record<string, number> | null,
  catalog?: { name: string; defaultFee?: number }[]
): number {
  const key = name.trim().toLowerCase();
  if (!key) return 0;
  if (fees) {
    const exact = fees[name];
    if (typeof exact === "number" && Number.isFinite(exact) && exact >= 0) {
      return exact;
    }
    const hit = Object.entries(fees).find(
      ([k]) => k.trim().toLowerCase() === key
    );
    if (hit && Number.isFinite(hit[1]) && hit[1] >= 0) return hit[1];
  }
  const cat = catalog?.find((c) => c.name.trim().toLowerCase() === key);
  if (cat && typeof cat.defaultFee === "number" && cat.defaultFee > 0) {
    return cat.defaultFee;
  }
  return 0;
}

const nameKey = (v: string) => v.trim().toLowerCase();

/**
 * Discount % for one treatment on a plan row — Practice
 * `namedDiscountPercent`. Once `discountPctsByName` has ANY entry it is
 * authoritative (a name missing from it is undiscounted); the legacy single
 * `discountPct` is read only when the map is empty, otherwise one treatment's
 * discount would be broadcast to every treatment sharing the row.
 */
function planRowDiscountPercent(
  row: DentalTreatmentPlanRow,
  name: string
): number | null {
  const map = parseNamedNumberMap(row.discountPctsByName);
  if (map) {
    const hit = Object.entries(map).find(([k]) => nameKey(k) === nameKey(name));
    return hit && hit[1] > 0 ? hit[1] : null;
  }
  const legacy = Number(row.discountPct);
  return Number.isFinite(legacy) && legacy > 0 ? legacy : null;
}

/**
 * NET fee per treatment recorded on the plan row itself:
 * `originalFeesByName × (1 − discount%)`. Practice treats this as the most
 * authoritative fee for a treated item (`namedBilledFeeFromRow`), ahead of the
 * finding's map and the catalogue — the catalogue is the GROSS price, so
 * falling through to it would bill a discounted treatment in full.
 */
export function planRowNetFeesByName(
  row: Pick<
    DentalTreatmentPlanRow,
    "originalFeesByName" | "discountPctsByName" | "discountPct"
  >
): Record<string, number> {
  const out: Record<string, number> = {};
  const originals = parseNamedNumberMap(row.originalFeesByName);
  if (!originals) return out;
  for (const [name, original] of Object.entries(originals)) {
    if (!(original > 0)) continue;
    const pct = planRowDiscountPercent(row as DentalTreatmentPlanRow, name);
    out[name] =
      pct != null && pct > 0 && pct < 100
        ? Math.round(original * (1 - pct / 100) * 100) / 100
        : original;
  }
  return out;
}

/** Sum of catalog/finding fees for treatments moved to Treated. */
export function selectedActualsTreatmentFee(
  selectedActuals: { name: string }[] | undefined,
  fees?: Record<string, number> | null,
  catalog?: { name: string; defaultFee?: number }[]
): number {
  const seen = new Set<string>();
  let sum = 0;
  for (const a of selectedActuals ?? []) {
    const n = String(a.name ?? "").trim();
    const k = n.toLowerCase();
    if (!n || seen.has(k)) continue;
    seen.add(k);
    sum += feeForTreatmentName(n, fees, catalog);
  }
  return normalizeFee(sum);
}

export function providerFeeSum(
  providers: { fee?: number }[] | undefined
): number {
  return normalizeFee(
    (providers ?? []).reduce((s, p) => s + (Number(p.fee) || 0), 0)
  );
}

/**
 * Billable plan total = treated treatment costs + doctor fee split.
 * For linked rows with selectedActuals, always recompute so older provider-only
 * totals still pick up treatment costs.
 */
export function planRowBillableFee(
  row: DentalTreatmentPlanRow,
  findingFees?: Record<string, number> | null,
  catalog?: { name: string; defaultFee?: number }[]
): number {
  const providerSum = providerFeeSum(row.providers);
  // Most authoritative last: saved snapshot < live finding < the row's own
  // net fees. The catalogue (gross) is only reached when none has the name.
  const fees = {
    ...(row.findingSummary?.suggestedTreatmentFees ?? {}),
    ...(findingFees ?? {}),
    ...planRowNetFeesByName(row),
  };
  const treatmentSum = selectedActualsTreatmentFee(
    row.selectedActuals,
    fees,
    catalog
  );
  if (row.diagnosisEntryId && (row.selectedActuals?.length ?? 0) > 0) {
    return normalizeFee(treatmentSum + providerSum);
  }
  if (row.totalFee != null && Number.isFinite(row.totalFee)) {
    return normalizeFee(row.totalFee);
  }
  return providerSum;
}

export function isPlanBillable(row: DentalTreatmentPlanRow): boolean {
  const fee = planRowBillableFee(row);
  return row.status === "done" || (row.status === "in-progress" && fee > 0);
}

export function doneDiagnosisEntryIds(
  planItems: DentalTreatmentPlanRow[]
): Set<string> {
  const ids = new Set<string>();
  for (const p of planItems) {
    if (p.diagnosisEntryId && p.status === "done") {
      ids.add(p.diagnosisEntryId);
    }
  }
  return ids;
}

export function linkedDiagnosisEntryIds(
  planItems: DentalTreatmentPlanRow[]
): Set<string> {
  const ids = new Set<string>();
  for (const p of planItems) {
    if (p.diagnosisEntryId) ids.add(p.diagnosisEntryId);
  }
  return ids;
}
