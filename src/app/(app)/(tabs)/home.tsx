import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Screen } from "@/ui";
import { HeaderActions } from "@/features/header";
import {
  stripDoctorNamePrefix,
  timeOfDayGreeting,
  userGreetingName,
} from "@/lib/auth/roles";
import {
  useActiveFacility,
  useAuthStore,
  useAuthUser,
} from "@/lib/auth/store";

const APP_VERSION = "1.0.0";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
      {children}
    </Text>
  );
}

function MenuCard({ children }: { children: ReactNode }) {
  return (
    <View className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      {children}
    </View>
  );
}

function MenuRow({
  icon,
  label,
  subtitle,
  trailing,
  onPress,
  destructive,
  last,
  showChevron = true,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  trailing?: string;
  onPress?: () => void;
  destructive?: boolean;
  last?: boolean;
  showChevron?: boolean;
}) {
  const content = (
    <>
      <View
        className={`h-10 w-10 items-center justify-center rounded-xl ${
          destructive ? "bg-red-50" : "bg-brand/10"
        }`}
      >
        <Ionicons
          name={icon}
          size={20}
          color={destructive ? "#dc2626" : "#FD006A"}
        />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className={`text-sm font-semibold ${
            destructive ? "text-red-600" : "text-neutral-900"
          }`}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-xs text-neutral-500" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <Text className="text-sm font-medium tabular-nums text-neutral-400">
          {trailing}
        </Text>
      ) : null}
      {showChevron ? (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={destructive ? "#fca5a5" : "#d1d5db"}
        />
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View
        className={`flex-row items-center gap-3 px-3.5 py-3.5 ${
          last ? "" : "border-b border-neutral-100"
        }`}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`flex-row items-center gap-3 px-3.5 py-3.5 active:bg-neutral-50 ${
        last ? "" : "border-b border-neutral-100"
      }`}
    >
      {content}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const facility = useActiveFacility();
  const user = useAuthUser();
  const signOut = useAuthStore((s) => s.signOut);
  const greetName = userGreetingName(user);
  const initialsName = stripDoctorNamePrefix(greetName) || greetName;
  const roleLabel =
    user?.roleLabels?.[0] ||
    user?.globalRole ||
    user?.role ||
    null;

  return (
    <Screen edges={["left", "right", "bottom"]}>
      <View className="bg-brand pt-3">
        <View className="flex-row items-center justify-between gap-3 px-5 pb-3 pt-2">
          <View className="min-w-0 flex-1 flex-row items-center gap-2">
            {facility?.name ? (
              <>
                <Ionicons
                  name="business-outline"
                  size={16}
                  color="rgba(255,255,255,0.85)"
                />
                <Text
                  className="min-w-0 flex-1 text-sm font-medium text-white/90"
                  numberOfLines={1}
                >
                  {facility.name}
                </Text>
              </>
            ) : (
              <Text className="text-sm text-white/70">
                {t("settings.noFacility")}
              </Text>
            )}
          </View>
          <HeaderActions light />
        </View>

        <View className="mx-5 h-px bg-white/20" />

        <View className="px-5 py-4">
          <Text className="text-[22px] font-semibold leading-7 text-white">
            {t("settings.title")}
          </Text>
          <Text className="mt-1 text-sm text-white/80" numberOfLines={1}>
            {greetName
              ? `${timeOfDayGreeting()}, ${greetName}`
              : t("settings.signedIn")}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 40,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 1152,
            alignSelf: "center",
            gap: 18,
          }}
        >
          <MenuCard>
            <View className="flex-row items-center gap-3.5 px-4 py-4">
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-brand/10">
                <Text className="text-lg font-bold text-brand">
                  {initialsFromName(initialsName || "U")}
                </Text>
              </View>
              <View className="min-w-0 flex-1 gap-0.5">
                <Text
                  className="text-base font-semibold text-neutral-900"
                  numberOfLines={1}
                >
                  {greetName || t("settings.account")}
                </Text>
                {user?.email ? (
                  <Text className="text-sm text-neutral-500" numberOfLines={1}>
                    {user.email}
                  </Text>
                ) : null}
                {roleLabel ? (
                  <View className="mt-1 self-start rounded-full bg-brand/10 px-2 py-0.5">
                    <Text className="text-[11px] font-semibold uppercase tracking-wide text-brand">
                      {String(roleLabel).replace(/_/g, " ")}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View className="mx-4 h-px bg-neutral-100" />

            <MenuRow
              icon="swap-horizontal-outline"
              label={t("common.switchFacility")}
              subtitle={facility?.name}
              last
              onPress={() => router.push("/select-facility")}
            />
          </MenuCard>

          <View>
            <SectionLabel>{t("settings.support")}</SectionLabel>
            <MenuCard>
              <MenuRow
                icon="help-circle-outline"
                label={t("settings.helpFaq")}
                subtitle={t("settings.helpFaqHint")}
                onPress={() => console.log("settings: help & faq")}
              />
              <MenuRow
                icon="chatbubble-ellipses-outline"
                label={t("settings.contactSupport")}
                subtitle={t("settings.contactSupportHint")}
                last
                onPress={() => console.log("settings: contact support")}
              />
            </MenuCard>
          </View>

          <View>
            <SectionLabel>{t("settings.legal")}</SectionLabel>
            <MenuCard>
              <MenuRow
                icon="document-text-outline"
                label={t("settings.terms")}
                onPress={() => console.log("settings: terms & conditions")}
              />
              <MenuRow
                icon="shield-checkmark-outline"
                label={t("settings.privacy")}
                last
                onPress={() => console.log("settings: privacy policy")}
              />
            </MenuCard>
          </View>

          <View>
            <SectionLabel>{t("settings.about")}</SectionLabel>
            <MenuCard>
              <MenuRow
                icon="information-circle-outline"
                label={t("settings.appVersion")}
                trailing={APP_VERSION}
                last
                showChevron={false}
              />
            </MenuCard>
          </View>

          <MenuCard>
            <MenuRow
              icon="log-out-outline"
              label={t("common.signOut")}
              destructive
              last
              onPress={() => signOut()}
            />
          </MenuCard>
        </View>
      </ScrollView>
    </Screen>
  );
}
