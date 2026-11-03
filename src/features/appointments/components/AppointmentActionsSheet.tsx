import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { AppModal } from "@/ui";
import type { AppointmentActions } from "../lib/appointmentActions";

export type AppointmentActionKey = keyof AppointmentActions;

type Row = {
  key: AppointmentActionKey;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
};

const ROWS: Row[] = [
  { key: "reschedule", labelKey: "appointments.actions.reschedule", icon: "calendar-outline" },
  { key: "changeDoctor", labelKey: "appointments.actions.changeDoctor", icon: "swap-horizontal-outline" },
  { key: "cancel", labelKey: "appointments.actions.cancel", icon: "close-circle-outline", destructive: true },
  { key: "delete", labelKey: "appointments.actions.delete", icon: "trash-outline", destructive: true },
];

/**
 * Row ⋮ menu. Only lists what `resolveAppointmentActions` allowed, so an item
 * the person cannot use is absent rather than present-and-refused.
 */
export function AppointmentActionsSheet({
  open,
  patientName,
  actions,
  onSelect,
  onClose,
}: {
  open: boolean;
  patientName: string;
  actions: AppointmentActions;
  onSelect: (key: AppointmentActionKey) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const rows = ROWS.filter((r) => actions[r.key]);

  return (
    <AppModal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="rounded-t-2xl bg-white px-4 pb-8 pt-4"
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            className="mb-3 px-2 text-base font-semibold text-neutral-900"
            numberOfLines={1}
          >
            {patientName}
          </Text>
          {rows.map((row) => (
            <Pressable
              key={row.key}
              accessibilityRole="button"
              onPress={() => onSelect(row.key)}
              className="flex-row items-center gap-3 rounded-xl px-3 py-3.5 active:bg-neutral-100"
            >
              <Ionicons
                name={row.icon}
                size={20}
                color={row.destructive ? "#dc2626" : "#FD006A"}
              />
              <Text
                className={`text-base ${
                  row.destructive ? "text-red-600" : "text-neutral-900"
                }`}
              >
                {t(row.labelKey)}
              </Text>
            </Pressable>
          ))}
          <View className="mt-2 border-t border-neutral-100 pt-2">
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              className="items-center rounded-xl py-3 active:bg-neutral-100"
            >
              <Text className="text-base font-semibold text-neutral-600">
                {t("appointments.cancel")}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </AppModal>
  );
}
