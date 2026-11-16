import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AudioModule } from "expo-audio";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { AppAlert, AppModal, Button } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { mintSpeakadocSession } from "@/lib/api/endpoints/speakadoc";

export interface SpeakadocResultMeta {
  /** SpeakADoc usage session for this open (null with an older SpeakADoc). */
  usageSessionId: string | null;
}

/** Which view the widget is showing (from its `speakadoc:layout` message). */
type CardView = "recording" | "review";

/** Origin of an absolute URL, without relying on RN's partial URL polyfill. */
function originOf(url: string | undefined | null): string | null {
  const m = /^(https?:\/\/[^/?#]+)/i.exec(String(url ?? ""));
  return m ? m[1]!.toLowerCase() : null;
}

/**
 * On the web the widget is an iframe and posts to `window.parent`. In a native
 * WebView it is the top page, so `window.parent === window` and its
 * `postMessage(msg, parentOrigin)` would be dropped (wrong target origin).
 * This bridge, injected before the widget's own scripts, hands every
 * `speakadoc:*` message to the app instead. Anything else is left alone.
 */
const BRIDGE_JS = `(function () {
  if (window.__welbukSpeakadocBridge) return;
  window.__welbukSpeakadocBridge = true;
  function ours(d) { return d && typeof d === "object" && typeof d.type === "string" && d.type.indexOf("speakadoc:") === 0; }
  function send(d) { try { window.ReactNativeWebView.postMessage(JSON.stringify(d)); } catch (e) {} }
  var nativePost = window.postMessage.bind(window);
  window.postMessage = function (d, t, x) { if (ours(d)) { send(d); return; } return nativePost(d, t, x); };
  try { window.parent = { postMessage: function (d) { if (ours(d)) send(d); } }; } catch (e) {}
})(); true;`;

/**
 * SpeakADoc recorder (Practice `SpeakadocWidgetDialog`): a card over a dimmed
 * backdrop, bottom-right on a tablet. Mints a short-lived session token
 * (POST /api/speakadoc/session-token) and loads the widget, which owns the
 * mic, speech-to-text, speaker labels and Finalize. Welbuk only receives the
 * finished result. Mounted only while `visible`, so a closed recorder holds no
 * token, no WebView and no listener.
 */
export function SpeakadocRecorderSheet(props: {
  visible: boolean;
  onClose: () => void;
  facilityId: string;
  consultationId: string;
  patientId?: string;
  onResult: (data: unknown, meta: SpeakadocResultMeta) => void;
}) {
  if (!props.visible) return null;
  return <RecorderCard {...props} />;
}

function RecorderCard({
  onClose,
  facilityId,
  consultationId,
  patientId,
  onResult,
}: {
  onClose: () => void;
  facilityId: string;
  consultationId: string;
  patientId?: string;
  onResult: (data: unknown, meta: SpeakadocResultMeta) => void;
}) {
  const { width, height } = useWindowDimensions();
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null);
  // Same value as widgetOriginRef, derived for render (refs are not read there).
  const widgetOrigin = originOf(widgetUrl);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<CardView>("recording");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Messages are acted on only from this session's own widget origin.
  const widgetOriginRef = useRef<string | null>(null);
  const usageSessionIdRef = useRef<string | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Ask for the mic first: the WebView can only pass on a permission
        // the app already holds.
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) {
          throw new Error(
            "Microphone access is off for Welbuk Care. Turn it on in Settings to record."
          );
        }
        const session = await mintSpeakadocSession({
          facilityId,
          consultationId,
          patientId,
        });
        if (cancelled) return;
        const origin = originOf(session.widgetUrl);
        if (!origin) throw new Error("SpeakADoc returned an invalid widget address.");
        widgetOriginRef.current = origin;
        usageSessionIdRef.current =
          typeof session.usageSessionId === "string" ? session.usageSessionId : null;
        setWidgetUrl(session.widgetUrl);
      } catch (e) {
        if (!cancelled) setError(describeError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [facilityId, consultationId, patientId]);

  const handleMessage = (event: WebViewMessageEvent) => {
    if (!widgetOriginRef.current) return;
    if (originOf(event.nativeEvent.url) !== widgetOriginRef.current) return;
    let payload: { type?: string; data?: unknown; message?: string; view?: string } | null =
      null;
    try {
      payload = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (!payload?.type) return;

    if (payload.type === "speakadoc:result") {
      if (doneRef.current) return;
      doneRef.current = true;
      onResult(payload.data, { usageSessionId: usageSessionIdRef.current });
      AppAlert.success("Conversation saved");
      onClose();
    } else if (payload.type === "speakadoc:error") {
      AppAlert.warn("SpeakADoc", payload.message || "SpeakADoc reported an error");
    } else if (payload.type === "speakadoc:close") {
      onClose();
    } else if (payload.type === "speakadoc:layout") {
      if (payload.view === "recording" || payload.view === "review") setView(payload.view);
    }
  };

  // Nothing reaches Welbuk before Finalize, so closing a live widget loses
  // the recording: ask first. Before the widget is up there is nothing to lose.
  const requestClose = () => {
    if (widgetUrl && !error) setConfirmDiscard(true);
    else onClose();
  };

  const wide = width >= 700;
  const cardWidth = wide ? Math.min(400, width - 32) : width - 24;
  const cardHeight = Math.min(view === "review" ? 640 : 400, height - 96);

  return (
    <AppModal visible transparent animationType="fade" onRequestClose={requestClose}>
      <View className="flex-1 bg-black/50">
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={requestClose}
          accessibilityLabel="Close SpeakADoc"
        />
        <View
          style={{
            position: "absolute",
            right: wide ? 16 : 12,
            bottom: 24,
            width: cardWidth,
            height: cardHeight,
          }}
          className="overflow-hidden rounded-3xl border border-neutral-200 bg-white"
        >
          <View className="flex-row items-center gap-2 border-b border-neutral-200 px-4 py-3">
            <Ionicons name="pulse" size={22} color="#FD006A" />
            <Text className="flex-1 text-base font-semibold text-neutral-900">
              SpeakADoc
            </Text>
            <Pressable
              onPress={requestClose}
              hitSlop={10}
              accessibilityLabel="Close SpeakADoc"
              className="rounded-full p-1.5 active:bg-neutral-100"
            >
              <Ionicons name="close" size={20} color="#6b7280" />
            </Pressable>
          </View>

          <View className="flex-1">
            {error ? (
              <View className="flex-1 items-center justify-center gap-3 p-6">
                <Text className="text-center text-sm text-red-600">{error}</Text>
                <Button label="Close" variant="outline" onPress={onClose} />
              </View>
            ) : !widgetUrl ? (
              <View className="flex-1 items-center justify-center gap-2 p-6">
                <ActivityIndicator color="#FD006A" />
                <Text className="text-sm text-neutral-500">Starting SpeakADoc…</Text>
              </View>
            ) : (
              <WebView
                source={{ uri: widgetUrl }}
                injectedJavaScriptBeforeContentLoaded={BRIDGE_JS}
                onMessage={handleMessage}
                // Stay on the widget; anything else is not ours to show.
                originWhitelist={[widgetOrigin ?? "https://*"]}
                onShouldStartLoadWithRequest={(req) =>
                  req.url === "about:blank" ||
                  originOf(req.url) === widgetOrigin
                }
                javaScriptEnabled
                domStorageEnabled
                // The widget autostarts recording on open.
                mediaPlaybackRequiresUserAction={false}
                allowsInlineMediaPlayback
                mediaCapturePermissionGrantType="grant"
                onError={(e) =>
                  setError(e.nativeEvent.description || "SpeakADoc could not load.")
                }
                onHttpError={(e) =>
                  setError(`SpeakADoc could not load (HTTP ${e.nativeEvent.statusCode}).`)
                }
                startInLoadingState
                renderLoading={() => (
                  <View className="absolute inset-0 items-center justify-center bg-white">
                    <ActivityIndicator color="#FD006A" />
                  </View>
                )}
              />
            )}

            {confirmDiscard ? (
              <View className="absolute inset-0 items-center justify-center bg-white/95 p-6">
                <Text className="text-sm font-semibold text-neutral-900">
                  Discard this recording?
                </Text>
                <Text className="mt-1 text-center text-xs text-neutral-600">
                  It has not been saved. Press Finalize to keep it.
                </Text>
                <View className="mt-4 flex-row gap-2">
                  <Button
                    label="Keep"
                    variant="outline"
                   
                    onPress={() => setConfirmDiscard(false)}
                  />
                  <Button label="Discard" variant="danger" onPress={onClose} />
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </AppModal>
  );
}
