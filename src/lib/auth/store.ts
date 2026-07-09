/**
 * Central auth store (Zustand). Single source of truth for the session, the
 * selected facility, and auth status. Persists to SecureStore and wires the API
 * client's token provider + global 401 handler.
 */
import { create } from "zustand";

import { setTokenProvider, setUnauthorizedHandler } from "@/lib/api/client";
import { fetchMe } from "@/lib/api/endpoints/auth";
import { authProvider } from "./practice-provider";
import { activeFacilityStorage, sessionStorage } from "./secure-storage";
import type { Facility, LoginInput, Session } from "./types";

type Status = "loading" | "authed" | "anon";

interface AuthState {
  status: Status;
  session: Session | null;
  activeFacilityId: string | null;
  /** Set when a 401 forced sign-out mid-session, so login can show a notice. */
  sessionExpired: boolean;

  hydrate: () => Promise<void>;
  signIn: (input: LoginInput) => Promise<Session>;
  signOut: () => Promise<void>;
  setActiveFacility: (id: string) => Promise<void>;
  refreshFacilities: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  session: null,
  activeFacilityId: null,
  sessionExpired: false,

  hydrate: async () => {
    const [session, activeFacilityId] = await Promise.all([
      sessionStorage.get<Session>(),
      activeFacilityStorage.get(),
    ]);
    if (session?.token) {
      set({
        session,
        activeFacilityId: activeFacilityId ?? null,
        status: "authed",
        sessionExpired: false,
      });
    } else {
      set({ session: null, activeFacilityId: null, status: "anon" });
    }
  },

  signIn: async (input) => {
    const session = await authProvider.login(input);
    await sessionStorage.set(session);
    // Auto-select when there is exactly one facility.
    let activeFacilityId: string | null = null;
    if (session.facilities.length === 1) {
      activeFacilityId = session.facilities[0].id;
      await activeFacilityStorage.set(activeFacilityId);
    }
    set({ session, activeFacilityId, status: "authed", sessionExpired: false });
    return session;
  },

  signOut: async () => {
    const { session } = get();
    try {
      await authProvider.logout(session);
    } catch {
      // best-effort
    }
    await Promise.all([sessionStorage.clear(), activeFacilityStorage.clear()]);
    set({ session: null, activeFacilityId: null, status: "anon", sessionExpired: false });
  },

  setActiveFacility: async (id) => {
    await activeFacilityStorage.set(id);
    set({ activeFacilityId: id });
  },

  refreshFacilities: async () => {
    const { session } = get();
    if (!session) return;
    try {
      const me = await fetchMe();
      if (me.facilities) {
        const updated: Session = {
          ...session,
          facilities: me.facilities,
          user: me.user ?? session.user,
        };
        await sessionStorage.set(updated);
        set({ session: updated });
      }
    } catch {
      // non-fatal; keep the cached facility list
    }
  },
}));

// ---- Selectors ----------------------------------------------------------

export const useActiveFacility = (): Facility | null =>
  useAuthStore(
    (s) => s.session?.facilities.find((f) => f.id === s.activeFacilityId) ?? null
  );

/** The facilityId string to pass to the API, or null when none is selected. */
export const useFacilityId = (): string | null =>
  useAuthStore((s) => s.activeFacilityId);

export const useAuthUser = () => useAuthStore((s) => s.session?.user ?? null);

// ---- Wire the API client to the store (once, at module load) -------------

setTokenProvider(() => authProvider.resolveToken(useAuthStore.getState().session));

setUnauthorizedHandler(() => {
  if (useAuthStore.getState().status === "anon") return;
  sessionStorage.clear().catch(() => {});
  activeFacilityStorage.clear().catch(() => {});
  useAuthStore.setState({
    session: null,
    activeFacilityId: null,
    status: "anon",
    sessionExpired: true,
  });
});
