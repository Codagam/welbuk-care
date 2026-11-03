import { Image, type ImageSource } from "expo-image";
import { useCallback, useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import {
  SPLASH_DURATION,
  SPLASH_ICON_HEIGHT,
  SPLASH_ICON_WIDTH,
  SPLASH_IMAGE_HEIGHT,
  SPLASH_IMAGE_WIDTH,
  SPLASH_INITIAL_SCALE,
  SPLASH_START_FALLBACK_MS,
} from "./splash";

const LOGO = require("@/assets/images/Welbuk_Logo_White.png");

type AnimatedIconProps = {
  /** must be stable (useCallback), or the intro restarts on re-render */
  onAnimationEnd?: () => void;
  /** logo to show; defaults to the white Welbuk logo */
  source?: ImageSource | number;
};

export function AnimatedIcon({ onAnimationEnd, source = LOGO }: AnimatedIconProps) {
  const scale = useSharedValue(SPLASH_INITIAL_SCALE);
  const opacity = useSharedValue(0);

  const started = useRef(false);

  // expo-image decodes asynchronously, so start only once the logo is really
  // drawn — otherwise it pops in part-way through the grow (a visible blink).
  // onDisplay can fire more than once, so guard it.
  const start = useCallback(() => {
    if (started.current) return;
    started.current = true;
    const config = { duration: SPLASH_DURATION, easing: Easing.out(Easing.cubic) };
    scale.set(
      withTiming(1, config, (finished) => {
        if (finished && onAnimationEnd) scheduleOnRN(onAnimationEnd);
      })
    );
    opacity.set(withTiming(1, config));
  }, [scale, opacity, onAnimationEnd]);

  // Never leave the splash stuck if onDisplay doesn't fire.
  useEffect(() => {
    const timer = setTimeout(start, SPLASH_START_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [start]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }));

  return (
    <Animated.View style={[styles.iconContainer, animatedStyle]}>
      <Image
        style={styles.image}
        source={source}
        contentFit="contain"
        priority="high"
        onDisplay={start}
        onError={start}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // No background: the plain logo sits directly on the splash colour.
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: SPLASH_ICON_WIDTH,
    height: SPLASH_ICON_HEIGHT,
  },
  image: {
    width: SPLASH_IMAGE_WIDTH,
    height: SPLASH_IMAGE_HEIGHT,
  },
});
