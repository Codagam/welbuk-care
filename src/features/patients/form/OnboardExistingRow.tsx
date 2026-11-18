import { useState } from "react";
import { Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { connectNetworkPatient } from "@/lib/api/endpoints/walk-in";
import { PhoneOtpVerify } from "@/features/walk-in/components/PhoneOtpVerify";
import { Tag } from "./kit";

export interface ExistingRecord {
  /** Mongo id — what the onboard connect call takes. */
  id: string;
  patientId?: number | string | null;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  meta?: string | null;
  tags?: { label: string; tone?: "neutral" | "amber" | "green" }[];
  /** Already a patient here → open it; otherwise onboard it by OTP. */
  isLinkedToFacility: boolean;
  previouslyAtFacility?: boolean;
}

function last10(value: string | null | undefined): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

/**
 * One record that already exists. Here → "Open"; at another clinic (or
 * removed from this one) → OTP to the patient's mobile, then link the
 * EXISTING record (`POST /api/patient/onboard` connect) instead of minting a
 * second `Patient` — the same OTP-gated flow Practice web uses.
 */
export function OnboardExistingRow({
  record,
  facilityId,
  fallbackMobile,
  onOpen,
}: {
  record: ExistingRecord;
  facilityId: string;
  fallbackMobile?: string;
  onOpen: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [phoneToken, setPhoneToken] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name =
    [record.firstName, record.lastName].filter(Boolean).join(" ") ||
    "Unnamed patient";
  const phone = last10(record.phone) || last10(fallbackMobile);
  const routeId = String(record.patientId ?? record.id);

  const connect = async () => {
    if (!phoneToken || !phone) return;
    setError(null);
    setConnecting(true);
    try {
      await connectNetworkPatient({
        facilityId,
        patientId: record.id,
        phone,
        phoneToken,
      });
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patients-by-phone"] });
      onOpen(routeId);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setConnecting(false);
    }
  };

  return (
    <View className="gap-2 rounded-xl border border-neutral-200 bg-white p-3">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-sm font-semibold text-neutral-900">{name}</Text>
        {record.tags?.map((t) => (
          <Tag key={t.label} label={t.label} tone={t.tone} />
        ))}
      </View>
      {record.meta ? (
        <Text className="text-xs text-neutral-500">{record.meta}</Text>
      ) : null}

      {record.isLinkedToFacility ? (
        <Button
          label="Open this record"
          variant="outline"
          size="md"
          onPress={() => onOpen(routeId)}
        />
      ) : !phone ? (
        <Text className="text-xs text-neutral-500">
          No mobile on file — this record can&apos;t be onboarded by OTP.
        </Text>
      ) : open ? (
        <View className="gap-2">
          <Text className="text-xs text-neutral-600">
            Send a code to the mobile ending {phone.slice(-4)} to add this record
            to your facility.
          </Text>
          <PhoneOtpVerify
            mobile10={phone}
            required
            phoneToken={phoneToken}
            onVerified={setPhoneToken}
          />
          <Button
            label={record.previouslyAtFacility ? "Reopen record" : "Add to this facility"}
            size="md"
            onPress={connect}
            loading={connecting}
            disabled={!phoneToken}
          />
        </View>
      ) : (
        <Button
          label={
            record.previouslyAtFacility
              ? "Reopen this record"
              : "Add existing record to this facility"
          }
          variant="outline"
          size="md"
          onPress={() => {
            setOpen(true);
            setPhoneToken(null);
            setError(null);
          }}
        />
      )}

      {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
    </View>
  );
}
