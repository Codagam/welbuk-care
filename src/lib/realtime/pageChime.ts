import { Vibration } from "react-native";

/** Double pulse — a single buzz is not used for appointment toasts on Care. */
export function playPageChime(): void {
  try {
    Vibration.vibrate(180);
    setTimeout(() => {
      try {
        Vibration.vibrate(180);
      } catch {
        /* ignore */
      }
    }, 350);
  } catch {
    /* web / unsupported */
  }
}
