import type { ReactNode } from "react";
import {
  Modal,
  Platform,
  View,
  type ModalProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppStatusBar,
  STATUS_BAR_BRAND,
  type AppStatusBarProps,
} from "./AppStatusBar";

export type AppModalProps = ModalProps & {
  children: ReactNode;
  /** Status bar icon style while the modal is open. Default `"light"`. */
  statusBarStyle?: AppStatusBarProps["style"];
  /**
   * Color behind the status bar (and Android top inset).
   * Defaults to brand primary. Use `#000` for full-screen media.
   */
  statusBarBackgroundColor?: string;
  /**
   * When true (default for non-transparent modals on Android), adds top/bottom
   * safe-area chrome so the status bar stays visible with brand fill.
   * Set false if you wrap content in `ModalSafeArea` yourself.
   */
  androidSafeArea?: boolean;
};

/**
 * Modal that keeps the status bar visible with brand primary + white icons.
 * Android Dialogs otherwise often blank/hide the status bar.
 */
export function AppModal({
  children,
  statusBarStyle = "light",
  statusBarBackgroundColor = STATUS_BAR_BRAND,
  androidSafeArea,
  transparent,
  statusBarTranslucent = true,
  ...rest
}: AppModalProps) {
  const insets = useSafeAreaInsets();
  const applyAndroidSafeArea =
    androidSafeArea ?? (Platform.OS === "android" && !transparent);

  return (
    <Modal
      transparent={transparent}
      statusBarTranslucent={statusBarTranslucent}
      {...rest}
    >
      <AppStatusBar
        style={statusBarStyle}
        backgroundColor={statusBarBackgroundColor}
      />
      {applyAndroidSafeArea ? (
        <View style={{ flex: 1 }}>
          <View
            style={{
              height: insets.top,
              backgroundColor: statusBarBackgroundColor,
            }}
          />
          <View style={{ flex: 1 }}>{children}</View>
          {insets.bottom > 0 ? (
            <View style={{ height: insets.bottom, backgroundColor: "#fff" }} />
          ) : null}
        </View>
      ) : (
        children
      )}
    </Modal>
  );
}
