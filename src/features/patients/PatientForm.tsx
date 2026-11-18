import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";

import { Button, DateField, TextField } from "@/ui";
import { AppAlert } from "@/ui/AppAlert";
import { AppModal } from "@/ui/AppModal";
import { Segmented } from "@/ui/Segmented";
import { ApiError, describeError } from "@/lib/api/errors";
import { recordPatientConsent } from "@/lib/api/endpoints/patients";
import { isFacilityAdminUser, isSuperAdminUser } from "@/lib/auth/roles";
import { useAuthUser, useFacilityId } from "@/lib/auth/store";
import { useHasPermission, useCanWrite } from "@/features/permissions";
import { PhoneOtpVerify } from "@/features/walk-in/components/PhoneOtpVerify";
import { DuplicatePatientPanel } from "./DuplicatePatientPanel";
import {
  BLOOD_GROUPS,
  DEFAULT_PATIENT_LANGUAGE,
  RELATIONSHIPS,
  type ConsentSelection,
  consentDecisions,
  isSufficientReason,
} from "./form/catalog";
import { ContactPreferencesCard } from "./form/ContactPreferencesCard";
import { ChipSelect, FormCard, SelectField } from "./form/kit";
import { OnboardExistingRow } from "./form/OnboardExistingRow";
import { useCreatePatient, useSameMobilePatients, useUpdatePatient } from "./hooks";
import type {
  DuplicatePatientCandidate,
  Patient,
  PatientWriteInput,
} from "./types";
import {
  GENDER_OPTIONS,
  calcAge,
  dobToInput,
  mapGenderToApi,
  normalizeGender,
  parseDobInput,
} from "./utils";
import type { SameMobileMatch } from "@/lib/api/endpoints/patients";

interface Props {
  patient?: Patient; // present → edit mode
  onSaved: (patient: Patient) => void;
  /** Open an existing record (duplicate check, same-mobile card, onboarding). */
  onOpenExisting?: (id: string) => void;
  onCancel?: () => void;
}

const KNOWN_BLOOD = new Set<string>(BLOOD_GROUPS.filter((b) => b !== "Other"));

/** Practice's pick for the adult who owns a shared number. */
function pickPrimary(list: SameMobileMatch[]): SameMobileMatch | null {
  return (
    list.find((p) => p.isPhoneVerified === true) ||
    list.find((p) => !!p.abhaNumber) ||
    list[0] ||
    null
  );
}

function personName(p: { firstName?: string | null; lastName?: string | null }) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
}

/**
 * Mobile input → digits only, never more than 10.
 * A pasted "+91 98765 43210" or "098765 43210" drops the prefix and keeps the
 * number; anything else past 10 digits is cut off (typing an 11th does nothing).
 * No `maxLength` on the input: it would truncate a pasted "+91…" before this
 * runs and leave 9 digits.
 */
function toMobile10(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits.slice(0, 10);
}

function yearsAgoYmd(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

/**
 * Patient registration / edit — the Practice web patient form on a tablet.
 * Sections: Personal details · Mobile & family · Address · Contact
 * preferences (create) · Reason for change (edit) · Consent → Save.
 * Two columns on a tablet, one on a phone.
 */
export function PatientForm({ patient, onSaved, onOpenExisting, onCancel }: Props) {
  const facilityId = useFacilityId();
  const user = useAuthUser();
  const qc = useQueryClient();
  const isEdit = !!patient;
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const elevated = isSuperAdminUser(user) || isFacilityAdminUser(user);
  const canManagePatient = useHasPermission("patient.manage") || elevated;
  // Contact consent is recorded by `POST /api/patient/consent`, which needs
  // `patient.write`; a role that only creates patients would always be refused.
  const canRecordConsent = useCanWrite("patient") || elevated;

  // ── Personal details ────────────────────────────────────────────────────
  const initialBlood = patient?.bloodGroup ?? "";
  const [firstName, setFirstName] = useState(patient?.firstName ?? "");
  const [lastName, setLastName] = useState(patient?.lastName ?? "");
  const [gender, setGender] = useState<string>(normalizeGender(patient?.gender));
  const [bloodGroup, setBloodGroup] = useState<string>(
    !initialBlood ? "" : KNOWN_BLOOD.has(initialBlood) ? initialBlood : "Other"
  );
  const [bloodOther, setBloodOther] = useState(
    initialBlood && !KNOWN_BLOOD.has(initialBlood) ? initialBlood : ""
  );
  const [dobInput, setDobInput] = useState(dobToInput(patient?.dob));
  const [isDobEstimated, setIsDobEstimated] = useState(!!patient?.isDobEstimated);
  const [ageInput, setAgeInput] = useState("");
  const [email, setEmail] = useState(patient?.email ?? "");
  const [abhaNumber, setAbhaNumber] = useState(patient?.abhaNumber ?? "");
  const [guardian, setGuardian] = useState(patient?.parentOrGuardianName ?? "");
  /** True once the desk edits the guardian; stops the same-mobile suggestion. */
  const [guardianTouched, setGuardianTouched] = useState(
    !!patient?.parentOrGuardianName
  );

  // ── Mobile & family ─────────────────────────────────────────────────────
  const [mobile, setMobile] = useState(toMobile10(patient?.phone ?? ""));
  const [isWhatsApp, setIsWhatsApp] = useState(!!patient?.isWhatsAppNumber);
  const [relationship, setRelationship] = useState<string>(
    patient?.relationshipToPrimary ?? ""
  );
  const [verifiedPhone, setVerifiedPhone] = useState<{
    mobile10: string;
    token: string;
  } | null>(null);

  // ── Address / preferences / consent ─────────────────────────────────────
  const [address, setAddress] = useState(patient?.address ?? "");
  const [language, setLanguage] = useState(DEFAULT_PATIENT_LANGUAGE);
  const [contactConsent, setContactConsent] = useState<ConsentSelection>({});
  const [changeReason, setChangeReason] = useState("");
  const [consent, setConsent] = useState(isEdit); // edit implies prior consent

  const [banner, setBanner] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [duplicate, setDuplicate] = useState<{
    message: string;
    duplicates: DuplicatePatientCandidate[];
  } | null>(null);

  const create = useCreatePatient();
  const update = useUpdatePatient();
  /** What the save is doing right now; non-null shows the blocking overlay. */
  const [savingStep, setSavingStep] = useState<string | null>(null);
  const busyRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const saving =
    savingStep !== null || create.isPending || update.isPending;

  // ── Derived ─────────────────────────────────────────────────────────────
  const abhaLocked = useMemo(() => {
    if (patient?.abhaNumber) return true;
    return !isEdit && !!abhaNumber.trim();
  }, [patient?.abhaNumber, isEdit, abhaNumber]);
  const nameLocked = abhaLocked || patient?.identityLock?.locked === true;
  // Practice: changing a DOB already on file needs the Patient Manager role.
  const dobLocked = abhaLocked || (isEdit && !!patient?.dob && !canManagePatient);

  const dobIso = useMemo(
    () => (dobInput.trim() ? parseDobInput(dobInput) : null),
    [dobInput]
  );
  const age = calcAge(dobIso);
  const isMinor = age !== null && age < 18;

  const mobileDigits = mobile.replace(/\D/g, "");
  const mobile10 = mobileDigits.slice(-10);
  const mobileComplete = mobileDigits.length === 10;

  const sameMobile = useSameMobilePatients(mobile10, !isEdit && mobileComplete);
  const localMatches = useMemo(
    () => (sameMobile.data?.local ?? []).filter((p) => p.id !== patient?.id),
    [sameMobile.data, patient?.id]
  );
  const externalMatches = sameMobile.data?.external ?? [];
  /** Another patient THIS facility knows uses the number → family member. */
  const hasLocalSameMobile = !isEdit && mobileComplete && localMatches.length > 0;
  const primary = hasLocalSameMobile ? pickPrimary(localMatches) : null;
  const primaryId = primary ? (primary.primaryPatientId ?? primary.id) : null;
  const isEditDependent =
    isEdit && (!!patient?.primaryPatientId || !!patient?.relationshipToPrimary);

  const mobileVerified = mobileComplete && verifiedPhone?.mobile10 === mobile10;
  // OTP is skipped when the number is already this facility's (Practice rule).
  const showOtp = !isEdit && mobileComplete && !hasLocalSameMobile && !sameMobile.isLoading;

  // Fill the guardian from the adult on this number — and say so — until the
  // desk types their own. Derived, not copied into state by an effect.
  const suggestedGuardian = isMinor && primary ? personName(primary) : "";
  const guardianAutoFilled = !guardianTouched && !!suggestedGuardian;
  const guardianValue = guardianAutoFilled ? suggestedGuardian : guardian;

  // Edit: did an identity-bearing field move? Practice then needs a reason.
  const identityChanged =
    isEdit &&
    (firstName.trim() !== (patient?.firstName ?? "").trim() ||
      lastName.trim() !== (patient?.lastName ?? "").trim() ||
      (dobIso?.slice(0, 10) ?? "") !== dobToInput(patient?.dob) ||
      mobileDigits !== toMobile10(patient?.phone ?? ""));
  const reasonMissing = identityChanged && !isSufficientReason(changeReason);

  const setError = (key: string, msg?: string) =>
    setErrors((prev) => ({ ...prev, [key]: msg }));

  // ── Save ────────────────────────────────────────────────────────────────
  const onSave = async (opts?: { confirmedNotDuplicate?: boolean }) => {
    // A second tap while the first save is in flight would create twice.
    if (busyRef.current) return;
    setBanner(null);
    setDuplicate(null);
    const next: Record<string, string | undefined> = {};

    if (!facilityId) {
      setBanner("No facility selected.");
      return;
    }
    if (!firstName.trim()) next.firstName = "First name is required.";
    if (!isEdit && !mobileComplete) next.mobile = "Enter a 10-digit mobile number.";
    if (isEdit && mobileDigits && !mobileComplete)
      next.mobile = "Enter a 10-digit mobile number.";
    if (dobInput.trim() && !dobIso) next.dob = "Enter a valid date of birth.";
    else if (!isEdit && !dobIso) next.dob = "Enter the date of birth or the age.";
    if (isMinor && !guardianValue.trim())
      next.guardian = "A parent/guardian name is required for a minor.";
    if (bloodGroup === "Other" && !bloodOther.trim())
      next.bloodGroup = "Specify the blood group.";
    if (hasLocalSameMobile && !relationship)
      next.relationship = "Choose how this patient relates to the primary contact.";
    if (reasonMissing)
      next.changeReason = "Give a reason in a few words — what was wrong and how you know.";
    if (!isEdit && !consent) next.consent = "Patient consent is required to register.";

    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      setBanner("Check the highlighted fields.");
      // The buttons are pinned at the bottom; bring the banner into view.
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    const sendFamily = hasLocalSameMobile || isEditDependent;
    const body: PatientWriteInput = {
      id: patient?.id,
      facilityId,
      firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
      gender: mapGenderToApi(gender),
      mobile: mobile10 || undefined,
      email: email.trim() || undefined,
      abhaNumber: abhaNumber.trim() || undefined,
      address: address.trim() || undefined,
      isWhatsAppNumber: isWhatsApp,
      bloodGroup:
        bloodGroup === "Other" ? bloodOther.trim() || null : bloodGroup || null,
      isDobEstimated,
      parentOrGuardianName: isMinor ? guardianValue.trim() || undefined : undefined,
      consentGiven: true,
      // YYYY-MM-DD only: Practice's `formatDate` misreads a full ISO string.
      ...(dobIso ? { dob: dobIso.slice(0, 10) } : {}),
      ...(sendFamily
        ? {
            primaryPatientId: hasLocalSameMobile
              ? primaryId
              : patient?.primaryPatientId ?? null,
            relationshipToPrimary: relationship || null,
          }
        : {}),
      // Create only — a shared, already-known number is not re-verified.
      ...(!isEdit
        ? { isPhoneVerified: hasLocalSameMobile ? false : mobileVerified }
        : {}),
      ...(isEdit && identityChanged ? { changeReason: changeReason.trim() } : {}),
      ...(!isEdit && opts?.confirmedNotDuplicate
        ? { confirmedNotDuplicate: true }
        : {}),
    };

    // Covers the WHOLE save — create, contact preferences, then opening the
    // record — not just the first request, so the screen never looks idle.
    busyRef.current = true;
    setSavingStep(isEdit ? "Updating patient…" : "Saving patient…");

    let saved: Patient;
    try {
      const result = isEdit
        ? await update.mutateAsync(body)
        : await create.mutateAsync(body);
      saved = result.patient;
    } catch (e) {
      busyRef.current = false;
      setSavingStep(null);
      if (e instanceof ApiError) {
        if (!isEdit && e.status === 409 && e.serverCode === "PATIENT_DUPLICATE") {
          const data = (e.data ?? {}) as { duplicates?: unknown };
          setDuplicate({
            message: e.message || "This patient may already be registered.",
            duplicates: Array.isArray(data.duplicates)
              ? (data.duplicates as DuplicatePatientCandidate[])
              : [],
          });
          return;
        }
        if (e.serverCode === "CHANGE_REASON_REQUIRED") {
          setError("changeReason", describeError(e));
          return;
        }
        if (e.code === "FORBIDDEN" && !isEdit) {
          setBanner(
            "Your role can't register patients at this facility. Ask a facility administrator to turn on Patients → Create for your role."
          );
          scrollRef.current?.scrollTo({ y: 0, animated: true });
          return;
        }
        if (e.code === "PATIENT_MANAGE_REQUIRED") {
          setError("dob", describeError(e));
          return;
        }
      }
      setBanner(describeError(e));
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    // Contact preferences are recorded AFTER the patient exists, and never
    // fail the registration — a patient on file with no marketing consent is
    // a safe state; one who could not be registered is a person at the desk.
    const decisions = consentDecisions(contactConsent);
    const languageToRecord =
      language !== DEFAULT_PATIENT_LANGUAGE ? language : undefined;
    if (!isEdit && saved?.id && (decisions.length > 0 || languageToRecord)) {
      setSavingStep("Saving contact preferences…");
      let consentFailed = false;
      try {
        await recordPatientConsent({
          patientId: saved.id,
          facilityId,
          decisions,
          ...(languageToRecord ? { preferredLanguage: languageToRecord } : {}),
        });
      } catch (e) {
        // Drop the overlay first so the alert is not hidden behind it.
        consentFailed = true;
        setSavingStep(null);
        const refused =
          !canRecordConsent ||
          (e instanceof ApiError && e.code === "FORBIDDEN");
        AppAlert.alert(
          "Patient saved",
          refused
            ? "Contact preferences were not recorded — your role can't edit patients. Ask a facility administrator to turn on Patients → Edit for your role, or record them from the patient's page later."
            : `Contact preferences were not recorded: ${describeError(e)}`
        );
      }
      if (consentFailed) {
        qc.invalidateQueries({ queryKey: ["patients-by-phone"] });
        onSaved(saved);
        return;
      }
    }
    qc.invalidateQueries({ queryKey: ["patients-by-phone"] });
    // Edit: left on until router.back unmounts the form. Create: dropped,
    // because the caller opens the questionnaire next (Practice flow) and the
    // overlay would sit on top of it. `busyRef` stays set either way, so the
    // patient cannot be saved a second time from this form.
    setSavingStep(isEdit ? "Saved" : null);
    onSaved(saved);
  };

  // ── Sections ────────────────────────────────────────────────────────────
  const personal = (
    <FormCard title="Personal details" icon="person-outline">
      {nameLocked && !abhaLocked ? (
        <Notice
          icon="lock-closed-outline"
          text={
            patient?.identityLock?.detail
              ? `Name is locked — ${patient.identityLock.detail}`
              : "Name is locked — the correction window has closed."
          }
        />
      ) : null}
      {abhaLocked ? (
        <Notice
          icon="shield-checkmark-outline"
          text="Name, date of birth and gender are verified from this patient's ABHA. To change them, update ABHA and re-verify."
        />
      ) : null}

      <View className="flex-row gap-3">
        <TextField
          containerClassName="flex-1"
          label="First name"
          required
          value={firstName}
          onChangeText={setFirstName}
          editable={!nameLocked}
          placeholder="First name"
          autoCapitalize="words"
          error={errors.firstName}
        />
        <TextField
          containerClassName="flex-1"
          label="Last name"
          value={lastName}
          onChangeText={setLastName}
          editable={!nameLocked}
          placeholder="Last name"
          autoCapitalize="words"
        />
      </View>

      <View className="gap-1.5">
        <Text className="text-sm font-medium text-neutral-700">Gender</Text>
        <Segmented
          options={GENDER_OPTIONS}
          value={gender as never}
          onChange={(v) => setGender(v)}
          disabled={abhaLocked}
        />
      </View>

      <View className="gap-1.5">
        <View className="flex-row items-end gap-3">
          <View className="flex-1">
            <DateField
              label="Date of birth"
              required={!isEdit}
              value={dobInput}
              onChange={(v) => {
                setDobInput(v);
                setIsDobEstimated(false);
                setAgeInput("");
                setError("dob", undefined);
              }}
              disabled={dobLocked}
              maximumDate={new Date().toISOString().slice(0, 10)}
              placeholder="Select date of birth"
              error={errors.dob}
            />
          </View>
          {!dobLocked ? (
            <>
              <Text className="pb-3.5 text-sm text-neutral-500">or</Text>
              <TextField
                containerClassName="w-28"
                label="Age"
                value={ageInput}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="Years"
                onChangeText={(raw) => {
                  const v = raw.replace(/\D/g, "");
                  if (v !== "" && (Number(v) < 1 || Number(v) > 150)) return;
                  setAgeInput(v);
                  setError("dob", undefined);
                  if (!v) {
                    setDobInput("");
                    setIsDobEstimated(false);
                  } else {
                    setDobInput(yearsAgoYmd(Number(v)));
                    setIsDobEstimated(true);
                  }
                }}
              />
            </>
          ) : null}
        </View>
        {age !== null ? (
          <Text className="text-xs text-neutral-500">
            Age: {age} years{isDobEstimated ? " (estimated from age)" : ""}
          </Text>
        ) : null}
        {dobLocked && !abhaLocked ? (
          <Text className="text-xs text-neutral-500">
            Only a user with the Patient Manager role can change the date of birth.
          </Text>
        ) : null}
      </View>

      {isMinor ? (
        <View className="gap-1">
          <TextField
            label="Parent / guardian name"
            required
            value={guardianValue}
            onChangeText={(v) => {
              setGuardian(v);
              setGuardianTouched(true);
            }}
            placeholder="Full name of parent or legal guardian"
            autoCapitalize="words"
            error={errors.guardian}
          />
          {guardianAutoFilled ? (
            <Text className="text-xs text-neutral-500">
              Filled from the contact already registered on this mobile. Change it
              if someone else is the guardian.
            </Text>
          ) : null}
        </View>
      ) : null}

      <View className="gap-2">
        <SelectField
          label="Blood group"
          placeholder="Select blood group (optional)"
          options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))}
          value={bloodGroup}
          onChange={(v) => {
            setBloodGroup(v);
            if (v !== "Other") setBloodOther("");
            setError("bloodGroup", undefined);
          }}
          allowClear
        />
        {bloodGroup === "Other" ? (
          <TextField
            value={bloodOther}
            onChangeText={setBloodOther}
            placeholder="Specify blood group"
            error={errors.bloodGroup}
          />
        ) : null}
      </View>

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="Email (optional)"
      />
      <TextField
        label="ABHA number"
        value={abhaNumber}
        onChangeText={setAbhaNumber}
        editable={!patient?.abhaNumber}
        placeholder="14-digit ABHA (optional)"
        keyboardType="number-pad"
      />
    </FormCard>
  );

  const mobileCard = (
    <FormCard title="Mobile & family" icon="call-outline">
      <TextField
        label="Mobile"
        required={!isEdit}
        value={mobile}
        onChangeText={(v) => {
          setMobile(toMobile10(v));
          setError("mobile", undefined);
        }}
        keyboardType="number-pad"
        placeholder="10-digit mobile"
        error={errors.mobile}
      />

      {!isEdit && mobileComplete && sameMobile.isLoading ? (
        <Text className="text-xs text-neutral-500">
          Checking if this number is already registered…
        </Text>
      ) : null}
      {sameMobile.isError ? (
        <Text className="text-xs text-amber-700">
          Couldn&apos;t check who else uses this number. You can still register.
        </Text>
      ) : null}

      {showOtp ? (
        <PhoneOtpVerify
          key={mobile10}
          mobile10={mobile10}
          required={false}
          phoneToken={mobileVerified ? verifiedPhone!.token : null}
          onVerified={(token) => setVerifiedPhone({ mobile10, token })}
        />
      ) : null}

      {hasLocalSameMobile && primary ? (
        <View className="gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
          <View className="flex-row items-center gap-2">
            <Ionicons name="people-outline" size={16} color="#FD006A" />
            <Text className="text-sm font-semibold text-brand-700">
              Family / primary contact
            </Text>
          </View>
          <Text className="text-xs text-neutral-600">
            This number is already registered here. The new patient is added as a
            family member of the primary contact.
          </Text>
          <View className="gap-0.5">
            <Text className="text-xs text-neutral-500">Primary contact</Text>
            <Text className="text-sm font-semibold text-neutral-900">
              {personName(primary) || "—"}
              {primary.phone ? ` · ${primary.phone}` : ""}
            </Text>
          </View>
          <ChipSelect
            label="Relationship to primary"
            options={RELATIONSHIPS}
            value={relationship}
            onChange={(v) => {
              setRelationship(v);
              setError("relationship", undefined);
            }}
          />
          {errors.relationship ? (
            <Text className="text-xs text-red-500">{errors.relationship}</Text>
          ) : null}
          {localMatches.length > 0 ? (
            <View className="gap-2">
              <Text className="text-xs font-medium text-neutral-500">
                Already on this number — open instead if it&apos;s the same person
              </Text>
              {localMatches.slice(0, 5).map((m) => (
                <OnboardExistingRow
                  key={m.id}
                  facilityId={facilityId ?? ""}
                  onOpen={(id) => onOpenExisting?.(id)}
                  record={{
                    id: m.id,
                    patientId: m.patientId,
                    firstName: m.firstName,
                    lastName: m.lastName,
                    phone: m.phone,
                    isLinkedToFacility: true,
                    meta: [
                      m.patientId != null ? `ID ${m.patientId}` : null,
                      m.dob ? `DOB ${dobToInput(m.dob)}` : null,
                      m.relationshipToPrimary?.toLowerCase(),
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  }}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {isEditDependent ? (
        <View className="gap-2 rounded-xl border border-brand-200 bg-brand-50 p-4">
          <Text className="text-sm font-semibold text-brand-700">
            Family / primary contact
          </Text>
          <ChipSelect
            label="Relationship to primary"
            options={RELATIONSHIPS}
            value={relationship}
            onChange={setRelationship}
          />
        </View>
      ) : null}

      {!isEdit && mobileComplete && externalMatches.length > 0 ? (
        <View className="gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <Text className="text-sm font-semibold text-amber-900">
            {externalMatches.every((m) => m.previouslyAtFacility)
              ? "Previously registered here"
              : "Registered at other Welbuk facilities"}
          </Text>
          <Text className="text-xs text-amber-800">
            If this is the same person, add that record here instead of creating a
            second one. The patient confirms with an OTP.
          </Text>
          {externalMatches.slice(0, 5).map((m) => (
            <OnboardExistingRow
              key={m.id}
              facilityId={facilityId ?? ""}
              fallbackMobile={mobile10}
              onOpen={(id) => onOpenExisting?.(id)}
              record={{
                id: m.id,
                patientId: m.patientId,
                firstName: m.firstName,
                lastName: m.lastName,
                phone: m.phone,
                isLinkedToFacility: false,
                previouslyAtFacility: m.previouslyAtFacility,
                meta: [
                  m.patientId != null ? `ID ${m.patientId}` : null,
                  m.previouslyAtFacility
                    ? m.previousMrdNumber
                      ? `removed from here · MRD ${m.previousMrdNumber}`
                      : "removed from here"
                    : m.phone,
                ]
                  .filter(Boolean)
                  .join(" · "),
              }}
            />
          ))}
        </View>
      ) : null}

      <View className="flex-row items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <Text className="text-sm text-neutral-700">This mobile is on WhatsApp</Text>
        <Switch
          value={isWhatsApp}
          onValueChange={setIsWhatsApp}
          trackColor={{ true: "#FD006A" }}
        />
      </View>
    </FormCard>
  );

  const addressCard = (
    <FormCard
      title="Address"
      icon="home-outline"
      // On a tablet it is the last card on the right: grow to the left
      // column's height so the right side has no empty gap.
      className={wide ? "flex-1" : ""}
      description={
        abhaNumber.trim()
          ? "Address is not available from ABHA — enter it here."
          : undefined
      }
    >
      <TextField
        value={address}
        onChangeText={setAddress}
        placeholder="Full address including street, city, state, pincode"
        multiline
        numberOfLines={3}
        fill={wide}
      />
    </FormCard>
  );

  // Shown to every role on create, as on Practice web. Recording it needs
  // `patient.write`; a role without it gets a clear message after the patient
  // is saved (registration itself is never blocked by this).
  const preferencesCard = !isEdit ? (
    <ContactPreferencesCard
      language={language}
      onLanguageChange={setLanguage}
      selection={contactConsent}
      onSelectionChange={setContactConsent}
      disabled={saving}
    />
  ) : null;

  const reasonCard = identityChanged ? (
    <FormCard
      title="Reason for this change"
      icon="create-outline"
      description="Name, date of birth or mobile changed. Say what was wrong and how you know — it goes on the audit record."
    >
      <TextField
        value={changeReason}
        onChangeText={(v) => {
          setChangeReason(v);
          setError("changeReason", undefined);
        }}
        placeholder="e.g. spelling corrected from Aadhaar card"
        multiline
        error={errors.changeReason}
      />
    </FormCard>
  ) : null;

  return (
    // The form owns the whole screen: cards scroll, the action bar is pinned
    // to the bottom. A short form on a tall tablet therefore never leaves an
    // empty band under the buttons — the spare room stays above the bar.
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1"
    >
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: wide ? 24 : 16 }}
    >
    <View className="gap-5">
      {banner ? (
        <View className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Text className="text-sm text-amber-800">{banner}</Text>
        </View>
      ) : null}

      {wide ? (
        <View className="flex-row items-stretch gap-5">
          {/* Personal details is the tallest card, so Address sits on the
              right under Mobile — the two columns end at about the same height. */}
          <View className="flex-1 gap-5">{personal}</View>
          <View className="flex-1 gap-5">
            {mobileCard}
            {reasonCard}
            {addressCard}
          </View>
        </View>
      ) : (
        <>
          {personal}
          {mobileCard}
          {addressCard}
          {reasonCard}
        </>
      )}

      {preferencesCard}

      {!isEdit ? (
        <View
          className={`flex-row items-center justify-between rounded-2xl border bg-white px-4 py-3 ${
            errors.consent ? "border-red-400" : "border-neutral-200"
          }`}
        >
          <Text className="flex-1 pr-3 text-sm text-neutral-700">
            I confirm that the patient has provided consent to store and use their
            information for medical purposes.
          </Text>
          <Switch
            value={consent}
            onValueChange={(v) => {
              setConsent(v);
              if (v) setError("consent", undefined);
            }}
            trackColor={{ true: "#FD006A" }}
          />
        </View>
      ) : null}
      {errors.consent ? (
        <Text className="text-sm text-red-500">{errors.consent}</Text>
      ) : null}

      {duplicate && facilityId ? (
        <DuplicatePatientPanel
          message={duplicate.message}
          duplicates={duplicate.duplicates}
          facilityId={facilityId}
          formMobile={mobile10}
          onOpen={(id) => onOpenExisting?.(id)}
          onRegisterAnyway={() => onSave({ confirmedNotDuplicate: true })}
          registering={saving}
        />
      ) : null}
    </View>
    </ScrollView>

      {duplicate && facilityId ? null : (
        // Pinned action bar: Cancel then the primary action, right-aligned on
        // a tablet and sharing the row on a phone; clears the home indicator.
        <View
          className={`flex-row items-center gap-3 border-t border-neutral-200 bg-white px-4 pt-3 ${
            wide ? "justify-end px-6" : ""
          }`}
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          {onCancel ? (
            <View className={wide ? "w-40" : "flex-1"}>
              <Button
                label="Cancel"
                variant="outline"
                onPress={onCancel}
                disabled={saving}
              />
            </View>
          ) : null}
          <View className={wide ? "w-64" : "flex-1"}>
            <Button
              label={isEdit ? "Update patient" : "Save patient"}
              icon={
                <Ionicons
                  name={isEdit ? "checkmark-circle-outline" : "person-add-outline"}
                  size={18}
                  color="#FFFFFF"
                />
              }
              onPress={() => onSave()}
              loading={saving}
            />
          </View>
        </View>
      )}
    {/* Outside the gap-5 stack: a Modal still counts as a child there and
        added an empty gap under the buttons. */}
    <SavingOverlay step={savingStep} />
    </KeyboardAvoidingView>
  );
}

/**
 * Blocks the form while a save is in flight and says which step it is on.
 * The Save button sits at the bottom of a long scroll, so its own spinner is
 * often off screen — this is what the desk actually sees.
 */
function SavingOverlay({ step }: { step: string | null }) {
  return (
    <AppModal
      visible={step !== null}
      transparent
      animationType="fade"
      androidSafeArea={false}
      onRequestClose={() => {}}
    >
      <View className="flex-1 items-center justify-center bg-black/30 px-6">
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={step ?? "Saving"}
          className="items-center justify-center rounded-2xl bg-white p-6"
        >
          <ActivityIndicator size="large" color="#FD006A" />
        </View>
      </View>
    </AppModal>
  );
}

function Notice({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View className="flex-row items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
      <Ionicons name={icon} size={16} color="#FD006A" />
      <Text className="flex-1 text-sm text-brand-700">{text}</Text>
    </View>
  );
}
