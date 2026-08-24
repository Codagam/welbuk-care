import { Platform, StatusBar as RNStatusBar, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Welbuk primary — keep in sync with `tailwind.config.js` brand.DEFAULT */
export const STATUS_BAR_BRAND = "#FD006A";

export type AppStatusBarProps = {
  /** Status bar icon/text color. `"light"` = white (default). */
  style?: "light" | "dark";
  /** Android status-bar / top-inset fill. Defaults to brand primary. */
  backgroundColor?: string;
};

/**
 * App-wide status bar: primary background + white icons/text.
 * Also paint an explicit top fill for edge-to-edge Android / iOS.
 */
export function AppStatusBar({
  style = "light",
  backgroundColor = STATUS_BAR_BRAND,
}: AppStatusBarProps) {
  return (
    <>
      <StatusBar style={style} />
      {Platform.OS === "android" ? (
        <RNStatusBar
          barStyle={style === "light" ? "light-content" : "dark-content"}
          backgroundColor={backgroundColor}
          translucent
        />
      ) : null}
    </>
  );
}

/** Solid fill behind the system status bar (brand by default). */
export function StatusBarBrandFill({
  backgroundColor = STATUS_BAR_BRAND,
}: {
  backgroundColor?: string;
}) {
  const insets = useSafeAreaInsets();
  if (insets.top <= 0) return null;
  return (
    <View
      style={{ height: insets.top, backgroundColor }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
