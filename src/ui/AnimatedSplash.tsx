import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { AnimatedIcon } from "./AnimatedIcon";
import {
  SPLASH_BG,
  SPLASH_FADE_OUT_MS,
  SPLASH_HOLD_MS,
  SPLASH_ICON_HEIGHT,
  SPLASH_ICON_WIDTH,
} from "./splash";

export { SPLASH_BG } from "./splash";

// Module scope so it survives remounts; resets only on a JS cold start.
let hasPlayed = false;
export const splashHasPlayed = () => hasPlayed;

type Props = {
  /** true once everything the first screen needs (auth hydrate) is loaded */
  isAppReady: boolean;
  /** called once, after the fade-out completes */
  onFinish: () => void;
  /** full-screen colour; keep in sync with the native splash in app.json */
  backgroundColor?: string;
};

/**
 * JS splash overlay. The native splash is brand color only (transparent image),
 * so this owns the logo animation: the white logo grows small → big and fades
 * in, then the overlay fades out once the app is ready.
 * Lives outside `app/` so expo-router never registers it as a route.
 */
export function AnimatedSplash({
  isAppReady,
  onFinish,
  backgroundColor = SPLASH_BG,
}: Props) {
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);
  const [iconDone, setIconDone] = useState(false);
  const hiding = useRef(false);
  const exiting = useRef(false);
  const overlayOpacity = useSharedValue(1);

  const finish = useCallback(() => {
    hasPlayed = true;
    onFinish();
  }, [onFinish]);

  // First frame is on screen → safe to hide the native splash. onLayout can fire
  // more than once, hence the ref guard. This is the only hideAsync() call.
  const handleLayout = useCallback(() => {
    if (hiding.current) return;
    hiding.current = true;
    SplashScreen.hideAsync()
      .catch(() => {})
      .finally(() => setNativeSplashHidden(true));
  }, []);

  // Stable, so AnimatedIcon's intro doesn't restart when isAppReady changes.
  const handleIconAnimationEnd = useCallback(() => setIconDone(true), []);

  // Exit only when BOTH the icon intro has finished AND the app is ready.
  useEffect(() => {
    if (!iconDone || !isAppReady || exiting.current) return;
    exiting.current = true;
    overlayOpacity.set(
      withDelay(
        SPLASH_HOLD_MS,
        withTiming(
          0,
          { duration: SPLASH_FADE_OUT_MS, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) scheduleOnRN(finish);
          }
        )
      )
    );
  }, [iconDone, isAppReady, finish, overlayOpacity]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.get(),
  }));

  return (
    <Animated.View
      onLayout={handleLayout}
      style={[styles.container, { backgroundColor }, overlayStyle]}
      pointerEvents={iconDone && isAppReady ? "none" : "auto"}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {nativeSplashHidden ? (
        <AnimatedIcon onAnimationEnd={handleIconAnimationEnd} />
      ) : (
        <View style={styles.placeholder} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    elevation: 9999,
  },
  placeholder: {
    width: SPLASH_ICON_WIDTH,
    height: SPLASH_ICON_HEIGHT,
  },
});
