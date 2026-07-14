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

export function applyDiscount(
  feeBase: number,
  discountPct: number,
  maxDiscountPercent?: number | null
): number {
  const cap = maxDiscountPercent ?? 100;
  const d = Math.min(Math.max(discountPct, 0), cap);
  return Math.round(feeBase * (1 - d / 100) * 100) / 100;
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
      id: typeof e.id === "string" ? e.id : randomId(),
      toothId: typeof e.toothId === "string" ? e.toothId : "",
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
      suggestedTreatmentFees: hasFees
        ? entry.suggestedTreatmentFees
        : match.suggestedTreatmentFees,
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
    id: e.id,
    toothId: e.toothId,
    problem: e.problem,
    note: e.note ?? "",
    priority: 1,
    fee: e.fee,
    suggestedTreatmentFees: e.suggestedTreatmentFees ?? undefined,
    suggestedTreatmentNextDates: e.suggestedTreatmentNextDates ?? undefined,
    nextAppointmentDate: e.nextAppointmentDate,
    nextAppointmentTime: e.nextAppointmentTime,
    nextAppointmentReason: e.nextAppointmentReason,
    suggestedTreatments: e.suggestedTreatments ?? [],
    treatmentStatus: e.treatmentStatus ?? "planned",
    treatmentProviders: e.treatmentProviders ?? [],
  }));
}

export function isPlanBillable(row: DentalTreatmentPlanRow): boolean {
  const fee = row.totalFee ?? row.providers.reduce((s, p) => s + (p.fee || 0), 0);
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
