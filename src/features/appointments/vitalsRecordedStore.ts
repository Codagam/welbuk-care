import { create } from "zustand";

/**
 * Appointments whose vitals the receptionist recorded from the list this
 * session. The appointment-search API carries no vitals flag, so the desk's
 * "Vitals added" chip is driven from here.
 */
type VitalsRecordedState = {
  recorded: Record<string, number>;
  markRecorded: (appointmentId: string) => void;
};

export const useVitalsRecordedStore = create<VitalsRecordedState>((set) => ({
  recorded: {},
  markRecorded: (appointmentId) =>
    set((s) => ({ recorded: { ...s.recorded, [appointmentId]: Date.now() } })),
}));
