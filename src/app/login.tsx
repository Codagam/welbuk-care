import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";

import { Button, Screen, TextField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { useAuthStore } from "@/lib/auth/store";

export default function LoginScreen() {
  const router = useRouter();
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
    return <Redirect href={activeFacilityId ? "/home" : "/select-facility"} />;
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
      router.replace(facilityId ? "/home" : "/select-facility");
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen bgClassName="bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mx-auto w-full max-w-md gap-6 px-6 py-10">
            <View className="items-center gap-3">
              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brand">
                <Text className="text-2xl font-bold text-brand-foreground">W</Text>
              </View>
              <Text className="text-2xl font-bold text-neutral-900">Welbuk Care</Text>
              <Text className="text-sm text-neutral-500">
                Sign in to your clinic account
              </Text>
            </View>

            {sessionExpired ? (
              <View className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <Text className="text-sm text-amber-800">
                  Your session expired. Please sign in again.
                </Text>
              </View>
            ) : null}

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
              {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
              <Button label="Sign in" onPress={onSubmit} loading={loading} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
