import { STATUS_BAR_BRAND } from "./AppStatusBar";

/** Must match expo-splash-screen `backgroundColor` (and `dark.backgroundColor`) in app.json. */
export const SPLASH_BG = STATUS_BAR_BRAND;

// AnimatedIcon: the box that scales, and the white logo inside it (no background).
export const SPLASH_ICON_WIDTH = 180;
export const SPLASH_ICON_HEIGHT = 180;
export const SPLASH_IMAGE_WIDTH = 160;
export const SPLASH_IMAGE_HEIGHT = 160;

// Intro: icon grows from SPLASH_INITIAL_SCALE to 1 while fading in.
export const SPLASH_DURATION = 2000;
export const SPLASH_INITIAL_SCALE = 0.1;
// Start the intro even if the logo's onDisplay never fires.
export const SPLASH_START_FALLBACK_MS = 800;

// Exit: brief hold at full size, then the overlay fades out.
export const SPLASH_HOLD_MS = 300;
export const SPLASH_FADE_OUT_MS = 400;
//test
