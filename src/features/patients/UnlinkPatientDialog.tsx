import { useState } from "react";
import { Text, View } from "react-native";

import { AppModal, Button } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { useFacilityId } from "@/lib/auth/store";
import { useUnlinkPatient } from "./hooks";
import { fullName } from "./utils";
import type { Patient } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
  onUnlinked?: () => void;
};

/** Soft-remove FacilityPatient link — does not delete the patient record. */
export function UnlinkPatientDialog({
  open,
  onOpenChange,
  patient,
  onUnlinked,
}: Props) {
  const facilityId = useFacilityId();
  const unlink = useUnlinkPatient();
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setError(null);
    if (!facilityId) {
      setError("No facility selected.");
      return;
    }
    try {
      await unlink.mutateAsync({ id: patient.id, facilityId });
      onOpenChange(false);
      onUnlinked?.();
    } catch (e) {
      setError(describeError(e));
    }
  };

  return (
    <AppModal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => onOpenChange(false)}
      androidSafeArea={false}
    >
      <View className="flex-1 items-center justify-center bg-black/40 px-6">
        <View className="w-full max-w-md gap-4 rounded-2xl bg-white p-5">
          <Text className="text-lg font-semibold text-neutral-900">
            Remove from facility?
          </Text>
          <Text className="text-sm text-neutral-600">
            {fullName(patient)} (#{String(patient.patientId)}) will be unlinked
            from this facility. The patient record is kept and can be linked
            again later.
          </Text>
          {error ? (
            <Text className="text-sm text-red-500">{error}</Text>
          ) : null}
          <View className="flex-row gap-3">
            <Button
              label="Cancel"
              variant="outline"
              className="flex-1"
              disabled={unlink.isPending}
              onPress={() => onOpenChange(false)}
            />
            <Button
              label="Remove"
              variant="danger"
              className="flex-1"
              loading={unlink.isPending}
              disabled={unlink.isPending}
              onPress={() => void confirm()}
            />
          </View>
        </View>
      </View>
    </AppModal>
  );
}
