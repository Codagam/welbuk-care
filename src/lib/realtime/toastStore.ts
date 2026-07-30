import { create } from "zustand";

import type { RealtimeToast } from "./events";

type ToastState = {
  current: RealtimeToast | null;
  show: (toast: RealtimeToast) => void;
  dismiss: () => void;
};

let dismissTimer: ReturnType<typeof setTimeout> | null = null;

export const useRealtimeToastStore = create<ToastState>((set) => ({
  current: null,
  show: (toast) => {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    set({ current: toast });
    dismissTimer = setTimeout(() => {
      set({ current: null });
      dismissTimer = null;
    }, 4500);
  },
  dismiss: () => {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    set({ current: null });
  },
}));
