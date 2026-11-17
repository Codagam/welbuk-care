/**
 * Medicines the doctor prescribed in a SpeakADoc conversation, on their way
 * into the prescription DRAFT (client state until the doctor saves it).
 *
 * Port of Practice `lib/speakadoc/map-orders.ts` (`medicinesToDraftLines`),
 * kept byte-for-byte in behaviour: nothing is invented, a field the doctor did
 * not say stays empty so the prescription card asks for it, and a medicine
 * already on the consult is skipped so a re-finalize never adds it twice.
 *
 * The Live Conversation panel and the Plan of care section are separate trees
 * on the consult screen, so the lines travel through a small inbox keyed by
 * consultation. `usePrescriptionDraft` takes them once it has hydrated.
 */
import { create } from "zustand";

import { newPrescriptionId } from "../plan-of-care/prescriptionDraftStore";
import { courseDays, type DurationUnit } from "../plan-of-care/sig";
import type { PlanPrescription } from "../plan-of-care/types";

/** A medicine the doctor prescribed; every detail is null unless it was said. */
export interface SpeakadocExtractedMedicine {
  name: string;
  strength: string | null;
  form: string | null;
  /** Morning-afternoon-night counts, e.g. "1-0-1". */
  dosePattern: string | null;
  frequency: string | null;
  foodTiming:
    | "before_food"
    | "after_food"
    | "with_food"
    | "empty_stomach"
    | "bedtime"
    | null;
  durationValue: number | null;
  durationUnit: "days" | "weeks" | "months" | null;
  instructions: string | null;
}

export interface SpeakadocConsultExtraction {
  status: "complete" | "failed";
  medicines?: SpeakadocExtractedMedicine[];
}

/** The part of SpeakADoc's finalize payload the app reads itself. */
export function readExtraction(data: unknown): SpeakadocConsultExtraction | null {
  const ex = (data as { consultExtraction?: unknown } | null)?.consultExtraction;
  if (!ex || typeof ex !== "object") return null;
  const status = (ex as { status?: unknown }).status;
  if (status !== "complete" && status !== "failed") return null;
  return ex as SpeakadocConsultExtraction;
}

/** Lowercase, punctuation-free, single-spaced: "X-Ray  Chest." -> "x ray chest". */
function normalizeOrderName(name: string | null | undefined): string {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9஀-௿]+/g, " ")
    .trim();
}

/** Only where unambiguous ("twice a day" -> 1-0-1); otherwise null (kept as a note). */
function dosePatternFromFrequency(frequency: string | null | undefined): string | null {
  const f = String(frequency ?? "").toLowerCase();
  if (!f) return null;
  if (/\b(when needed|as needed|if needed|sos|prn)\b/.test(f)) return null;
  if (/\b(thrice|three times)\b/.test(f)) return "1-1-1";
  if (/\b(twice|two times)\b/.test(f) || /morning and (night|evening)/.test(f)) return "1-0-1";
  if (/\b(night|bedtime|bed time)\b/.test(f) && !/morning/.test(f)) return "0-0-1";
  if (/\bmorning\b/.test(f) && !/(night|evening|afternoon)/.test(f)) return "1-0-0";
  return null;
}

const FOOD_TIMING: Record<string, "BF" | "AF"> = {
  before_food: "BF",
  empty_stomach: "BF",
  after_food: "AF",
  with_food: "AF",
};

const UNIT: Record<string, DurationUnit> = {
  days: "DAYS",
  weeks: "WEEKS",
  months: "MONTHS",
};

/** Spacing-insensitive: "Pantoprazole 40 mg" and "Pantoprazole 40mg" match. */
const compact = (name: string) => normalizeOrderName(name).replace(/\s+/g, "");

/** Same name, or one is the other plus a strength (prefix needs ≥ 4 chars). */
function alreadyListed(base: string, full: string, existing: Set<string>): boolean {
  for (const e of existing) {
    if (e === full || e === base) return true;
    if (base.length >= 4 && e.startsWith(base)) return true;
    if (e.length >= 4 && full.startsWith(e)) return true;
  }
  return false;
}

export function medicinesToDraftLines(
  medicines: SpeakadocExtractedMedicine[] | null | undefined,
  existingNames: (string | null | undefined)[]
): PlanPrescription[] {
  const seen = new Set(
    existingNames.map((n) => compact(String(n ?? ""))).filter(Boolean)
  );
  const out: PlanPrescription[] = [];
  for (const med of Array.isArray(medicines) ? medicines : []) {
    const base = String(med?.name ?? "").trim();
    if (!base) continue;
    const strength = med.strength?.trim();
    const name = (
      strength && !normalizeOrderName(base).includes(normalizeOrderName(strength))
        ? `${base} ${strength}`
        : base
    ).slice(0, 160);
    const key = compact(name);
    const baseKey = compact(base);
    if (!baseKey || alreadyListed(baseKey, key, seen)) continue;
    seen.add(key);

    const fromFrequency = dosePatternFromFrequency(med.frequency);
    const dosePattern = med.dosePattern?.trim() || fromFrequency || "";
    const unit = med.durationUnit ? UNIT[med.durationUnit] : undefined;
    const value = med.durationValue;
    const hasCourse =
      Boolean(unit) && typeof value === "number" && Number.isInteger(value) && value > 0;

    const noteParts = [
      !med.dosePattern && !fromFrequency && med.frequency ? med.frequency.trim() : "",
      med.instructions?.trim() ?? "",
    ].filter(Boolean);

    const days = hasCourse
      ? courseDays({ durationValue: value as number, durationUnit: unit })
      : null;

    out.push({
      id: newPrescriptionId(),
      name,
      dosePattern,
      foodTiming: med.foodTiming ? (FOOD_TIMING[med.foodTiming] ?? "") : "",
      duration: days != null ? String(days) : "",
      durationValue: hasCourse ? (value as number) : null,
      durationUnit: hasCourse ? (unit as DurationUnit) : null,
      doseNote: noteParts.length ? noteParts.join(". ").slice(0, 500) : null,
      // Filled without the doctor typing it: drives the child-patient dose check.
      autoFilled: true,
    });
  }
  return out;
}

// ---- Inbox ----------------------------------------------------------------

type Pending = { medicines: SpeakadocExtractedMedicine[]; resolve: (added: number) => void };

type InboxState = {
  pending: Record<string, Pending[]>;
  push: (consultationId: string, item: Pending) => void;
  take: (consultationId: string) => Pending[];
};

export const useAiMedicinesInbox = create<InboxState>((set, get) => ({
  pending: {},
  push: (consultationId, item) =>
    set((s) => ({
      pending: {
        ...s.pending,
        [consultationId]: [...(s.pending[consultationId] ?? []), item],
      },
    })),
  take: (consultationId) => {
    const items = get().pending[consultationId] ?? [];
    if (items.length) {
      set((s) => {
        const next = { ...s.pending };
        delete next[consultationId];
        return { pending: next };
      });
    }
    return items;
  },
}));

/**
 * Hands the medicines to the open prescription draft and resolves with how
 * many lines it added. Resolves 0 if no draft takes them within 8 s (Plan of
 * care not mounted), so the caller's toast never waits forever.
 */
export function sendMedicinesToDraft(
  consultationId: string,
  medicines: SpeakadocExtractedMedicine[]
): Promise<number> {
  if (!medicines.length) return Promise.resolve(0);
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      // Leave nothing behind for a draft that mounts much later.
      useAiMedicinesInbox.getState().take(consultationId);
      resolve(0);
    }, 8000);
    useAiMedicinesInbox.getState().push(consultationId, {
      medicines,
      resolve: (added) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(added);
      },
    });
  });
}
