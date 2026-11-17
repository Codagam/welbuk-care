/**
 * Codes a clinician inserted recently, newest first, so the picker opens on the few
 * they actually use. Kept per user, so doctors sharing a tablet keep separate lists.
 * Holds a code and its label only, never which patient it was used for, which is
 * why it survives sign-out.
 */
import * as SecureStore from "expo-secure-store";

import { nextRecent, type RecentDiagnosisCode } from "./soapText";

const KEY_PREFIX = "welbuk_recent_diagnosis_codes";
const MAX_RECENT = 10;

// SecureStore keys allow letters, digits, ".", "-" and "_", so no ":" here.
function storageKey(userId: string): string {
  return `${KEY_PREFIX}.${userId}`;
}

export async function loadRecentDiagnosisCodes(
  userId: string | undefined
): Promise<RecentDiagnosisCode[]> {
  if (!userId) return [];
  try {
    const raw = await SecureStore.getItemAsync(storageKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r): r is RecentDiagnosisCode =>
          !!r &&
          typeof r === "object" &&
          typeof (r as RecentDiagnosisCode).code === "string" &&
          typeof (r as RecentDiagnosisCode).label === "string" &&
          ((r as RecentDiagnosisCode).system === "ICD-10" ||
            (r as RecentDiagnosisCode).system === "SNOMED")
      )
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export async function rememberDiagnosisCode(
  userId: string | undefined,
  entry: RecentDiagnosisCode
): Promise<void> {
  if (!userId) return;
  try {
    const current = await loadRecentDiagnosisCodes(userId);
    await SecureStore.setItemAsync(
      storageKey(userId),
      JSON.stringify(nextRecent(current, entry, MAX_RECENT))
    );
  } catch {
    // Recents are a convenience, not a record.
  }
}
