/**
 * Local draft for plan-of-care prescriptions until Complete/finalize.
 * Key mirrors Practice: welbuk-consult-prescriptions-{consultationId}
 *
 * Uses SecureStore (available in Care). Drafts are small (few med lines).
 */
import * as SecureStore from "expo-secure-store";

import type { PlanPrescription } from "./types";

const PREFIX = "welbuk-consult-prescriptions";

function storageKey(consultationId: string): string {
  return `${PREFIX}-${consultationId}`;
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
  } catch {
    // ignore
  }
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
