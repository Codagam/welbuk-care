import { create } from "zustand";

import type { IpdPageAlarm, RealtimeToast } from "./events";

type ToastState = {
  current: RealtimeToast | null;
  alarms: IpdPageAlarm[];
  show: (toast: RealtimeToast) => void;
  dismiss: () => void;
  showAlarm: (alarm: IpdPageAlarm) => void;
  dismissAlarm: (id: string) => void;
};

let dismissTimer: ReturnType<typeof setTimeout> | null = null;

export const useRealtimeToastStore = create<ToastState>((set, get) => ({
  current: null,
  alarms: [],
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
  showAlarm: (alarm) => {
    const rest = get().alarms.filter((a) => a.id !== alarm.id);
    set({ alarms: [...rest, alarm] });
  },
  dismissAlarm: (id) => {
    set({ alarms: get().alarms.filter((a) => a.id !== id) });
  },
}));
