import { useMemo, useState } from "react";
import { Switch, Text, View } from "react-native";

import { Button, DateField, TextField } from "@/ui";
import { Segmented } from "@/ui/Segmented";
import { ApiError, describeError } from "@/lib/api/errors";
import { useFacilityId } from "@/lib/auth/store";
import { useCreatePatient, useUpdatePatient } from "./hooks";
import type { Patient, PatientWriteInput } from "./types";
import {
  GENDER_OPTIONS,
  calcAge,
  dobToInput,
  mapGenderToApi,
  normalizeGender,
  parseDobInput,
} from "./utils";

interface Props {
  patient?: Patient; // present → edit mode
  onSaved: (patient: Patient) => void;
}

export function PatientForm({ patient, onSaved }: Props) {
  const facilityId = useFacilityId();
  const isEdit = !!patient;

  const [firstName, setFirstName] = useState(patient?.firstName ?? "");
  const [lastName, setLastName] = useState(patient?.lastName ?? "");
  const [gender, setGender] = useState<string>(normalizeGender(patient?.gender));
  const [dobInput, setDobInput] = useState(dobToInput(patient?.dob));
  const [mobile, setMobile] = useState(patient?.phone ?? "");
  const [email, setEmail] = useState(patient?.email ?? "");
  const [abhaNumber, setAbhaNumber] = useState(patient?.abhaNumber ?? "");
  const [address, setAddress] = useState(patient?.address ?? "");
  const [guardian, setGuardian] = useState(patient?.parentOrGuardianName ?? "");
  const [isWhatsApp, setIsWhatsApp] = useState(!!patient?.isWhatsAppNumber);
  const [consent, setConsent] = useState(isEdit); // edit implies prior consent

  const [banner, setBanner] = useState<string | null>(null);
  const [dobError, setDobError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const create = useCreatePatient();
  const update = useUpdatePatient();
  const saving = create.isPending || update.isPending;

  // ABHA-governed lock: name/DOB/gender are verified from ABHA and cannot be
  // edited here. Mirrors the Practice patient-form + server guards.
  const abhaLocked = useMemo(() => {
    if (patient?.abhaNumber) return true; // existing ABHA patient
    return !isEdit && !!abhaNumber.trim(); // entering ABHA on a new patient
  }, [patient?.abhaNumber, isEdit, abhaNumber]);

  const dobIso = useMemo(() => {
    if (!dobInput.trim()) return null;
    return parseDobInput(dobInput);
  }, [dobInput]);

  const age = calcAge(dobIso);
  const isMinor = age !== null && age < 18;

  const onSave = async () => {
    setBanner(null);
    setDobError(null);
    setFieldError(null);

    if (!facilityId) {
      setBanner("No facility selected.");
      return;
    }
    if (!firstName.trim()) {
      setFieldError("First name is required.");
      return;
    }
    if (dobInput.trim() && !dobIso) {
      setDobError("Enter the date of birth as YYYY-MM-DD.");
      return;
    }
    if (isMinor && !guardian.trim()) {
      setFieldError("A parent/guardian name is required for a minor.");
      return;
    }
    if (!isEdit && !consent) {
      setFieldError("Patient consent is required to register.");
      return;
    }

    const body: PatientWriteInput = {
      id: patient?.id,
      facilityId,
      firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
      gender: mapGenderToApi(gender),
      mobile: mobile.trim() || undefined,
      email: email.trim() || undefined,
      abhaNumber: abhaNumber.trim() || undefined,
      address: address.trim() || undefined,
      isWhatsAppNumber: isWhatsApp,
      parentOrGuardianName: guardian.trim() || undefined,
      consentGiven: true,
      ...(dobIso ? { dob: dobIso } : {}),
    };

    try {
      const result = isEdit
        ? await update.mutateAsync(body)
        : await create.mutateAsync(body);
      onSaved(result.patient);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === "ABHA_GOVERNED_FIELD") {
          setBanner(describeError(e));
          return;
        }
        if (e.code === "PATIENT_MANAGE_REQUIRED") {
          setDobError(describeError(e));
          return;
        }
      }
      setBanner(describeError(e));
    }
  };

  return (
    <View className="gap-5">
      {banner ? (
        <View className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Text className="text-sm text-amber-800">{banner}</Text>
        </View>
      ) : null}

      {abhaLocked ? (
        <View className="flex-row items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <Text className="text-sm text-brand-700">
            Name, date of birth and gender are verified from this patient&apos;s
            ABHA. To change them, update in ABHA and ask us to re-verify.
          </Text>
        </View>
      ) : null}

      <View className="flex-row gap-3">
        <TextField
          containerClassName="flex-1"
          label="First name *"
          value={firstName}
          onChangeText={setFirstName}
          editable={!abhaLocked}
          placeholder="First name"
        />
        <TextField
          containerClassName="flex-1"
          label="Last name"
          value={lastName}
          onChangeText={setLastName}
          editable={!abhaLocked}
          placeholder="Last name"
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
        <DateField
          label="Date of birth"
          value={dobInput}
          onChange={setDobInput}
          disabled={abhaLocked}
          maximumDate={new Date().toISOString().slice(0, 10)}
          placeholder="Select date of birth"
          error={dobError ?? undefined}
        />
        {age !== null ? (
          <Text className="text-xs text-neutral-500">Age: {age} years</Text>
        ) : null}
      </View>

      <View className="flex-row gap-3">
        <TextField
          containerClassName="flex-1"
          label="Mobile"
          value={mobile}
          onChangeText={setMobile}
          keyboardType="phone-pad"
          placeholder="10-digit mobile"
        />
        <TextField
          containerClassName="flex-1"
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="email (optional)"
        />
      </View>

      <View className="flex-row items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <Text className="text-sm text-neutral-700">This mobile is on WhatsApp</Text>
        <Switch
          value={isWhatsApp}
          onValueChange={setIsWhatsApp}
          trackColor={{ true: "#FD006A" }}
        />
      </View>

      {isMinor ? (
        <TextField
          label="Parent / guardian name *"
          value={guardian}
          onChangeText={setGuardian}
          placeholder="Required for minors"
        />
      ) : null}

      <TextField
        label="ABHA number"
        value={abhaNumber}
        onChangeText={setAbhaNumber}
        editable={!patient?.abhaNumber}
        placeholder="14-digit ABHA (optional)"
        keyboardType="number-pad"
      />

      <TextField
        label="Address"
        value={address}
        onChangeText={setAddress}
        placeholder="Address (optional)"
        multiline
      />

      {!isEdit ? (
        <View className="flex-row items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <Text className="flex-1 pr-3 text-sm text-neutral-700">
            Patient consents to registration and data processing.
          </Text>
          <Switch
            value={consent}
            onValueChange={setConsent}
            trackColor={{ true: "#FD006A" }}
          />
        </View>
      ) : null}

      {fieldError ? (
        <Text className="text-sm text-red-500">{fieldError}</Text>
      ) : null}

      <Button
        label={isEdit ? "Save changes" : "Register patient"}
        onPress={onSave}
        loading={saving}
      />
    </View>
  );
}
