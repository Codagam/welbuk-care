/**
 * Local Facility QR cache keyed by login identity (userId + role + name + facility).
 * Same identity → reuse stored PNG. Different login → fetch API + overwrite.
 */
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";

import {
  downloadFacilityQrImageToFile,
  fetchFacilityWrapperShare,
  hasFacilityQrImage,
  postFacilityWrapperShare,
  type FacilityWrapperShare,
} from "@/lib/api/endpoints/facility-qr";
import type { AuthUser } from "@/lib/auth/types";
import { getGlobalRoleLower, userDisplayName } from "@/lib/auth/roles";

const META_KEY = "welbuk_care_facility_qr_meta";
const QR_DIR = `${FileSystem.documentDirectory ?? ""}welbuk_facility_qr/`;

export type FacilityQrIdentity = {
  userId: string;
  role: string;
  name: string;
  facilityId: string;
};

export type FacilityQrCacheMeta = FacilityQrIdentity & {
  identityKey: string;
  facilityName?: string;
  numericFacilityId?: number | string;
  wrapperQrImageUrl: string;
  wrapperDynamicLinkUrl?: string | null;
  localFileUri: string;
  cachedAt: string;
};

export type ResolvedFacilityQr = {
  fromCache: boolean;
  localFileUri: string;
  share: FacilityWrapperShare;
  identityKey: string;
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildFacilityQrIdentity(
  user: AuthUser | null | undefined,
  facilityId: string
): FacilityQrIdentity | null {
  if (!user?.id || !facilityId.trim()) return null;
  const role = getGlobalRoleLower(user) ?? String(user.role ?? "user").toLowerCase();
  const name = normalizeName(userDisplayName(user) || user.email || user.id);
  return {
    userId: user.id,
    role,
    name,
    facilityId: facilityId.trim(),
  };
}

export function facilityQrIdentityKey(identity: FacilityQrIdentity): string {
  return [identity.userId, identity.role, identity.name, identity.facilityId].join(
    "::"
  );
}

async function ensureQrDir(): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  const info = await FileSystem.getInfoAsync(QR_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(QR_DIR, { intermediates: true });
  }
}

async function readMeta(): Promise<FacilityQrCacheMeta | null> {
  const raw = await SecureStore.getItemAsync(META_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FacilityQrCacheMeta;
  } catch {
    await SecureStore.deleteItemAsync(META_KEY);
    return null;
  }
}

async function writeMeta(meta: FacilityQrCacheMeta): Promise<void> {
  await SecureStore.setItemAsync(META_KEY, JSON.stringify(meta));
}

async function localFileExists(uri: string): Promise<boolean> {
  if (!uri) return false;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return Boolean(info.exists && !info.isDirectory);
  } catch {
    return false;
  }
}

function fileUriForIdentity(identityKey: string): string {
  const safe = identityKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  return `${QR_DIR}${safe}.png`;
}

/**
 * Resolve facility QR for display.
 * - Same login identity + local file → return cache (no network).
 * - Otherwise → GET facility CRUD (generate if missing), download PNG, store locally.
 */
export async function resolveFacilityQr(input: {
  user: AuthUser | null | undefined;
  facilityId: string;
  facilityName?: string;
  /** Force network refresh + overwrite cache (e.g. after regenerate). */
  forceRefresh?: boolean;
}): Promise<ResolvedFacilityQr> {
  const identity = buildFacilityQrIdentity(input.user, input.facilityId);
  if (!identity) {
    throw new Error("Sign in and select a facility to load the QR code.");
  }
  const identityKey = facilityQrIdentityKey(identity);
  await ensureQrDir();

  if (!input.forceRefresh) {
    const meta = await readMeta();
    if (
      meta &&
      meta.identityKey === identityKey &&
      (await localFileExists(meta.localFileUri))
    ) {
      return {
        fromCache: true,
        localFileUri: meta.localFileUri,
        identityKey,
        share: {
          facilityId:
            typeof meta.numericFacilityId === "number"
              ? meta.numericFacilityId
              : undefined,
          name: meta.facilityName,
          wrapperQrImageUrl: meta.wrapperQrImageUrl,
          wrapperDynamicLinkUrl: meta.wrapperDynamicLinkUrl,
        },
      };
    }
  }

  let share = await fetchFacilityWrapperShare(input.facilityId);
  if (!hasFacilityQrImage(share)) {
    share = await postFacilityWrapperShare(input.facilityId, false);
  }
  if (!hasFacilityQrImage(share)) {
    throw new Error("No QR code is available for this facility yet.");
  }

  const remoteUrl = share.wrapperQrImageUrl!.trim();

  const localFileUri = fileUriForIdentity(identityKey);
  if (await localFileExists(localFileUri)) {
    await FileSystem.deleteAsync(localFileUri, { idempotent: true });
  }
  await downloadFacilityQrImageToFile(remoteUrl, localFileUri);

  const meta: FacilityQrCacheMeta = {
    ...identity,
    identityKey,
    facilityName: share.name ?? input.facilityName,
    numericFacilityId: share.facilityId,
    wrapperQrImageUrl: remoteUrl,
    wrapperDynamicLinkUrl: share.wrapperDynamicLinkUrl ?? null,
    localFileUri,
    cachedAt: new Date().toISOString(),
  };
  await writeMeta(meta);

  return {
    fromCache: false,
    localFileUri,
    identityKey,
    share,
  };
}

/** After regenerate — fetch new assets and overwrite the identity-keyed cache. */
export async function regenerateFacilityQr(input: {
  user: AuthUser | null | undefined;
  facilityId: string;
  facilityName?: string;
}): Promise<ResolvedFacilityQr> {
  await postFacilityWrapperShare(input.facilityId, true);
  return resolveFacilityQr({ ...input, forceRefresh: true });
}

export async function clearFacilityQrCache(): Promise<void> {
  try {
    const meta = await readMeta();
    if (meta?.localFileUri) {
      await FileSystem.deleteAsync(meta.localFileUri, { idempotent: true });
    }
  } catch {
    // best-effort
  }
  try {
    await SecureStore.deleteItemAsync(META_KEY);
  } catch {
    // best-effort
  }
  try {
    if (FileSystem.documentDirectory) {
      const info = await FileSystem.getInfoAsync(QR_DIR);
      if (info.exists) {
        await FileSystem.deleteAsync(QR_DIR, { idempotent: true });
      }
    }
  } catch {
    // best-effort
  }
}
