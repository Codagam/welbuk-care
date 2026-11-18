import { Text, View } from "react-native";

import { Button } from "@/ui";
import { OnboardExistingRow } from "./form/OnboardExistingRow";
import type { DuplicatePatientCandidate } from "./types";
import { dobToInput } from "./utils";

interface Props {
  message: string;
  duplicates: DuplicatePatientCandidate[];
  facilityId: string;
  /** Mobile typed on the form — fallback when a match carries no phone. */
  formMobile: string;
  /** Open an existing record (display patientId or Mongo id). */
  onOpen: (id: string) => void;
  /** Re-submit with `confirmedNotDuplicate` — a different person after all. */
  onRegisterAnyway: () => void;
  registering: boolean;
}

/**
 * Answer to Practice's 409 `PATIENT_DUPLICATE` (same mobile + DOB, or same
 * name + DOB). Mirrors the Practice patient form: the useful action is to OPEN
 * the record already here, or — when the person exists only at another clinic —
 * to onboard that record by OTP instead of minting a second `Patient`.
 * "Register anyway" stays available (twins) but is the secondary button.
 */
export function DuplicatePatientPanel({
  message,
  duplicates,
  facilityId,
  formMobile,
  onOpen,
  onRegisterAnyway,
  registering,
}: Props) {
  return (
    <View className="gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <Text className="text-sm font-semibold text-amber-900">{message}</Text>

      {duplicates.map((d) => (
        <OnboardExistingRow
          key={d.id}
          facilityId={facilityId}
          fallbackMobile={formMobile}
          onOpen={onOpen}
          record={{
            id: d.id,
            patientId: d.patientId,
            firstName: d.firstName,
            lastName: d.lastName,
            phone: d.phone,
            isLinkedToFacility: d.isLinkedToFacility,
            meta: [
              `ID ${d.patientId}`,
              d.dob ? `DOB ${dobToInput(d.dob)}` : null,
              d.phone,
            ]
              .filter(Boolean)
              .join(" · "),
            tags: [
              ...(d.nameMatches ? [{ label: "name matches" }] : []),
              ...(d.phoneMatches ? [{ label: "mobile matches" }] : []),
              ...(!d.isLinkedToFacility
                ? [{ label: "not at this facility", tone: "amber" as const }]
                : []),
            ],
          }}
        />
      ))}

      <Button
        label="Different person — register anyway"
        variant="ghost"
        onPress={onRegisterAnyway}
        loading={registering}
      />
    </View>
  );
}
