import { Text, View } from "react-native";

import { SectionChrome } from "@/features/consult/components/SectionChrome";
import type { Patient } from "../types";
import {
  calcAge,
  formatDob,
  fullName,
  initials,
  normalizeGender,
} from "../utils";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="w-1/2 gap-0.5 py-1.5 pr-3">
      <Text className="text-[11px] uppercase tracking-wide text-neutral-400">
        {label}
      </Text>
      <Text className="text-sm text-neutral-900">{value || "—"}</Text>
    </View>
  );
}

export function PatientHeaderCard({ patient }: { patient: Patient }) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-50">
          <Text className="text-base font-bold text-brand-700">
            {initials(patient)}
          </Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text
            className="text-xl font-semibold tracking-tight text-neutral-900"
            numberOfLines={1}
          >
            {fullName(patient)}
          </Text>
          <Text className="text-sm text-neutral-500">
            #{String(patient.patientId)}
            {patient.abhaNumber ? "  ·  ABHA linked" : ""}
          </Text>
        </View>
      </View>

      <SectionChrome title="Demographics" icon="person-outline">
        <View className="flex-row flex-wrap">
          <Field label="Gender" value={normalizeGender(patient.gender)} />
          <Field
            label="Age"
            value={
              calcAge(patient.dob) != null
                ? `${calcAge(patient.dob)} years`
                : "—"
            }
          />
          <Field label="Date of birth" value={formatDob(patient.dob)} />
          <Field label="Blood group" value={patient.bloodGroup} />
          <Field label="Mobile" value={patient.phone} />
          <Field label="Email" value={patient.email} />
          <Field label="ABHA" value={patient.abhaNumber} />
          <Field label="Guardian" value={patient.parentOrGuardianName} />
        </View>
        {patient.address ? (
          <View className="mt-2 gap-0.5 border-t border-neutral-100 pt-3">
            <Text className="text-xs uppercase tracking-wide text-neutral-400">
              Address
            </Text>
            <Text className="text-base text-neutral-900">{patient.address}</Text>
          </View>
        ) : null}
      </SectionChrome>
    </View>
  );
}
