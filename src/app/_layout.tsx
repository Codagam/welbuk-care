import "@/global.css";
import "@/lib/i18n";

import { Ionicons } from "@expo/vector-icons";
import { QueryClientProvider } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useMemo, useState } from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { useAuthStore } from "@/lib/auth/store";
import { queryClient } from "@/lib/query";
import { AppModal, AppStatusBar, Button } from "@/ui";

SplashScreen.preventAutoHideAsync();

type VersionResponse = {
  data?: {
    iosVersionCode?: string | number;
    iosPromptMessage?: string;
    androidVersionCode?: string | number;
    promptMessage?: string;
    forceUpdate?: boolean;
    appStoreUrl?: string;
    playStoreUrl?: string;
  };
};

type UpdatePrompt = {
  title: string;
  message: string;
  forceUpdate: boolean;
  storeUrl: string;
};

function UpdateVersionAlert() {
  const isIOS = Platform.OS === "ios";
  const [prompt, setPrompt] = useState<UpdatePrompt | null>(null);

  // Global (not ref) so StrictMode double-mount in dev won't spam the alert.
  const globalKey = useMemo(() => "__welbuk_version_checked__", []);

  useEffect(() => {
    const g = globalThis as unknown as Record<string, unknown>;
    if (g[globalKey]) return;
    g[globalKey] = true;

    const run = async () => {
      try {
        const localVersionCode = String(
          Constants.nativeBuildVersion ??
            // Fallback if native build version is missing for some reason.
            Constants.expoConfig?.version ??
            ""
        ).trim();

        if (!localVersionCode) return;

        const res = await api<VersionResponse>({
          path: "/api/getVersion",
          method: "GET",
          query: { appType: "care" },
          // This should be safe to call without a user session.
          skipAuth: true,
        });

        const payload = res?.data;
        if (!payload) return;

        const remoteVersionCodeRaw = isIOS
          ? payload.iosVersionCode
          : payload.androidVersionCode;
        const remoteVersionCode =
          remoteVersionCodeRaw == null ? "" : String(remoteVersionCodeRaw);

        // If same version/build => no alert at all.
        if (!remoteVersionCode || remoteVersionCode === localVersionCode) return;

        const message = isIOS
          ? payload.iosPromptMessage
          : payload.promptMessage;
        if (!message) return;

        const forceUpdate = Boolean(payload.forceUpdate);
        setPrompt({
          title: forceUpdate ? "Update Required" : "Update Available",
          message,
          forceUpdate,
          storeUrl: (isIOS ? payload.appStoreUrl : payload.playStoreUrl) || "",
        });
      } catch (err) {
        // No CARE row configured yet in the backend — expected until an
        // admin creates one, not a real failure. Stay quiet.
        if (err instanceof ApiError && err.code === "NOT_FOUND") return;

        // Never block app startup for update checks.
        console.error("[Version] Check failed:", err);
      }
    };

    void run();
  }, [globalKey, isIOS]);

  const dismiss = () => {
    if (prompt?.forceUpdate) return;
    setPrompt(null);
  };

  const onUpdate = () => {
    if (!prompt?.storeUrl) return;
    void Linking.openURL(prompt.storeUrl);
  };

  return (
    <AppModal
      visible={prompt != null}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      androidSafeArea={false}
    >
      <View className="flex-1 items-center justify-center bg-black/40 px-6">
        {!prompt?.forceUpdate ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss update"
            className="absolute inset-0"
            onPress={dismiss}
          />
        ) : null}
        <View className="w-full max-w-md rounded-2xl bg-white p-5">
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
              <Ionicons
                name={
                  prompt?.forceUpdate
                    ? "cloud-download-outline"
                    : "arrow-up-circle-outline"
                }
                size={22}
                color="#FD006A"
              />
            </View>
            <View className="min-w-0 flex-1 gap-1.5">
              <Text className="text-lg font-semibold text-neutral-900">
                {prompt?.title}
              </Text>
              <Text className="text-sm leading-5 text-neutral-600">
                {prompt?.message}
              </Text>
            </View>
          </View>

          <View className="mt-5 flex-row gap-3">
            {prompt?.forceUpdate ? null : (
              <Button
                label="Cancel"
                variant="outline"
                className="flex-1"
                onPress={dismiss}
              />
            )}
            <Button
              label="Update"
              variant="primary"
              className="flex-1"
              onPress={onUpdate}
            />
          </View>
        </View>
      </View>
    </AppModal>
  );
}

/**
 * Root error boundary (wired automatically by expo-router). Catches render-time
 * crashes anywhere below and shows a recoverable screen instead of unmounting
 * the whole tree to a white screen in production.
 *
 * Uses inline styles on purpose — this must render even if NativeWind / theming
 * is implicated in the crash. Event-handler and async errors are handled
 * elsewhere via try/catch + describeError; this covers the render path.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    // TODO(sentry): Sentry.captureException(error) once the DSN is configured.
    console.error("[ErrorBoundary]", error);
  }, [error]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: "#ffffff",
      }}
    >
      <View
        style={{
          height: 64,
          width: 64,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 20,
          backgroundColor: "#FD006A",
          marginBottom: 16,
        }}
      >
        <Ionicons name="warning-outline" size={30} color="#ffffff" />
      </View>
      <Text
        style={{
          fontSize: 18,
          fontWeight: "600",
          color: "#111827",
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        Something went wrong
      </Text>
      <Text
        style={{
          fontSize: 14,
          lineHeight: 20,
          color: "#6b7280",
          textAlign: "center",
          maxWidth: 360,
          marginBottom: 20,
        }}
      >
        The app hit an unexpected problem. Try again — if it keeps happening,
        close and reopen the app.
      </Text>
      <Pressable
        onPress={retry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
        style={{
          backgroundColor: "#FD006A",
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 12,
        }}
      >
        <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "600" }}>
          Try again
        </Text>
      </Pressable>
      {__DEV__ ? (
        <Text
          style={{
            fontSize: 11,
            color: "#9ca3af",
            textAlign: "center",
            marginTop: 16,
          }}
        >
          {error?.message}
        </Text>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate().finally(() => {
      SplashScreen.hideAsync().catch(() => {});
    });
  }, [hydrate]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <AppStatusBar />
          <UpdateVersionAlert />
          <Stack screenOptions={{ headerShown: false }} />
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}