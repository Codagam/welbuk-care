/**
 * Thin JSON wrapper over expo-secure-store for persisting the session.
 * The auth token is sensitive → SecureStore (Keychain/Keystore), never
 * AsyncStorage. Mirrors the pattern used by the Welbuk Health patient app.
 */
import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "welbuk_care_session";
const ACTIVE_FACILITY_KEY = "welbuk_care_active_facility";

async function getJson<T>(key: string): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    await SecureStore.deleteItemAsync(key);
    return null;
  }
}

async function setJson(key: string, value: unknown): Promise<void> {
  await SecureStore.setItemAsync(key, JSON.stringify(value));
}

export const sessionStorage = {
  get: <T>() => getJson<T>(SESSION_KEY),
  set: (value: unknown) => setJson(SESSION_KEY, value),
  clear: () => SecureStore.deleteItemAsync(SESSION_KEY),
};

export const activeFacilityStorage = {
  get: () => SecureStore.getItemAsync(ACTIVE_FACILITY_KEY),
  set: (facilityId: string) =>
    SecureStore.setItemAsync(ACTIVE_FACILITY_KEY, facilityId),
  clear: () => SecureStore.deleteItemAsync(ACTIVE_FACILITY_KEY),
};
