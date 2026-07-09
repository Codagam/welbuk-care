/**
 * Persists auth state. Native uses SecureStore (Keychain/Keystore); web falls
 * back to localStorage because expo-secure-store is not available there.
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const SESSION_KEY = "welbuk_care_session";
const ACTIVE_FACILITY_KEY = "welbuk_care_active_facility";

const isWeb = Platform.OS === "web";

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

async function getJson<T>(key: string): Promise<T | null> {
  const raw = await getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    await deleteItem(key);
    return null;
  }
}

async function setJson(key: string, value: unknown): Promise<void> {
  await setItem(key, JSON.stringify(value));
}

export const sessionStorage = {
  get: <T>() => getJson<T>(SESSION_KEY),
  set: (value: unknown) => setJson(SESSION_KEY, value),
  clear: () => deleteItem(SESSION_KEY),
};

export const activeFacilityStorage = {
  get: () => getItem(ACTIVE_FACILITY_KEY),
  set: (facilityId: string) => setItem(ACTIVE_FACILITY_KEY, facilityId),
  clear: () => deleteItem(ACTIVE_FACILITY_KEY),
};
