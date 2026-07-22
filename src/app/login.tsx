import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Screen, TextField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { useAuthStore } from "@/lib/auth/store";

const AUTH_HEADER_ICON = require("@/assets/images/auth-header-icon.png");

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const status = useAuthStore((s) => s.status);
  const activeFacilityId = useAuthStore((s) => s.activeFacilityId);
  const signIn = useAuthStore((s) => s.signIn);
  const sessionExpired = useAuthStore((s) => s.sessionExpired);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already signed in → leave the login screen.
  if (status === "authed") {
    return <Redirect href={activeFacilityId ? "/queue" : "/select-facility"} />;
  }

  const onSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await signIn({ email, password });
      const facilityId = useAuthStore.getState().activeFacilityId;
      router.replace(facilityId ? "/queue" : "/select-facility");
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen bgClassName="bg-white" edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View
            className="items-center bg-brand px-6 pb-10"
            style={{ paddingTop: Math.max(insets.top, 24) + 12 }}
          >
            <Image
              source={AUTH_HEADER_ICON}
              style={{ width: 112, height: 112 }}
              resizeMode="contain"
              accessibilityLabel="Welbuk"
            />
            <Text
              className="mt-5 text-center text-3xl font-bold tracking-tight text-white"
              numberOfLines={1}
            >
              {"Welbuk\u00A0Care"}
            </Text>
            <Text className="mt-2 text-center text-sm text-white/85">
              Sign in to your clinic account
            </Text>
          </View>

          <View className="-mt-5 flex-1 rounded-t-3xl bg-white px-6 pb-10 pt-8">
            <View className="mx-auto w-full max-w-md gap-5">
              {sessionExpired ? (
                <View className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <Text className="text-sm text-amber-800">
                    Your session expired. Please sign in again.
                  </Text>
                </View>
              ) : null}

              <View className="gap-1">
                <Text className="text-xl font-semibold text-neutral-900">
                  Welcome back
                </Text>
                <Text className="text-sm text-neutral-500">
                  Enter your credentials to continue
                </Text>
              </View>

              <View className="gap-4">
                <TextField
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                  placeholder="you@clinic.com"
                />
                <TextField
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="••••••••"
                  onSubmitEditing={onSubmit}
                  returnKeyType="go"
                />
                {error ? (
                  <Text className="text-sm text-red-500">{error}</Text>
                ) : null}
                <Button
                  label="Sign in"
                  size="lg"
                  onPress={onSubmit}
                  loading={loading}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
