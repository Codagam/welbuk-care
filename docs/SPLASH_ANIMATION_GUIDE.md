# Animated Splash Screen — Expo SDK 54 + expo-router (plays exactly once)

> **Instructions for Claude Code:** This project (Welbuk Health) has an animated splash
> screen that plays **twice** on launch. Use this document to (1) audit the existing
> implementation against the "Root causes" list, (2) replace it with the reference
> implementation below, adapting colors, logo path and the app-loading work to this
> codebase, and (3) run through the verification checklist. Do not keep the old
> splash component or route around. Tell the user which root causes you found.

Stack assumed: Expo SDK 54, expo-router v6, react-native-reanimated v4, expo-splash-screen v31.

---

## 1. How a splash screen actually works (3 layers)

```
App launch
  │
  ├─ [1] NATIVE splash (expo-splash-screen, configured in app.json)
  │       Drawn by the OS before any JS runs. Static image + background color.
  │       On Android 12+ this is the system SplashScreen API.
  │
  ├─ [2] JS bundle loads → root _layout.tsx renders
  │       Native splash stays up ONLY if preventAutoHideAsync() ran in time.
  │
  └─ [3] ANIMATED splash (your React component)
          Rendered on top of the app. Calls SplashScreen.hideAsync() once its
          first frame is on screen, plays its animation, then fades itself out.
```

The goal is that the handoff from [1] to [3] can't be seen. The first frame of the
animated splash must look **pixel-identical** to the native splash. Any mismatch
(the logo vanishing, a jump in size, a flash of a different color) looks like a
second splash.

---

## 2. Root causes of "the animation plays 2 times"

Check the project for **every** item. Usually more than one of them is present.

| # | Cause | What the user sees | Fix |
|---|-------|--------------------|-----|
| 1 | Native splash shows the **logo**, but the JS splash starts at `opacity: 0` / `scale: 0` | Logo appears, disappears, then animates in again | The native splash shows **background color only** (transparent image), and the JS splash animates the logo in. See §3. |
| 2 | Splash component file is inside `app/` (e.g. `app/(screens)/SplashScreen.tsx`) | expo-router registers it as a **route**. If `index.tsx`, a redirect, or a `<Stack.Screen name="SplashScreen">` navigates to it, it plays again | Move it to `components/AnimatedSplash.tsx`. Remove any `Stack.Screen`/`router.replace` that points at a splash route. |
| 3 | Splash is rendered in a tree that **unmounts/remounts**, e.g. `if (!isConnected) return <NoInternet/>`, `if (!loaded) return null` switching back and forth, or `showSplash ? <Splash/> : <Stack/>` inside a component that remounts | `useState(true)` resets, so the splash plays again | Render the splash as an **overlay** that is always in the same place in the tree, plus a **module-level `hasPlayed` flag** (§5). |
| 4 | `SplashScreen.preventAutoHideAsync()` is called **inside `useEffect`** | The native splash auto-hides before JS is ready, so you get a blank or white flash and then the animation. Reads as two starts | Call it at **module scope** in `app/_layout.tsx`, outside the component. |
| 5 | `setTimeout(onAnimationEnd, 1500)` with no cleanup, or `useEffect` with changing deps | The animation restarts on re-render. In dev, React StrictMode runs effects twice | Drive the finish from the Reanimated `withTiming` callback, and guard with a `useRef`. |
| 6 | **Lottie** `loop` defaults to **`true`** in `lottie-react-native` | The animation literally plays twice or more | `loop={false}` and use `onAnimationFinish`. |
| 7 | `hideAsync()` is called in two places (e.g. in `_layout` when fonts load **and** in the splash component) | The native splash hides early, so you see a flash | Call `hideAsync()` in **one** place only: the animated splash's `onLayout`. |
| 8 | Testing in **Expo Go** or a dev client | Expo Go shows its own splash first, then yours | Judge the result only in a **release build** (§7). |
| 9 | Changed `app.json` splash config but only did an OTA update or a JS reload | The old native splash image is still baked into the binary | The native splash only changes after a **new native build** (`npx expo prebuild --clean` or a new EAS build). |

---

## 3. Native splash config (`app.json`)

Use a **transparent PNG** for the native image, so the native splash is just a solid
brand color. The JS splash then owns the logo animation completely, and there is no
logo that can "pop" twice.

```json
{
  "expo": {
    "plugins": [
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-transparent.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#0A7E8C",
          "dark": {
            "image": "./assets/images/splash-transparent.png",
            "backgroundColor": "#0A7E8C"
          }
        }
      ]
    ]
  }
}
```

- `splash-transparent.png`: a fully transparent PNG (e.g. 1024×1024). Create it if it doesn't exist.
- `backgroundColor` **must equal** `SPLASH_BG` in the code below. The same goes for `dark.backgroundColor`, unless you
  also switch `SPLASH_BG` based on the color scheme.
- Remove any legacy top-level `"splash": {...}` key so there is only one source of truth.
- After you change this, run **`npx expo prebuild --clean`** (or make a new EAS build).

> Alternative, only if the design requires the logo on the native splash: set `image` to the
> real logo and `imageWidth` to N, and make the JS splash's first frame show the same
> logo at exactly N dp wide, centered, `opacity: 1`, `scale: 1`. Only animate from there
> (e.g. pulse, then fade out). This is harder to get pixel-perfect across devices, so prefer
> the transparent approach.

---

## 4. Shared constants — `constants/splash.ts`

```ts
// Must match expo-splash-screen "backgroundColor" in app.json
export const SPLASH_BG = "#0A7E8C";
export const SPLASH_LOGO_SIZE = 160;
```

---

## 5. Animated splash component — `components/AnimatedSplash.tsx`

**Not** inside `app/`. Files in `app/` become routes.

```tsx
import { SPLASH_BG, SPLASH_LOGO_SIZE } from "@/constants/splash";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

// Survives component remounts (NoInternet screen, layout re-renders, etc.).
// Reset only when the JS bundle restarts, i.e. a real cold start.
let hasPlayed = false;
export const splashHasPlayed = () => hasPlayed;

type Props = {
  /** true once fonts, auth and anything else the first screen needs are loaded */
  isAppReady: boolean;
  /** called once, after the exit animation completes */
  onFinish: () => void;
};

export default function AnimatedSplash({ isAppReady, onFinish }: Props) {
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.7);
  const containerOpacity = useSharedValue(1);

  const [introDone, setIntroDone] = useState(false);
  const started = useRef(false);
  const exiting = useRef(false);

  const finish = useCallback(() => {
    hasPlayed = true;
    onFinish();
  }, [onFinish]);

  // onLayout = our first frame is really on screen, so it's safe to hide the native splash.
  // onLayout can fire more than once, so guard it with a ref.
  const handleLayout = useCallback(() => {
    if (started.current) return;
    started.current = true;

    SplashScreen.hideAsync().catch(() => {});

    logoOpacity.value = withTiming(1, { duration: 500 });
    logoScale.value = withTiming(
      1,
      { duration: 800, easing: Easing.out(Easing.back(1.4)) },
      (finished) => {
        if (finished) runOnJS(setIntroDone)(true);
      }
    );
  }, []);

  // Exit only when BOTH the intro has finished AND the app is ready.
  useEffect(() => {
    if (!introDone || !isAppReady || exiting.current) return;
    exiting.current = true;
    containerOpacity.value = withTiming(0, { duration: 350 }, (finished) => {
      if (finished) runOnJS(finish)();
    });
  }, [introDone, isAppReady, finish]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  return (
    <Animated.View
      onLayout={handleLayout}
      style={[styles.container, containerStyle]}
      pointerEvents={introDone && isAppReady ? "none" : "auto"}
    >
      <StatusBar style="light" />
      <Animated.Image
        source={require("@/assets/images/splash-logo.png")}
        style={[styles.logo, logoStyle]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPLASH_BG,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    elevation: 9999,
  },
  logo: { width: SPLASH_LOGO_SIZE, height: SPLASH_LOGO_SIZE },
});
```

Notes:
- In Reanimated 4, `runOnJS` still works but is deprecated. The replacement is
  `scheduleOnRN(fn, ...args)` from `react-native-worklets`. Either is fine.
- The logo PNG must not use a custom font, so the splash can render before fonts load.

---

## 6. Root layout — `app/_layout.tsx`

Key rules:
1. `preventAutoHideAsync()` at **module scope**.
2. The splash is an **overlay** rendered **last**, as a sibling of the navigator, and never
   swapped out by an early `return`.
3. Nothing else calls `SplashScreen.hideAsync()`.
4. Don't `return null` / `return <NoInternet/>` **above** the splash. Put those states
   **under** the overlay instead.

```tsx
import AnimatedSplash, { splashHasPlayed } from "@/components/AnimatedSplash";
import { SPLASH_BG } from "@/constants/splash";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

// MUST be module scope, before the first render
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // Inter: require("../assets/fonts/Inter-Regular.ttf"),
  });
  const [dataReady, setDataReady] = useState(false);
  const [splashDone, setSplashDone] = useState(splashHasPlayed);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Load everything the first screen needs:
        // await initializeLanguage();
        // await restoreAuthFromSecureStore();
      } catch {
        // swallow; never block the splash forever
      } finally {
        if (!cancelled) setDataReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isAppReady = fontsLoaded && dataReady;
  const handleSplashFinish = useCallback(() => setSplashDone(true), []);

  return (
    <View style={{ flex: 1, backgroundColor: SPLASH_BG }}>
      {/* App content mounts behind the splash once ready */}
      {isAppReady && <Stack screenOptions={{ headerShown: false }} />}

      {/* Overlay; same position in the tree every render, so it never remounts */}
      {!splashDone && (
        <AnimatedSplash isAppReady={isAppReady} onFinish={handleSplashFinish} />
      )}
    </View>
  );
}
```

Things to move under the overlay instead of early-returning:
- **No internet screen:** render it where `<Stack/>` is (e.g. `isConnected ? <Stack/> : <NoInternet/>`),
  not as `if (!isConnected) return <NoInternet/>` above the splash.
- **Update prompts, ATT permission, push-notification routing:** trigger them after `splashDone`
  becomes true (`useEffect(() => { if (splashDone) ... }, [splashDone])`).
- **Deep link / notification cold start** where the splash should be skipped: call
  `setSplashDone(true)` **and** `SplashScreen.hideAsync()` in that one code path. Don't
  mount the splash and then yank it.

---

## 7. Optional: Lottie version

`npx expo install lottie-react-native`, then swap the `Animated.Image` for:

```tsx
import LottieView from "lottie-react-native";

<LottieView
  source={require("@/assets/animations/splash.json")}
  autoPlay
  loop={false}                // DEFAULT IS TRUE, which is a classic "plays twice" bug
  style={{ width: 220, height: 220 }}
  onAnimationFinish={(isCancelled) => {
    if (!isCancelled) setIntroDone(true);
  }}
/>
```

Keep the same `onLayout` → `hideAsync()`, `introDone && isAppReady` → fade-out → `onFinish` flow.
The Lottie's first frame should be the brand background only, or match the native splash.

---

## 8. Cleanup checklist (existing code)

- [ ] Delete the old splash file from `app/` (e.g. `app/(screens)/SplashScreen.tsx`) and remove its `<Stack.Screen name="SplashScreen" />`.
- [ ] Search for other splash usages: `grep -rn "SplashScreen\|splash" app components src`.
- [ ] Only **one** `preventAutoHideAsync()` (module scope in `app/_layout.tsx`) and **one** `hideAsync()` (in `AnimatedSplash` `onLayout`, plus the optional notification-skip path).
- [ ] No `setTimeout`-based splash timing.
- [ ] No `index.tsx` that shows its own splash or loader with the logo. `index.tsx` should just redirect.
- [ ] `app.json` splash `backgroundColor` === `SPLASH_BG`; image is transparent; no legacy `"splash"` key.
- [ ] No `loop` Lottie.

---

## 9. Verification

Dev mode (Fast Refresh, StrictMode, Expo Go) is **not** a valid test of splash behavior.

```bash
npx expo prebuild --clean
npx expo run:android --variant release
npx expo run:ios --configuration Release
# or: eas build --profile preview
```

Check each of these:
1. Cold start: brand color, then the logo animates in **once**, then a fade into the app. No white flash and no second logo.
2. Kill the app and cold start again: same result.
3. Background the app, then resume: **no** splash.
4. Start with airplane mode on: the splash plays once, then the No Internet screen appears. Turning Wi-Fi back on does **not** replay the splash.
5. Open the app by tapping a push notification from the killed state: behaves as designed (once or skipped).
6. Android 12+ device **and** an older Android device, plus iOS: no launcher-icon flash before the brand color.
