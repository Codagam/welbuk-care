import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { describeError } from "@/lib/api/errors";
import { sendPhoneOtp, verifyPhoneOtp } from "@/lib/api/endpoints/walk-in";
import { useCountdown } from "../hooks";

const RESEND_COOLDOWN_MS = 30_000;

interface Props {
  mobile10: string;
  required: boolean;
  phoneToken: string | null;
  onVerified: (phoneToken: string) => void;
}

/**
 * Desk OTP: send → patient reads the code back → verify-phone mints a
 * short-lived `phoneToken` that the onboard connect/create routes accept.
 */
export function PhoneOtpVerify({ mobile10, required, phoneToken, onVerified }: Props) {
  const { t } = useTranslation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const secondsLeft = useCountdown(resendAt);

  if (phoneToken) {
    return (
      <View className="flex-row items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3">
        <Ionicons name="shield-checkmark" size={18} color="#059669" />
        <Text className="text-sm font-semibold text-emerald-700">
          {t("walkIn.verified")}
        </Text>
      </View>
    );
  }

  const send = async () => {
    setError(null);
    setSending(true);
    try {
      const res = await sendPhoneOtp(mobile10);
      setSessionId(res.sessionId);
      setOtp("");
      setResendAt(Date.now() + RESEND_COOLDOWN_MS);
    } catch (err) {
      setError(`${t("walkIn.otpSendFailed")}: ${describeError(err)}`);
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (!sessionId || otp.length !== 6) return;
    setError(null);
    setVerifying(true);
    try {
      const res = await verifyPhoneOtp({ sessionId, otp, phone: mobile10 });
      onVerified(res.phoneToken);
    } catch (err) {
      setError(`${t("walkIn.otpFailed")}: ${describeError(err)}`);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View
      className={`gap-3 rounded-xl border px-3.5 py-3 ${
        required ? "border-amber-200 bg-amber-50" : "border-neutral-200 bg-neutral-50"
      }`}
    >
      <View className="flex-row items-center justify-between gap-2">
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={18}
            color={required ? "#b45309" : "#525252"}
          />
          <Text
            className={`text-sm font-semibold ${
              required ? "text-amber-800" : "text-neutral-700"
            }`}
            numberOfLines={1}
          >
            {required ? t("walkIn.otpTitleRequired") : t("walkIn.otpTitleOptional")}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={sending || secondsLeft > 0}
          onPress={() => void send()}
          className={`flex-row items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 active:bg-neutral-100 ${
            sending || secondsLeft > 0 ? "opacity-60" : ""
          }`}
        >
          {sending ? <ActivityIndicator size="small" color="#FD006A" /> : null}
          <Text className="text-sm font-semibold text-brand">
            {secondsLeft > 0
              ? t("walkIn.resendIn", { seconds: secondsLeft })
              : sessionId
                ? t("walkIn.resendOtp")
                : t("walkIn.sendOtp")}
          </Text>
        </Pressable>
      </View>

      {sessionId ? (
        <>
          <Text className="text-xs text-neutral-600">
            {t("walkIn.otpSentTo", { last4: mobile10.slice(-4) })}
          </Text>
          <View className="flex-row items-center gap-2">
            <TextInput
              value={otp}
              onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              maxLength={6}
              placeholder={t("walkIn.otpPlaceholder")}
              placeholderTextColor="#9ca3af"
              onSubmitEditing={() => void verify()}
              className="h-11 flex-1 rounded-xl border border-neutral-300 bg-white px-4 text-base tracking-[4px] text-neutral-900"
              style={{ height: 44, paddingVertical: 0 }}
            />
            <Pressable
              accessibilityRole="button"
              disabled={otp.length !== 6 || verifying}
              onPress={() => void verify()}
              className={`h-11 flex-row items-center justify-center gap-1.5 rounded-xl bg-brand px-4 active:bg-brand-600 ${
                otp.length !== 6 || verifying ? "opacity-50" : ""
              }`}
            >
              {verifying ? <ActivityIndicator size="small" color="#fff" /> : null}
              <Text className="text-sm font-semibold text-brand-foreground">
                {t("walkIn.verify")}
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
    </View>
  );
}
