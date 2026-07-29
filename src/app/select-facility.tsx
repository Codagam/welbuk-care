import { Pressable, ScrollView, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button, Screen, TopBar } from "@/ui";
import { useActiveFacility, useAuthStore, useFacilityId } from "@/lib/auth/store";

export default function SelectFacilityScreen() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const session = useAuthStore((s) => s.session);
  const setActiveFacility = useAuthStore((s) => s.setActiveFacility);
  const signOut = useAuthStore((s) => s.signOut);
  const facilityId = useFacilityId();
  const activeFacility = useActiveFacility();
  /** User already has a facility (e.g. switched from More) — allow going back. */
  const canGoBack = Boolean(facilityId);

  if (status === "anon") return <Redirect href="/login" />;

  const facilities = session?.facilities ?? [];

  const choose = async (id: string) => {
    await setActiveFacility(id);
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/queue");
  };

  return (
    <Screen bgClassName="bg-white">
      {canGoBack ? (
        <TopBar title="Switch facility" subtitle={activeFacility?.name} />
      ) : null}

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 16,
          paddingTop: canGoBack ? 16 : 24,
          paddingBottom: 32,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 1152,
            alignSelf: "center",
            gap: 16,
          }}
          className="mx-auto w-full max-w-6xl gap-4"
        >
          {!canGoBack ? (
            <View className="gap-1">
              <Text className="text-xl font-semibold tracking-tight text-neutral-900">
                Choose a facility
              </Text>
              <Text className="text-sm text-neutral-500">
                Select the clinic you&apos;re working at today.
              </Text>
            </View>
          ) : (
            <Text className="text-sm text-neutral-500">
              Select the clinic you&apos;re working at today.
            </Text>
          )}

          <View className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            {facilities.map((f, idx) => {
              const blocked = !!f.networkBlocked;
              const selected = f.id === facilityId;
              const last = idx === facilities.length - 1;
              return (
                <Pressable
                  key={f.id}
                  disabled={blocked}
                  onPress={() => void choose(f.id)}
                  accessibilityRole="button"
                  accessibilityLabel={f.name}
                  className={`flex-row items-center gap-3 px-3.5 py-3.5 ${
                    last ? "" : "border-b border-neutral-100"
                  } ${
                    blocked
                      ? "bg-neutral-50 opacity-60"
                      : selected
                        ? "bg-brand/5 active:bg-brand/10"
                        : "bg-white active:bg-neutral-50"
                  }`}
                >
                  <View
                    className={`h-10 w-10 items-center justify-center rounded-full ${
                      selected ? "bg-brand/15" : "bg-brand/10"
                    }`}
                  >
                    <Ionicons
                      name="business-outline"
                      size={20}
                      color="#FD006A"
                    />
                  </View>
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text className="text-sm font-semibold text-neutral-900">
                      {f.name}
                    </Text>
                    {f.address ? (
                      <Text
                        className="text-xs text-neutral-500"
                        numberOfLines={2}
                      >
                        {f.address}
                      </Text>
                    ) : null}
                    {blocked ? (
                      <Text className="mt-0.5 text-xs text-red-500">
                        This device isn&apos;t on an allowed network for this
                        facility.
                      </Text>
                    ) : null}
                  </View>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={22} color="#FD006A" />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
                  )}
                </Pressable>
              );
            })}
            {facilities.length === 0 ? (
              <Text className="px-3.5 py-6 text-sm text-neutral-500">
                No facilities are linked to your account. Contact your
                administrator.
              </Text>
            ) : null}
          </View>

          <Button label="Sign out" variant="ghost" onPress={() => signOut()} />
        </View>
      </ScrollView>
    </Screen>
  );
}
