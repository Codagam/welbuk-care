import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useFacilityId } from "@/lib/auth/store";

import { FacilityQrDialog, FacilityQrTriggerButton } from "./FacilityQrDialog";

/** Placeholder Attend icon (no attendance flow). */
function AttendIconButton({ light }: { light?: boolean }) {
  const color = light ? "#FFFFFF" : "#111827";
  return (
    <Pressable
      disabled
      accessibilityRole="button"
      accessibilityLabel="Attendance"
      accessibilityState={{ disabled: true }}
      hitSlop={8}
      className="h-11 w-11 items-center justify-center rounded-full opacity-80"
    >
      <Ionicons name="scan-outline" size={22} color={color} />
    </Pressable>
  );
}

/**
 * Sticky header actions: Attend icon (placeholder) → Facility QR.
 * Hidden when no facility is selected.
 */
export function HeaderActions({ light = true }: { light?: boolean }) {
  const facilityId = useFacilityId();
  const [qrOpen, setQrOpen] = useState(false);

  if (!facilityId) return null;

  return (
    <>
      <View className="flex-row items-center gap-0.5">
        <AttendIconButton light={light} />
        <FacilityQrTriggerButton
          light={light}
          onPress={() => setQrOpen(true)}
        />
      </View>
      <FacilityQrDialog open={qrOpen} onClose={() => setQrOpen(false)} />
    </>
  );
}
