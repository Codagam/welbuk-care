/**
 * Local draft for plan-of-care prescriptions until Complete/finalize.
 * Key mirrors Practice: welbuk-consult-prescriptions-{consultationId}
 *
 * Uses SecureStore (available in Care). Drafts are small (few med lines).
 */
import * as SecureStore from "expo-secure-store";

import type { PlanPrescription } from "./types";

const PREFIX = "welbuk-consult-prescriptions";
/** SecureStore can't enumerate keys — track draft ids so logout can wipe them. */
const INDEX_KEY = `${PREFIX}.index`;

function storageKey(consultationId: string): string {
  return `${PREFIX}-${consultationId}`;
}

async function readIndex(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(INDEX_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

async function updateIndex(
  fn: (ids: string[]) => string[]
): Promise<void> {
  try {
    const next = fn(await readIndex());
    if (next.length) {
      await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(next));
    } else {
      await SecureStore.deleteItemAsync(INDEX_KEY);
    }
  } catch {
    // ignore
  }
}

export async function loadPrescriptionDraft(
  consultationId: string
): Promise<PlanPrescription[]> {
  if (!consultationId.trim()) return [];
  try {
    const raw = await SecureStore.getItemAsync(storageKey(consultationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is PlanPrescription =>
        !!p &&
        typeof p === "object" &&
        typeof (p as PlanPrescription).id === "string" &&
        typeof (p as PlanPrescription).name === "string"
    );
  } catch {
    return [];
  }
}

export async function savePrescriptionDraft(
  consultationId: string,
  prescriptions: PlanPrescription[]
): Promise<void> {
  if (!consultationId.trim()) return;
  try {
    await SecureStore.setItemAsync(
      storageKey(consultationId),
      JSON.stringify(prescriptions)
    );
    await updateIndex((ids) =>
      ids.includes(consultationId) ? ids : [...ids, consultationId]
    );
  } catch {
    // Best-effort; in-memory state still wins for the session.
  }
}

export async function clearPrescriptionDraft(
  consultationId: string
): Promise<void> {
  if (!consultationId.trim()) return;
  try {
    await SecureStore.deleteItemAsync(storageKey(consultationId));
    await updateIndex((ids) => ids.filter((id) => id !== consultationId));
  } catch {
    // ignore
  }
}

/** Delete every tracked draft (sign-out on a shared tablet). */
export async function clearAllPrescriptionDrafts(): Promise<void> {
  const ids = await readIndex();
  await Promise.all(
    ids.map((id) =>
      SecureStore.deleteItemAsync(storageKey(id)).catch(() => {})
    )
  );
  await SecureStore.deleteItemAsync(INDEX_KEY).catch(() => {});
}

/** Merge API structured lines with local draft (by id; API first). */
export function mergePrescriptions(
  apiLines: PlanPrescription[],
  draftLines: PlanPrescription[]
): PlanPrescription[] {
  const structuredOnly = apiLines.filter((p) => !p.isAttachment);
  const apiIds = new Set(structuredOnly.map((p) => p.id));
  return [
    ...structuredOnly,
    ...draftLines.filter((p) => !apiIds.has(p.id) && !p.isAttachment),
  ];
}

export function newPrescriptionId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
