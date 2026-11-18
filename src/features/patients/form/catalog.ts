/**
 * Registration pick-lists, copied from Practice so the tablet asks the same
 * questions and writes the same values:
 *  - consent channels / purposes → Practice `lib/consent/purposes.ts`
 *  - languages                  → Practice `lib/comms/patient-language.ts`
 *  - relationships              → Practice patient-form family card
 * Keep in step with those files; the server rejects ids it does not know.
 */

export const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
  "Other",
] as const;

export const RELATIONSHIPS = [
  { value: "SPOUSE", label: "Spouse" },
  { value: "CHILD", label: "Child" },
  { value: "PARENT", label: "Parent" },
  { value: "OTHER", label: "Other" },
] as const;

export const PATIENT_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ta", label: "Tamil — தமிழ்" },
] as const;
export const DEFAULT_PATIENT_LANGUAGE = "en";

export const CONSENT_CHANNELS = [
  { id: "email", label: "Email" },
  { id: "sms", label: "SMS" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "push", label: "App" },
] as const;

export interface ConsentPurpose {
  id: string;
  label: string;
  description: string;
  /** Sent as part of care without a consent row — shown, not asked. */
  impliedByCare: boolean;
}

export const CONSENT_PURPOSES: readonly ConsentPurpose[] = [
  {
    id: "TRANSACTIONAL",
    label: "Appointment and treatment messages",
    description:
      "Booking confirmations, reminders, prescriptions, reports and receipts.",
    impliedByCare: true,
  },
  {
    id: "SERVICE_UPDATE",
    label: "Clinic service updates",
    description:
      "Changes to opening hours, doctor availability or clinic operations.",
    impliedByCare: false,
  },
  {
    id: "RECALL",
    label: "Check-up and recall reminders",
    description: "Reminders that a routine check-up, cleaning or review is due.",
    impliedByCare: false,
  },
  {
    id: "REACTIVATION",
    label: "We have not seen you in a while",
    description:
      "A message if you have not visited for a long time, or missed an appointment.",
    impliedByCare: false,
  },
  {
    id: "PROMOTIONAL",
    label: "Offers and health campaigns",
    description: "Camps, packages, seasonal offers and health awareness drives.",
    impliedByCare: false,
  },
];

/** `channel::purpose` → granted. Only boxes the desk actually ticked are sent. */
export type ConsentSelection = Record<string, boolean>;

export function consentKey(channel: string, purpose: string): string {
  return `${channel}::${purpose}`;
}

export function consentDecisions(
  selection: ConsentSelection
): { channel: string; purpose: string; granted: boolean }[] {
  return Object.entries(selection)
    .map(([key, granted]) => {
      const [channel, purpose] = key.split("::");
      return channel && purpose ? { channel, purpose, granted } : null;
    })
    .filter(
      (d): d is { channel: string; purpose: string; granted: boolean } =>
        d !== null
    );
}

/** Practice `isSufficientReason`: at least three words. */
export function isSufficientReason(reason: string): boolean {
  return reason.trim().split(/\s+/).filter(Boolean).length >= 3;
}
