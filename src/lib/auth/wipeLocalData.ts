/**
 * Wipes everything a signed-in user leaves on the device so a shared desk
 * tablet never shows one login's patient data to the next:
 *   - TanStack Query cache (patients, appointments, history, …)
 *   - in-memory zustand stores (vitals chips, realtime toasts/alarms)
 *   - the app cache directory (proxied downloads, report PDFs, share copies,
 *     document-picker copies, audio recordings) + expo-image caches
 *   - facility QR cache and prescription drafts
 *
 * Call only AFTER the session is nulled in the auth store: a query that
 * refetches between the two would otherwise repopulate the cache with the
 * previous user's token.
 */
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";

import { useVitalsRecordedStore } from "@/features/appointments/vitalsRecordedStore";
import { clearAllPrescriptionDrafts } from "@/features/consult/plan-of-care/prescriptionDraftStore";
import { clearFacilityQrCache } from "@/features/header/facilityQrCache";
import { queryClient } from "@/lib/query";
import { useRealtimeToastStore } from "@/lib/realtime/toastStore";

/** Synchronous part: drop cached server data and in-memory per-user state. */
export function clearInMemoryUserData(): void {
  // Cancel first so an in-flight fetch can't write its result back after clear().
  void queryClient.cancelQueries();
  queryClient.clear();
  useVitalsRecordedStore.setState({ recorded: {} });
  useRealtimeToastStore.getState().dismiss();
  useRealtimeToastStore.setState({ alarms: [] });
  void Image.clearMemoryCache().catch(() => false);
}

async function clearCacheDirectory(): Promise<void> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) return;
  let entries: string[];
  try {
    entries = await FileSystem.readDirectoryAsync(dir);
  } catch {
    return;
  }
  await Promise.all(
    entries.map((name) =>
      FileSystem.deleteAsync(`${dir}${name}`, { idempotent: true }).catch(
        () => {}
      )
    )
  );
}

/** Best-effort removal of patient files and drafts persisted on the device. */
export async function wipeLocalFiles(): Promise<void> {
  await Promise.all([
    clearCacheDirectory(),
    clearFacilityQrCache(),
    clearAllPrescriptionDrafts(),
    Image.clearDiskCache().catch(() => false),
  ]);
}

export async function wipeLocalUserData(): Promise<void> {
  clearInMemoryUserData();
  await wipeLocalFiles();
}
