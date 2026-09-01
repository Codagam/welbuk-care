/**
 * Local draft for plan-of-care prescriptions until Complete/finalize.
 * Key mirrors Practice: welbuk-consult-prescriptions-{consultationId}
 *
 * Uses SecureStore (available in Care). Drafts are small (few med lines).
 *
 * SecureStore has no "list keys" API, so we keep an index of consultationIds
 * that currently have a draft — this lets sign-out wipe every draft (drug names
 * and doses are PHI and Care runs on shared clinic tablets).
 */
import * as SecureStore from "expo-secure-store";

import type { PlanPrescription } from "./types";

const PREFIX = "welbuk-consult-prescriptions";
const INDEX_KEY = `${PREFIX}-index`;

function storageKey(consultationId: string): string {
  return `${PREFIX}-${consultationId}`;
}

async function readIndex(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

async function writeIndex(ids: string[]): Promise<void> {
  try {
    if (ids.length === 0) {
      await SecureStore.deleteItemAsync(INDEX_KEY);
      return;
    }
    await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(ids));
  } catch {
    // best-effort
  }
}

async function addToIndex(consultationId: string): Promise<void> {
  const ids = await readIndex();
  if (!ids.includes(consultationId)) {
    await writeIndex([...ids, consultationId]);
  }
}

async function removeFromIndex(consultationId: string): Promise<void> {
  const ids = await readIndex();
  if (ids.includes(consultationId)) {
    await writeIndex(ids.filter((id) => id !== consultationId));
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
    await addToIndex(consultationId);
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
    await removeFromIndex(consultationId);
  } catch {
    // ignore
  }
}

/** Wipe every locally-stored prescription draft. Called on sign-out. */
export async function clearAllPrescriptionDrafts(): Promise<void> {
  const ids = await readIndex();
  await Promise.all(
    ids.map((id) =>
      SecureStore.deleteItemAsync(storageKey(id)).catch(() => {})
    )
  );
  await writeIndex([]);
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
