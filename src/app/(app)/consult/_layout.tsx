import { Stack } from "expo-router";
import { View } from "react-native";

import { SectionAccessGate } from "@/features/permissions";

/**
 * Consult requires `consult.read` (or elevated admin).
 * Nurses and other non-doctors lose consult.* from GET /api/permissions
 * (Practice doctor clinical strip) — this layout blocks UI even if deep-linked.
 */
export default function ConsultLayout() {
  return (
    <View className="flex-1 bg-white">
      <SectionAccessGate resource="consult" sectionLabel="Consult">
        <Stack screenOptions={{ headerShown: false }} />
      </SectionAccessGate>
    </View>
  );
}
