import { useState, type ReactNode } from "react";
import {
  Image,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { shareLocalFileOrAlert } from "@/lib/api/shareLocalFile";
import { AppModal } from "@/ui";

/** Download + Full view actions shown after opening a file with the eye icon. */
export function FileViewerActions({
  localUri,
  fileName,
  title,
  onFullView,
}: {
  localUri: string;
  fileName?: string;
  title?: string;
  onFullView?: () => void;
}) {
  return (
    <View className="flex-row flex-wrap items-center justify-center gap-2">
      <Pressable
        onPress={() =>
          void shareLocalFileOrAlert(localUri, {
            fileName,
            dialogTitle: title ? `Download ${title}` : "Download",
          })
        }
        className="flex-row items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 active:bg-neutral-100"
        accessibilityLabel="Download"
      >
        <Ionicons name="download-outline" size={16} color="#FD006A" />
        <Text className="text-sm font-medium text-brand">Download</Text>
      </Pressable>
      {onFullView ? (
        <Pressable
          onPress={onFullView}
          className="flex-row items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 active:bg-neutral-100"
          accessibilityLabel="Full view"
        >
          <Ionicons name="expand-outline" size={16} color="#FD006A" />
          <Text className="text-sm font-medium text-brand">Full view</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Contained image preview with Download + Full view (shown after eye open).
 */
export function ImagePreviewWithFullView({
  uri,
  title = "Image",
  fileName,
  height = 320,
}: {
  uri: string;
  title?: string;
  fileName?: string;
  height?: number;
}) {
  const [fullOpen, setFullOpen] = useState(false);

  return (
    <View className="gap-2">
      <Pressable
        onPress={() => setFullOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Open full view"
      >
        <Image
          source={{ uri }}
          style={{ width: "100%", height, borderRadius: 8 }}
          resizeMode="contain"
        />
      </Pressable>
      <FileViewerActions
        localUri={uri}
        fileName={fileName}
        title={title}
        onFullView={() => setFullOpen(true)}
      />

      <FullScreenImageModal
        visible={fullOpen}
        uri={uri}
        title={title}
        fileName={fileName}
        onClose={() => setFullOpen(false)}
      />
    </View>
  );
}

/**
 * Immersive image viewer. Uses a dark full-screen modal with safe-area
 * padding so the status bar / notch are not covered by controls.
 */
export function FullScreenImageModal({
  visible,
  uri,
  title,
  fileName,
  onClose,
}: {
  visible: boolean;
  uri: string;
  title?: string;
  fileName?: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  return (
    <AppModal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarBackgroundColor="#000"
      androidSafeArea={false}
    >
      <View className="flex-1 bg-black">
        <View
          className="absolute left-0 right-0 z-10 flex-row items-center gap-2 px-3"
          style={{ paddingTop: Math.max(insets.top, 8), paddingBottom: 8 }}
        >
          <Text
            className="mr-2 min-w-0 flex-1 text-sm font-medium text-white"
            numberOfLines={1}
          >
            {title ?? "Image"}
          </Text>
          <Pressable
            onPress={() =>
              void shareLocalFileOrAlert(uri, {
                fileName,
                dialogTitle: title ? `Download ${title}` : "Download",
              })
            }
            hitSlop={8}
            className="h-10 flex-row items-center gap-1 rounded-full bg-white/15 px-3"
            accessibilityLabel="Download"
          >
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text className="text-xs font-medium text-white">Download</Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            className="h-10 w-10 items-center justify-center rounded-full bg-white/15"
            accessibilityLabel="Close full view"
          >
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </View>

        <View
          className="flex-1 items-center justify-center"
          style={{
            paddingTop: insets.top + 52,
            paddingBottom: Math.max(insets.bottom, 16),
            paddingHorizontal: 8,
          }}
        >
          <Image
            source={{ uri }}
            style={{
              width: width - 16,
              height: Math.max(200, height - insets.top - insets.bottom - 96),
            }}
            resizeMode="contain"
          />
        </View>
      </View>
    </AppModal>
  );
}

/** Safe-area wrapper for Android full-screen Modals (pageSheet is iOS-only).
 * Top/bottom insets are handled by `AppModal` — this only applies the background. */
export function ModalSafeArea({
  children,
  className = "bg-white",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <View className={`flex-1 ${className}`}>{children}</View>;
}
