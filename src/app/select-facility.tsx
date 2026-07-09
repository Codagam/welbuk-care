import { Pressable, ScrollView, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";

import { Button, Screen } from "@/ui";
import { useAuthStore } from "@/lib/auth/store";

export default function SelectFacilityScreen() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const session = useAuthStore((s) => s.session);
  const setActiveFacility = useAuthStore((s) => s.setActiveFacility);
  const signOut = useAuthStore((s) => s.signOut);

  if (status === "anon") return <Redirect href="/login" />;

  const facilities = session?.facilities ?? [];

  const choose = async (id: string) => {
    await setActiveFacility(id);
    router.replace("/queue");
  };

  return (
    <Screen bgClassName="bg-white">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="mx-auto w-full max-w-2xl gap-6 px-6 py-10">
          <View className="gap-1">
            <Text className="text-2xl font-bold text-neutral-900">
              Choose a facility
            </Text>
            <Text className="text-sm text-neutral-500">
              Select the clinic you&apos;re working at today.
            </Text>
          </View>

          <View className="gap-3">
            {facilities.map((f) => {
              const blocked = !!f.networkBlocked;
              return (
                <Pressable
                  key={f.id}
                  disabled={blocked}
                  onPress={() => choose(f.id)}
                  className={`rounded-2xl border px-5 py-4 ${
                    blocked
                      ? "border-neutral-200 bg-neutral-50 opacity-60"
                      : "border-neutral-300 bg-white active:bg-neutral-50"
                  }`}
                >
                  <Text className="text-base font-semibold text-neutral-900">
                    {f.name}
                  </Text>
                  {f.address ? (
                    <Text className="text-sm text-neutral-500">{f.address}</Text>
                  ) : null}
                  {blocked ? (
                    <Text className="mt-1 text-xs text-red-500">
                      This device isn&apos;t on an allowed network for this facility.
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
            {facilities.length === 0 ? (
              <Text className="text-sm text-neutral-500">
                No facilities are linked to your account. Contact your administrator.
              </Text>
            ) : null}
          </View>

          <Button label="Sign out" variant="ghost" onPress={() => signOut()} />
        </View>
      </ScrollView>
    </Screen>
  );
}
