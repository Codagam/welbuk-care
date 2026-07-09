import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Button, Screen } from "@/ui";
import {
  useActiveFacility,
  useAuthStore,
  useAuthUser,
} from "@/lib/auth/store";

export default function MoreScreen() {
  const router = useRouter();
  const facility = useActiveFacility();
  const user = useAuthUser();
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <Screen>
      <ScrollView>
        <View className="mx-auto w-full max-w-3xl gap-6 p-6">
          <View className="gap-1">
            <Text className="text-sm text-neutral-500">
              Signed in as {user?.name ?? user?.email}
            </Text>
            <Text className="text-2xl font-bold text-neutral-900">
              {facility?.name ?? "Welbuk Care"}
            </Text>
            {facility?.consultationType ? (
              <Text className="text-xs uppercase tracking-wide text-brand">
                {facility.consultationType} practice
              </Text>
            ) : null}
          </View>

          <View className="gap-3">
            <Button
              label="Switch facility"
              variant="outline"
              onPress={() => router.replace("/select-facility")}
            />
            <Button label="Sign out" variant="ghost" onPress={() => signOut()} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
