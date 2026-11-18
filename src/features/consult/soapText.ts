/**
 * How a diagnosis code becomes text in a note. Ported from Practice
 * components/consult/ClinicalNotesSection.tsx and lib/consult/diagnosis-text.ts.
 * Pure, so it can be checked outside the app.
 */

export type CodeSystem = "ICD-10" | "SNOMED";

export interface RecentDiagnosisCode {
  code: string;
  label: string;
  system: CodeSystem;
}

/**
 * "Label (CODE)", or the bare code with no label. SNOMED ids are bare integers, so
 * they carry the system name: "(22298006)" alone tells a reader nothing.
 */
export function formatCodeLine(
  code: string,
  system: string | null | undefined,
  label: string | null | undefined
): string {
  const c = code.trim();
  const l = (label ?? "").trim();
  const tag = system === "SNOMED" && c ? `SNOMED ${c}` : c;
  if (l && tag) return `${l} (${tag})`;
  return l || tag;
}

/**
 * Insert `text` at `[start, end)` as its own line(s): a line break before it unless
 * it starts the field or follows one, and after it unless it ends the field or
 * precedes one. Returns the new value and where the caret belongs.
 */
export function insertAsLines(
  value: string,
  text: string,
  start: number,
  end: number
): { value: string; caret: number } {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const lead = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
  const trail = after.length > 0 && !after.startsWith("\n") ? "\n" : "";
  return {
    value: before + lead + text + trail + after,
    caret: before.length + lead.length + text.length,
  };
}

/** Saved codes as "Label (CODE)" lines, primary first. Older consults still hold them. */
export function formatDiagnosisCodes(raw: unknown): string {
  if (!Array.isArray(raw)) return "";
  const rows = raw
    .map((r) =>
      r && typeof r === "object"
        ? (r as {
            code?: string;
            label?: string | null;
            isPrimary?: boolean;
          })
        : null
    )
    .filter(
      (r): r is NonNullable<typeof r> =>
        !!r && !!((r.code ?? "").trim() || (r.label ?? "").trim())
    );
  if (rows.length === 0) return "";
  rows.sort(
    (a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary))
  );
  return rows
    .map((r) => {
      const label = (r.label ?? "").trim();
      const code = (r.code ?? "").trim();
      return label && code ? `${label} (${code})` : label || code;
    })
    .filter(Boolean)
    .join("\n");
}

/** Match against the short recent list (code or label, ignoring case and dots). */
export function matchesRecent(r: RecentDiagnosisCode, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const qCode = q.replace(/\./g, "");
  return (
    r.label.toLowerCase().includes(q) ||
    r.code.toLowerCase().replace(/\./g, "").includes(qCode)
  );
}

/** Move `entry` to the front, deduped on system + code, keeping the last `max`. */
export function nextRecent(
  current: RecentDiagnosisCode[],
  entry: RecentDiagnosisCode,
  max: number
): RecentDiagnosisCode[] {
  return [
    entry,
    ...current.filter(
      (r) => !(r.system === entry.system && r.code === entry.code)
    ),
  ].slice(0, max);
}
