import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { STATUS_BAR_BRAND } from "./AppStatusBar";

/** Must match expo-splash-screen `backgroundColor` (and `dark.backgroundColor`) in app.json. */
export const SPLASH_BG = STATUS_BAR_BRAND;
export const SPLASH_LOGO_SIZE = 160;

// Icon grows small → big (~1s), then keeps growing while it fades into the app.
// No static hold, so the logo is never on screen much longer than a second.
const GROW_MS = 1000;
const EXIT_MS = 300;
const EXIT_SCALE = 1.12;

const LOGO = require("@/assets/images/Welbuk_Logo_White.png");

// Module scope so it survives remounts; resets only on a JS cold start.
let hasPlayed = false;
export const splashHasPlayed = () => hasPlayed;

type Props = {
  /** true once everything the first screen needs (auth hydrate) is loaded */
  isAppReady: boolean;
  /** called once, after the exit animation completes */
  onFinish: () => void;
};

/**
 * JS splash overlay. The native splash is brand color only (transparent image),
 * so this owns the logo animation: icon grows small → big, then fades out
 * (still growing) once the app is ready.
 * Lives outside `app/` so expo-router never registers it as a route.
 */
export function AnimatedSplash({ isAppReady, onFinish }: Props) {
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.05);
  const containerOpacity = useSharedValue(1);

  const [introDone, setIntroDone] = useState(false);
  const started = useRef(false);
  const exiting = useRef(false);

  const finish = useCallback(() => {
    hasPlayed = true;
    onFinish();
  }, [onFinish]);

  // First frame is on screen → safe to hide the native splash. onLayout can fire
  // more than once, hence the ref guard. This is the only hideAsync() call.
  const handleLayout = useCallback(() => {
    if (started.current) return;
    started.current = true;

    SplashScreen.hideAsync().catch(() => {});

    const grow = { duration: GROW_MS, easing: Easing.out(Easing.quad) };
    logoOpacity.set(withTiming(1, { duration: GROW_MS * 0.5 }));
    logoScale.set(
      withTiming(1, grow, (finished) => {
        if (finished) scheduleOnRN(setIntroDone, true);
      })
    );
  }, [logoOpacity, logoScale]);

  // Exit only when BOTH the intro has finished AND the app is ready.
  useEffect(() => {
    if (!introDone || !isAppReady || exiting.current) return;
    exiting.current = true;
    // Keep growing while the overlay fades — no pause at full size.
    logoScale.set(withTiming(EXIT_SCALE, { duration: EXIT_MS }));
    containerOpacity.set(
      withTiming(
        0,
        { duration: EXIT_MS, easing: Easing.in(Easing.quad) },
        (finished) => {
          if (finished) scheduleOnRN(finish);
        }
      )
    );
  }, [introDone, isAppReady, finish, logoScale, containerOpacity]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.get(),
  }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.get(),
    transform: [{ scale: logoScale.get() }],
  }));

  return (
    <Animated.View
      onLayout={handleLayout}
      style={[styles.container, containerStyle]}
      pointerEvents={introDone && isAppReady ? "none" : "auto"}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.Image
        source={LOGO}
        style={[styles.logo, logoStyle]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: SPLASH_BG,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    elevation: 9999,
  },
  logo: { width: SPLASH_LOGO_SIZE, height: SPLASH_LOGO_SIZE },
});
