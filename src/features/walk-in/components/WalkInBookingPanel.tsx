import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Button, TextField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import type { OnboardLookupPatient } from "@/lib/api/endpoints/walk-in";
import { useFacilityId } from "@/lib/auth/store";
import { formatSeriesToken } from "@/features/appointments/lib/tokenSeries";
import {
  ensureWalkInPatient,
  useBookWalkIn,
  useFacilityDoctors,
  usePhoneLookup,
} from "../hooks";
import {
  ageFromDob,
  defaultSelection,
  isValidIndianMobile,
  kindForMatches,
  kindForSelection,
  lookupPatientName,
  normalizeMobile10,
  type WalkInPatientKind,
  type WalkInSelection,
} from "../lib";
import { PhoneOtpVerify } from "./PhoneOtpVerify";

const KIND_STYLE: Record<
  WalkInPatientKind,
  { box: string; text: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  facility: {
    box: "border-emerald-200 bg-emerald-50",
    text: "text-emerald-800",
    icon: "checkmark-circle",
    color: "#059669",
  },
  network: {
    box: "border-sky-200 bg-sky-50",
    text: "text-sky-800",
    icon: "globe-outline",
    color: "#0284c7",
  },
  new: {
    box: "border-neutral-200 bg-neutral-50",
    text: "text-neutral-800",
    icon: "person-add-outline",
    color: "#525252",
  },
};

interface Props {
  /** Called after a successful booking. */
  onBooked?: () => void;
  /** Hide the title block when the host screen's top bar already shows it. */
  showTitle?: boolean;
}

/**
 * Receptionist walk-in: mobile → lookup (facility / Welbuk network / new) →
 * OTP where needed → create or link patient → Walk-in appointment.
 */
export function WalkInBookingPanel({ onBooked, showTitle = true }: Props) {
  const { t } = useTranslation();
  const facilityId = useFacilityId();

  const [mobileRaw, setMobileRaw] = useState("");
  /** Picks and OTP proofs are tied to the number they were made for. */
  const [picked, setPicked] = useState<{ mobile10: string; id: WalkInSelection } | null>(
    null
  );
  const [verifiedPhone, setVerifiedPhone] = useState<{
    mobile10: string;
    token: string;
  } | null>(null);
  const [fullName, setFullName] = useState("");
  const [pickedDoctorId, setPickedDoctorId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  /** Patient already created/linked in an attempt whose booking step failed. */
  const [ensured, setEnsured] = useState<{ key: string; patientId: string } | null>(
    null
  );

  const mobile10 = normalizeMobile10(mobileRaw);
  const mobileValid = isValidIndianMobile(mobile10);
  const lookup = usePhoneLookup(mobile10);
  const matches = useMemo(() => lookup.data ?? [], [lookup.data]);
  const doctorsQ = useFacilityDoctors();
  const doctors = useMemo(() => doctorsQ.data ?? [], [doctorsQ.data]);
  const book = useBookWalkIn();

  // A new number starts over: the desk's pick and OTP proof only apply to the
  // number they were made for; until the desk picks, use the lookup default.
  const selection: WalkInSelection =
    picked?.mobile10 === mobile10
      ? picked.id
      : lookup.isSuccess
        ? defaultSelection(matches)
        : null;
  const setSelection = (id: WalkInSelection) => {
    setPicked({ mobile10, id });
    setEnsured(null);
  };
  const phoneToken =
    verifiedPhone?.mobile10 === mobile10 ? verifiedPhone.token : null;

  // Single doctor or the facility default is pre-selected.
  const autoDoctor =
    doctors.length === 1 ? doctors[0] : doctors.find((d) => d.isDefault);
  const doctorId = pickedDoctorId ?? autoDoctor?.id ?? null;

  const kind = kindForSelection(selection, matches);
  const selectedMatch =
    selection && selection !== "new"
      ? matches.find((m) => m.id === selection) ?? null
      : null;
  const selectedDoctor = doctors.find((d) => d.id === doctorId) ?? null;

  const errors = {
    mobile: !mobileValid ? t("walkIn.mobileInvalid") : null,
    patient: mobileValid && !kind ? t("walkIn.choosePatientRequired") : null,
    name: kind === "new" && fullName.trim().length < 2 ? t("walkIn.nameRequired") : null,
    otp: kind === "network" && !phoneToken ? t("walkIn.otpRequired") : null,
    doctor: !doctorId ? t("walkIn.doctorRequired") : null,
    reason: reason.trim().length < 2 ? t("walkIn.reasonRequired") : null,
    consent: !consent ? t("walkIn.consentRequired") : null,
  };
  const firstError = Object.values(errors).find(Boolean) ?? null;
  const show = (key: keyof typeof errors) => (submitted ? errors[key] ?? undefined : undefined);

  const reset = () => {
    setMobileRaw("");
    setPicked(null);
    setFullName("");
    setVerifiedPhone(null);
    setReason("");
    setConsent(false);
    setSubmitted(false);
    setFormError(null);
    setEnsured(null);
  };

  const onSubmit = async () => {
    setSubmitted(true);
    setFormError(null);
    if (busy) return;
    if (firstError || !facilityId || !kind || !doctorId) {
      setFormError(firstError ?? t("walkIn.choosePatientRequired"));
      return;
    }

    const patientName =
      kind === "new" ? fullName.trim() : selectedMatch ? lookupPatientName(selectedMatch) : "";
    const ensureKey = `${mobile10}|${selection}|${fullName.trim()}`;

    setBusy(true);
    try {
      let patientId = ensured?.key === ensureKey ? ensured.patientId : null;
      if (!patientId) {
        patientId = await ensureWalkInPatient(facilityId, {
          kind,
          mobile10,
          patientId: selectedMatch?.id,
          fullName,
          phoneToken,
        });
        setEnsured({ key: ensureKey, patientId });
      }

      const appointment = await book({
        patientId,
        doctorId,
        slotDurationMinutes: selectedDoctor?.slotDurationMinutes,
        reason: reason.trim(),
      });

      const token = formatSeriesToken(appointment?.tokenNumber, appointment?.tokenSeries);
      Alert.alert(
        t("walkIn.bookedTitle"),
        token
          ? t("walkIn.bookedMessage", { name: patientName, token })
          : t("walkIn.bookedMessageNoToken", { name: patientName })
      );
      reset();
      onBooked?.();
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const summaryKind = lookup.isSuccess ? kind ?? kindForMatches(matches) : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1"
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 40,
          gap: 16,
        }}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            {showTitle ? (
              <>
                <Text className="text-lg font-semibold text-neutral-900">
                  {t("walkIn.title")}
                </Text>
                <Text className="mt-0.5 text-sm text-neutral-500">
                  {t("walkIn.subtitle")}
                </Text>
              </>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={reset}
            className="rounded-lg px-2 py-1 active:bg-neutral-100"
          >
            <Text className="text-sm font-medium text-neutral-500">{t("walkIn.reset")}</Text>
          </Pressable>
        </View>

        <TextField
          label={t("walkIn.mobile")}
          value={mobileRaw}
          onChangeText={(v) => setMobileRaw(v.replace(/[^\d+\s-]/g, ""))}
          keyboardType="phone-pad"
          maxLength={14}
          placeholder={t("walkIn.mobilePlaceholder")}
          error={show("mobile")}
          rightAccessory={
            lookup.isFetching ? (
              <ActivityIndicator size="small" color="#FD006A" />
            ) : mobileValid && lookup.isSuccess ? (
              <Ionicons name="checkmark-circle" size={20} color="#059669" />
            ) : null
          }
        />

        {mobileValid && lookup.isFetching && !lookup.data ? (
          <Text className="text-sm text-neutral-500">{t("walkIn.lookingUp")}</Text>
        ) : null}

        {mobileValid && lookup.isError ? (
          <View className="gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
            <Text className="text-sm font-semibold text-red-700">{t("walkIn.lookupFailed")}</Text>
            <Text className="text-xs text-red-600">{describeError(lookup.error)}</Text>
            <Pressable onPress={() => void lookup.refetch()} className="self-start">
              <Text className="text-sm font-semibold text-brand">{t("walkIn.retry")}</Text>
            </Pressable>
          </View>
        ) : null}

        {summaryKind ? <KindBanner kind={summaryKind} /> : null}

        {mobileValid && lookup.isSuccess && matches.length > 0 ? (
          <View className="gap-2">
            <Text className="text-sm font-medium text-neutral-700">
              {t("walkIn.choosePatient")}
            </Text>
            {matches.map((m) => (
              <MatchRow
                key={m.id}
                patient={m}
                selected={selection === m.id}
                onPress={() => setSelection(m.id)}
              />
            ))}
            <OptionRow
              selected={selection === "new"}
              icon="person-add-outline"
              title={t("walkIn.newOnNumber")}
              subtitle={t("walkIn.newOnNumberHint")}
              onPress={() => setSelection("new")}
            />
            {show("patient") ? (
              <Text className="text-xs text-red-500">{show("patient")}</Text>
            ) : null}
          </View>
        ) : null}

        {kind === "new" ? (
          <TextField
            label={t("walkIn.patientName")}
            value={fullName}
            onChangeText={(v) => {
              setFullName(v);
              setEnsured(null);
            }}
            autoCapitalize="words"
            placeholder={t("walkIn.patientNamePlaceholder")}
            error={show("name")}
          />
        ) : null}

        {kind === "network" || kind === "new" ? (
          <View className="gap-1">
            <PhoneOtpVerify
              key={mobile10}
              mobile10={mobile10}
              required={kind === "network"}
              phoneToken={phoneToken}
              onVerified={(token) => setVerifiedPhone({ mobile10, token })}
            />
            {show("otp") ? <Text className="text-xs text-red-500">{show("otp")}</Text> : null}
          </View>
        ) : null}

        <View className="gap-2">
          <Text className="text-sm font-medium text-neutral-700">{t("walkIn.doctor")}</Text>
          {doctorsQ.isLoading ? (
            <ActivityIndicator color="#FD006A" className="self-start" />
          ) : doctorsQ.isError ? (
            <Text className="text-sm text-red-600">{describeError(doctorsQ.error)}</Text>
          ) : doctors.length === 0 ? (
            <Text className="text-sm text-neutral-500">{t("walkIn.noDoctors")}</Text>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {doctors.map((d) => {
                const active = d.id === doctorId;
                return (
                  <Pressable
                    key={d.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => setPickedDoctorId(d.id)}
                    className={`rounded-xl border px-3.5 py-2 ${
                      active ? "border-brand bg-brand/10" : "border-neutral-300 bg-white"
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        active ? "text-brand" : "text-neutral-800"
                      }`}
                      numberOfLines={1}
                    >
                      {d.name}
                    </Text>
                    {d.specialization ? (
                      <Text className="text-[11px] text-neutral-500" numberOfLines={1}>
                        {d.specialization}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}
          {show("doctor") && doctors.length > 0 ? (
            <Text className="text-xs text-red-500">{show("doctor")}</Text>
          ) : null}
        </View>

        <TextField
          label={t("walkIn.reason")}
          value={reason}
          onChangeText={setReason}
          placeholder={t("walkIn.reasonPlaceholder")}
          multiline
          numberOfLines={2}
          style={{ minHeight: 72 }}
          error={show("reason")}
        />

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          onPress={() => setConsent((c) => !c)}
          className="flex-row items-start gap-3"
        >
          <View
            className={`mt-0.5 h-6 w-6 items-center justify-center rounded-md border-2 ${
              consent ? "border-brand bg-brand" : show("consent") ? "border-red-400" : "border-neutral-400"
            }`}
          >
            {consent ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
          </View>
          <Text className="min-w-0 flex-1 text-sm leading-5 text-neutral-700">
            {t("walkIn.consent")}
          </Text>
        </Pressable>
        {show("consent") ? (
          <Text className="-mt-3 text-xs text-red-500">{show("consent")}</Text>
        ) : null}

        {formError ? (
          <View className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
            <Text className="text-sm font-semibold text-red-700">{t("walkIn.bookFailed")}</Text>
            <Text className="mt-0.5 text-xs text-red-600">{formError}</Text>
          </View>
        ) : null}

        <Button
          label={busy ? t("walkIn.booking") : t("walkIn.book")}
          loading={busy}
          disabled={!facilityId || lookup.isFetching}
          onPress={() => void onSubmit()}
          icon={<Ionicons name="walk-outline" size={18} color="#fff" />}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function KindBanner({ kind }: { kind: WalkInPatientKind }) {
  const { t } = useTranslation();
  const s = KIND_STYLE[kind];
  const title =
    kind === "facility"
      ? t("walkIn.kindFacility")
      : kind === "network"
        ? t("walkIn.kindNetwork")
        : t("walkIn.kindNew");
  const hint =
    kind === "facility"
      ? t("walkIn.kindFacilityHint")
      : kind === "network"
        ? t("walkIn.kindNetworkHint")
        : t("walkIn.kindNewHint");
  return (
    <View className={`flex-row gap-2.5 rounded-xl border px-3.5 py-3 ${s.box}`}>
      <Ionicons name={s.icon} size={20} color={s.color} />
      <View className="min-w-0 flex-1">
        <Text className={`text-sm font-semibold ${s.text}`}>{title}</Text>
        <Text className={`mt-0.5 text-xs ${s.text} opacity-80`}>{hint}</Text>
      </View>
    </View>
  );
}

function MatchRow({
  patient,
  selected,
  onPress,
}: {
  patient: OnboardLookupPatient;
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const age = ageFromDob(patient.dob);
  const meta = [
    `#${patient.patientId}`,
    age != null ? `${age}y` : null,
    patient.gender ? patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase() : null,
    patient.relationshipToPrimary
      ? patient.relationshipToPrimary.charAt(0) +
        patient.relationshipToPrimary.slice(1).toLowerCase()
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <OptionRow
      selected={selected}
      icon="person-circle-outline"
      title={lookupPatientName(patient)}
      subtitle={meta}
      badge={
        patient.isLinkedToFacility
          ? { label: t("walkIn.linkedBadge"), className: "bg-emerald-100 text-emerald-700" }
          : { label: t("walkIn.networkBadge"), className: "bg-sky-100 text-sky-700" }
      }
      onPress={onPress}
    />
  );
}

function OptionRow({
  selected,
  icon,
  title,
  subtitle,
  badge,
  onPress,
}: {
  selected: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  badge?: { label: string; className: string };
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-xl border px-3.5 py-3 ${
        selected ? "border-brand bg-brand/5" : "border-neutral-200 bg-white"
      }`}
    >
      <Ionicons name={icon} size={24} color={selected ? "#FD006A" : "#a3a3a3"} />
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold text-neutral-900" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-xs text-neutral-500" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {badge ? (
        <Text
          className={`overflow-hidden rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${badge.className}`}
        >
          {badge.label}
        </Text>
      ) : null}
      <Ionicons
        name={selected ? "radio-button-on" : "radio-button-off"}
        size={20}
        color={selected ? "#FD006A" : "#d4d4d4"}
      />
    </Pressable>
  );
}
