import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useQueryClient } from "@tanstack/react-query";

import { AppModal, Button } from "@/ui";
import { AppAlert } from "@/ui/AppAlert";
import { describeError } from "@/lib/api/errors";
import { fetchProxiedFileToCache } from "@/lib/api/fetchProxiedFile";
import { uploadQuestionnaireDocument } from "@/lib/api/endpoints/questionnaire";
import { useFacilityId } from "@/lib/auth/store";
import { SelectField } from "../form/kit";
import {
  usePatient,
  usePatientQuestionnaire,
  useSavePatientQuestionnaire,
} from "../hooks";
import {
  CONDITIONS,
  GOVERNMENT_INSURANCE_NAMES,
  PRIVATE_INSURANCE_NAMES,
  STEP_DESCRIPTIONS,
  STEP_TITLES,
  type Errors,
  type Step1Data,
  type Step2Data,
  type Step3Data,
  hasErrors,
  hydrate,
  skipPayload,
  toMedicalHistoryPayload,
  toStep2Payload,
  validateStep1,
  validateStep2,
  validateStep3,
} from "./model";
import {
  Checkbox,
  FieldError,
  Input,
  MedicineInput,
  MonthYearField,
  Question,
  Radio,
  YesNoRadio,
} from "./controls";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Mongo or display id — questionnaire GET resolves both. */
  patientId: string;
  /** Mongo id — what the save and the insurance upload take. */
  mongoPatientId: string;
  onSaved?: () => void;
  /** Header "Patient Name" / "Patient ID"; looked up when omitted. */
  patientName?: string;
  patientDisplayId?: number | string;
};

/**
 * Patient medical-history questionnaire — the Practice web sheet
 * (`components/patient/questionnaire/questionnaire-sheet.tsx`) on the tablet:
 * same three steps, numbered questions, "Since" month/year per condition,
 * medicine search with chips, insurance with month/year validity and an
 * uploaded document, a Step N of 3 progress bar, and the same buttons —
 * Back · Save & Continue / Finish · Skip now / Skip & Finish.
 * Each step is saved as it is left, so closing mid-way keeps what was entered.
 */
export function QuestionnaireSheet(props: Props) {
  const { open, onOpenChange, patientId } = props;
  const existing = usePatientQuestionnaire(open ? patientId : undefined);
  const close = () => onOpenChange(false);

  return (
    <AppModal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      {!open ? null : existing.isLoading ? (
        <View className="flex-1 items-center justify-center bg-white">
          <ActivityIndicator size="large" color="#FD006A" />
        </View>
      ) : (
        // Mounted fresh on every open, so its state starts from what is saved.
        <QuestionnaireBody {...props} initial={hydrate(existing.data)} />
      )}
    </AppModal>
  );
}

function QuestionnaireBody({
  onOpenChange,
  patientId,
  mongoPatientId,
  onSaved,
  patientName,
  patientDisplayId,
  initial,
}: Props & { initial: ReturnType<typeof hydrate> }) {
  const facilityId = useFacilityId();
  const qc = useQueryClient();
  const save = useSavePatientQuestionnaire(mongoPatientId || patientId);
  const { width } = useWindowDimensions();
  const twoCol = width >= 700;

  // Header patient info — passed in, or read from the record (usually cached).
  const lookup = usePatient(patientName ? undefined : patientId);
  const name =
    patientName ??
    ([lookup.data?.firstName, lookup.data?.lastName].filter(Boolean).join(" ") ||
      undefined);
  const displayId = patientDisplayId ?? lookup.data?.patientId;

  const [step, setStep] = useState<1 | 2 | 3>(initial.step);
  const [s1, setS1] = useState<Step1Data>(initial.step1);
  const [s2, setS2] = useState<Step2Data>(initial.step2);
  const [s3, setS3] = useState<Step3Data>(initial.step3);
  const [e1, setE1] = useState<Errors>({});
  const [e2, setE2] = useState<Errors>({});
  const [e3, setE3] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [openingDoc, setOpeningDoc] = useState(false);
  /** "Other" chosen in the insurance-name list before anything is typed. */
  const [otherNamePicked, setOtherNamePicked] = useState(false);

  const busy = saving || finishing || uploading;
  const close = () => onOpenChange(false);

  const draft = async (
    stepNumber: 1 | 2 | 3,
    stepData: Record<string, unknown>,
    completed = false
  ) => {
    const res = await save.mutateAsync({ stepNumber, stepData, completed });
    // The read is keyed by display id OR Mongo id depending on the caller,
    // while the save hook only refreshes the Mongo-id key — refresh both.
    void qc.invalidateQueries({ queryKey: ["patient-questionnaire"] });
    return res;
  };

  const stepPayload = (n: 1 | 2 | 3) =>
    n === 1
      ? toMedicalHistoryPayload(s1)
      : n === 2
        ? toStep2Payload(s2)
        : toMedicalHistoryPayload(s1, s3);

  const validate = (n: 1 | 2 | 3) => {
    if (n === 1) {
      const e = validateStep1(s1);
      setE1(e);
      return !hasErrors(e);
    }
    if (n === 2) {
      const e = validateStep2(s2);
      setE2(e);
      return !hasErrors(e);
    }
    const e = validateStep3(s3);
    setE3(e);
    return !hasErrors(e);
  };

  const requireFacility = () => {
    if (facilityId) return true;
    setBanner("Select a facility before saving the questionnaire.");
    return false;
  };

  // ── Actions (Practice handleSkip / handleSaveAndContinue / handleFinish) ──
  const handleSkip = async () => {
    if (!requireFacility()) return;
    setBanner(null);
    setSaving(true);
    try {
      await draft(step, skipPayload(step));
      if (step < 3) setStep((step + 1) as 2 | 3);
      else {
        AppAlert.success("Patient intake skipped");
        onSaved?.();
        close();
      }
    } catch (e) {
      setBanner(`Failed to save progress: ${describeError(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    if (!requireFacility()) return;
    const ok = [validate(1), validate(2), validate(3)].every(Boolean);
    if (!ok) {
      setBanner("Please fill in all required fields before finishing");
      return;
    }
    setBanner(null);
    setFinishing(true);
    try {
      await draft(1, toMedicalHistoryPayload(s1));
      await draft(2, toStep2Payload(s2));
      await draft(3, toMedicalHistoryPayload(s1, s3));
      await draft(3, toMedicalHistoryPayload(s1, s3), true);
      AppAlert.success("Patient intake completed");
      onSaved?.();
      close();
    } catch (e) {
      setBanner(describeError(e) || "Failed to complete intake");
    } finally {
      setFinishing(false);
    }
  };

  const handleSaveAndContinue = async () => {
    if (!requireFacility()) return;
    if (!validate(step)) {
      setBanner("Please fill in all required fields");
      return;
    }
    if (step === 3) {
      await handleFinish();
      return;
    }
    setBanner(null);
    setSaving(true);
    try {
      await draft(step, stepPayload(step));
      setStep((step + 1) as 2 | 3);
    } catch (e) {
      setBanner(`Failed to save progress: ${describeError(e)}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Insurance document ──
  const pickDocument = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: ["image/jpeg", "image/png", "image/gif", "application/pdf"],
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const a = picked.assets[0];
      if (a.size && a.size > 300 * 1024 * 1024) {
        AppAlert.alert("File too large", "File size must be less than 300MB");
        return;
      }
      setUploading(true);
      // Uploaded straight away, as on Practice — the step then saves the URL.
      const res = await uploadQuestionnaireDocument({
        patientId: mongoPatientId || patientId,
        uri: a.uri,
        fileName: a.name || "insurance",
        mimeType: a.mimeType || "application/pdf",
        facilityId: facilityId ?? undefined,
      });
      setS3((p) => ({
        ...p,
        insuranceDocument: res.url,
        insuranceDocumentName: res.fileName || a.name || "insurance",
      }));
      setE3((p) => ({ ...p, insuranceDocument: undefined }));
      AppAlert.success("Document uploaded successfully");
    } catch (e) {
      AppAlert.alert("Upload failed", describeError(e));
    } finally {
      setUploading(false);
    }
  };

  const viewDocument = async () => {
    if (!s3.insuranceDocument) return;
    setOpeningDoc(true);
    try {
      const { localUri } = await fetchProxiedFileToCache(s3.insuranceDocument);
      await Linking.openURL(localUri);
    } catch (e) {
      AppAlert.alert("Could not open document", describeError(e));
    } finally {
      setOpeningDoc(false);
    }
  };

  // ── Step 1 ──
  const toggleCondition = (c: string) =>
    setS1((p) => {
      if (p.conditions.includes(c)) {
        const { [c]: _removed, ...rest } = p.conditionDates;
        return { ...p, conditions: p.conditions.filter((x) => x !== c), conditionDates: rest };
      }
      return {
        ...p,
        conditions: [...p.conditions, c],
        conditionDates: { ...p.conditionDates, [c]: p.conditionDates[c] ?? "" },
      };
    });

  const step1 = (
    <View className="gap-6">
      <View className="gap-3">
        <Question hint="(Check all that apply)">
          1. Have you ever had any of these conditions?
        </Question>
        <View className="flex-row flex-wrap">
          {CONDITIONS.map((c) => {
            const on = s1.conditions.includes(c);
            return (
              <View
                key={c}
                style={{ width: twoCol ? "50%" : "100%" }}
                className="gap-1.5 pb-3 pr-3"
              >
                <Checkbox label={c} checked={on} onPress={() => toggleCondition(c)} />
                {on ? (
                  <View className="ml-7 flex-row flex-wrap items-center gap-2">
                    <Text className="text-xs text-neutral-600">Since:</Text>
                    <MonthYearField
                      value={s1.conditionDates[c] ?? ""}
                      onChange={(v) =>
                        setS1((p) => ({
                          ...p,
                          conditionDates: { ...p.conditionDates, [c]: v },
                        }))
                      }
                    />
                    <Text className="text-xs text-neutral-500">(Optional)</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-sm text-neutral-800">Other:</Text>
          <View className="flex-1">
            <Input
              value={s1.otherCondition}
              onChangeText={(v) => setS1((p) => ({ ...p, otherCondition: v }))}
              placeholder="Specify other conditions"
            />
          </View>
        </View>
        {s1.otherCondition.trim() ? (
          <View className="flex-row items-center gap-2">
            <Text className="text-xs text-neutral-600">Since:</Text>
            <MonthYearField
              value={s1.otherConditionDate}
              onChange={(v) => setS1((p) => ({ ...p, otherConditionDate: v }))}
            />
          </View>
        ) : null}
      </View>

      <YesNoQuestion
        title="2. Any previous surgeries?"
        value={s1.hasSurgeries}
        onChange={(v) => {
          setS1((p) => ({ ...p, hasSurgeries: v }));
          if (v === "no") setE1((p) => ({ ...p, surgeryDetails: undefined }));
        }}
        detailLabel="If yes, what and when:"
        detail={s1.surgeryDetails}
        onDetail={(v) => {
          setS1((p) => ({ ...p, surgeryDetails: v }));
          if (v.trim()) setE1((p) => ({ ...p, surgeryDetails: undefined }));
        }}
        placeholder="Describe surgeries and dates"
        error={e1.surgeryDetails}
      />

      <YesNoQuestion
        title="3. Any hospitalizations in the past 5 years?"
        value={s1.hasHospitalizations}
        onChange={(v) => {
          setS1((p) => ({ ...p, hasHospitalizations: v }));
          if (v === "no") setE1((p) => ({ ...p, hospitalizationDetails: undefined }));
        }}
        detailLabel="Details:"
        detail={s1.hospitalizationDetails}
        onDetail={(v) => {
          setS1((p) => ({ ...p, hospitalizationDetails: v }));
          if (v.trim()) setE1((p) => ({ ...p, hospitalizationDetails: undefined }));
        }}
        placeholder="Describe hospitalizations"
        error={e1.hospitalizationDetails}
      />
    </View>
  );

  // ── Step 2 ──
  const step2 = (
    <View className="gap-6">
      <View className="gap-2">
        <Question>4. Are you taking any medicines now?</Question>
        <YesNoRadio
          value={s2.takingMedicines}
          onChange={(v) => {
            setS2((p) => ({ ...p, takingMedicines: v }));
            if (v === "no") setE2((p) => ({ ...p, medicines: undefined }));
          }}
        />
        {s2.takingMedicines === "yes" ? (
          <View className="gap-2 pl-1">
            <DetailLabel text="If yes, list medicines:" />
            <FieldError message={e2.medicines} />
            <MedicineInput
              medicines={s2.medicines}
              onChange={(next) => {
                setS2((p) => ({ ...p, medicines: next }));
                if (next.length) setE2((p) => ({ ...p, medicines: undefined }));
              }}
            />
          </View>
        ) : null}
      </View>

      <YesNoQuestion
        title="5. Any herbal/Ayurvedic medicines?"
        value={s2.hasHerbalMedicines}
        onChange={(v) => {
          setS2((p) => ({ ...p, hasHerbalMedicines: v }));
          if (v === "no") setE2((p) => ({ ...p, herbalMedicineDetails: undefined }));
        }}
        detailLabel="Details:"
        detail={s2.herbalMedicineDetails}
        onDetail={(v) => {
          setS2((p) => ({ ...p, herbalMedicineDetails: v }));
          if (v.trim()) setE2((p) => ({ ...p, herbalMedicineDetails: undefined }));
        }}
        placeholder="Describe herbal/Ayurvedic medicines"
        error={e2.herbalMedicineDetails}
      />

      <View className="gap-6 border-t border-neutral-200 pt-4">
        <Text className="text-base font-semibold text-neutral-900">Allergies</Text>
        <YesNoQuestion
          title="6. Are you allergic to any medicines?"
          value={s2.allergicToMedicines}
          onChange={(v) => {
            setS2((p) => ({ ...p, allergicToMedicines: v }));
            if (v === "no") setE2((p) => ({ ...p, medicineAllergies: undefined }));
          }}
          detailLabel="If yes, which medicines:"
          detail={s2.medicineAllergies}
          onDetail={(v) => {
            setS2((p) => ({ ...p, medicineAllergies: v }));
            if (v.trim()) setE2((p) => ({ ...p, medicineAllergies: undefined }));
          }}
          placeholder="List medicines you are allergic to"
          error={e2.medicineAllergies}
        />
        <YesNoQuestion
          title="7. Any food allergies?"
          value={s2.hasFoodAllergies}
          onChange={(v) => {
            setS2((p) => ({ ...p, hasFoodAllergies: v }));
            if (v === "no") setE2((p) => ({ ...p, foodAllergies: undefined }));
          }}
          detailLabel="If yes, which foods:"
          detail={s2.foodAllergies}
          onDetail={(v) => {
            setS2((p) => ({ ...p, foodAllergies: v }));
            if (v.trim()) setE2((p) => ({ ...p, foodAllergies: undefined }));
          }}
          placeholder="List foods you are allergic to"
          error={e2.foodAllergies}
        />
      </View>
    </View>
  );

  // ── Step 3 ──
  const insuranceList =
    s3.insuranceType === "government" ? GOVERNMENT_INSURANCE_NAMES : PRIVATE_INSURANCE_NAMES;
  const isCustomName =
    !!s3.insuranceName &&
    !!s3.insuranceType &&
    !(insuranceList as readonly string[]).includes(s3.insuranceName);
  const nameSelectValue = isCustomName ? "Other" : s3.insuranceName;
  const showNameInput =
    nameSelectValue === "Other" || (otherNamePicked && !s3.insuranceName);

  const step3 = (
    <View className="gap-4 border-t border-neutral-200 pt-2">
      <View className="gap-2">
        <Question>8. Do you have health insurance?</Question>
        <YesNoRadio
          value={s3.hasHealthInsurance}
          onChange={(v) => {
            setS3((p) => ({ ...p, hasHealthInsurance: v }));
            if (v === "no") setE3({});
          }}
        />
      </View>

      {s3.hasHealthInsurance === "yes" ? (
        <View className="gap-4 rounded-xl border border-brand/20 bg-brand/5 p-4">
          <View className="gap-2">
            <Text className="text-base font-semibold text-neutral-900">
              Type of insurance: <Text className="text-red-500">*</Text>
            </Text>
            <View className="flex-row flex-wrap gap-6 pl-1">
              <Radio
                label="Government (CMCHIS/ESI)"
                selected={s3.insuranceType === "government"}
                onPress={() => {
                  setOtherNamePicked(false);
                  setS3((p) => ({ ...p, insuranceType: "government", insuranceName: "" }));
                  setE3((p) => ({ ...p, insuranceType: undefined }));
                }}
              />
              <Radio
                label="Private Insurance"
                selected={s3.insuranceType === "private"}
                onPress={() => {
                  setOtherNamePicked(false);
                  setS3((p) => ({ ...p, insuranceType: "private", insuranceName: "" }));
                  setE3((p) => ({ ...p, insuranceType: undefined }));
                }}
              />
            </View>
            <FieldError message={e3.insuranceType} />
          </View>

          {s3.insuranceType ? (
            <View className="gap-4 border-t border-brand/20 pt-4">
              <View className="gap-2">
                <SelectField
                  label="Insurance Name"
                  required
                  placeholder="Select insurance name"
                  options={insuranceList.map((n) => ({ value: n, label: n }))}
                  value={nameSelectValue}
                  error={e3.insuranceName}
                  onChange={(v) => {
                    if (v === "Other") {
                      setOtherNamePicked(true);
                      // Keep a custom name already typed; clear a listed one.
                      setS3((p) => ({
                        ...p,
                        insuranceName: (insuranceList as readonly string[]).includes(
                          p.insuranceName
                        )
                          ? ""
                          : p.insuranceName,
                      }));
                    } else {
                      setOtherNamePicked(false);
                      setS3((p) => ({ ...p, insuranceName: v }));
                    }
                    setE3((p) => ({ ...p, insuranceName: undefined }));
                  }}
                />
                {showNameInput ? (
                  <Input
                    value={isCustomName ? s3.insuranceName : ""}
                    onChangeText={(v) => {
                      setS3((p) => ({ ...p, insuranceName: v }));
                      if (v.trim()) setE3((p) => ({ ...p, insuranceName: undefined }));
                    }}
                    placeholder="Enter insurance name"
                    error={!!e3.insuranceName}
                  />
                ) : null}
              </View>

              <View className="gap-2">
                <Text className="text-sm font-semibold text-neutral-900">
                  Valid Till <Text className="text-red-500">*</Text>
                </Text>
                <MonthYearField
                  futureOnly
                  value={s3.insuranceValidTill}
                  error={!!e3.insuranceValidTill}
                  onChange={(v) => {
                    setS3((p) => ({ ...p, insuranceValidTill: v }));
                    if (v) setE3((p) => ({ ...p, insuranceValidTill: undefined }));
                  }}
                />
                <FieldError message={e3.insuranceValidTill} />
              </View>

              <View className="gap-2">
                <Text className="text-sm font-semibold text-neutral-900">
                  Upload Document (Image or PDF) <Text className="text-red-500">*</Text>
                </Text>
                {s3.insuranceDocument ? (
                  <View className="h-20 flex-row items-center justify-center gap-3 rounded-xl border-2 border-dashed border-neutral-300 bg-white px-4">
                    <Ionicons name="document-text-outline" size={20} color="#6b7280" />
                    <Pressable onPress={viewDocument} disabled={openingDoc} className="flex-shrink">
                      <Text numberOfLines={1} className="text-sm text-brand underline">
                        {s3.insuranceDocumentName || "Insurance document"}
                      </Text>
                    </Pressable>
                    {openingDoc ? <ActivityIndicator size="small" color="#FD006A" /> : null}
                    <Pressable
                      onPress={() =>
                        setS3((p) => ({ ...p, insuranceDocument: "", insuranceDocumentName: "" }))
                      }
                      hitSlop={8}
                      accessibilityLabel="Remove document"
                    >
                      <Ionicons name="close" size={18} color="#6b7280" />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={pickDocument}
                    disabled={uploading}
                    className={`h-20 items-center justify-center gap-1 rounded-xl border-2 border-dashed bg-white active:bg-neutral-50 ${
                      e3.insuranceDocument ? "border-red-400" : "border-neutral-300"
                    }`}
                  >
                    {uploading ? (
                      <ActivityIndicator color="#FD006A" />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload-outline" size={22} color="#6b7280" />
                        <Text className="text-sm text-neutral-600">Tap to upload</Text>
                        <Text className="text-xs text-neutral-500">
                          Image (JPEG, PNG, GIF) or PDF (Max 300MB)
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}
                <FieldError message={e3.insuranceDocument} />
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="gap-3 border-b border-neutral-200 px-5 pb-4 pt-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-2xl font-bold text-neutral-900">
                {step === 1 ? "Patient Medical History" : STEP_TITLES[step - 1]}
              </Text>
              {step === 1 ? (
                <Ionicons name="medkit-outline" size={22} color="#ec4899" />
              ) : null}
            </View>
            <Text className="text-sm text-neutral-500">
              {step === 1
                ? "Please answer to the following questions to help the doctor understand your condition."
                : STEP_DESCRIPTIONS[step - 1]}
            </Text>
          </View>
          <Pressable onPress={close} hitSlop={12} disabled={busy} accessibilityLabel="Close">
            <Ionicons name="close" size={24} color="#6b7280" />
          </Pressable>
        </View>

        {name || displayId != null ? (
          <View className="flex-row flex-wrap gap-4 border-t border-neutral-100 pt-3">
            {displayId != null ? (
              <Text className="text-sm text-neutral-600">
                Patient ID: <Text className="font-semibold text-neutral-900">{String(displayId)}</Text>
              </Text>
            ) : null}
            {name ? (
              <Text className="text-sm text-neutral-600">
                Patient Name: <Text className="font-semibold text-neutral-900">{name}</Text>
              </Text>
            ) : null}
          </View>
        ) : null}

        <View className="gap-1.5">
          <Text className="text-sm font-medium text-pink-600">
            Step {step} of {STEP_TITLES.length}
          </Text>
          <View className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
            <View
              className="h-2 rounded-full bg-pink-500"
              style={{ width: `${(step / STEP_TITLES.length) * 100}%` }}
            />
          </View>
        </View>
      </View>

      {/* Body */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
      >
        {banner ? (
          <View className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <Text className="text-sm text-amber-800">{banner}</Text>
          </View>
        ) : null}
        {step === 1 ? step1 : step === 2 ? step2 : step3}
      </ScrollView>

      {/* Footer */}
      <View className="gap-2 border-t border-neutral-200 px-5 pb-4 pt-3">
        <View className="flex-row items-center justify-center gap-3">
          {step > 1 ? (
            <Button
              label="Back"
              variant="outline"
              size="md"
              icon={<Ionicons name="chevron-back" size={16} color="#111827" />}
              onPress={() => setStep((step - 1) as 1 | 2)}
              disabled={busy}
            />
          ) : null}
          <View className="max-w-md flex-1">
            <Button
              label={step === 3 ? "Finish" : "Save & Continue"}
              onPress={step === 3 ? handleFinish : handleSaveAndContinue}
              loading={saving || finishing}
              disabled={busy}
            />
          </View>
          <Pressable
            onPress={step === 3 ? handleFinish : handleSkip}
            disabled={busy}
            hitSlop={8}
            className={busy ? "opacity-50" : ""}
          >
            <Text className="text-sm font-medium text-neutral-600 underline">
              {step === 3 ? "Skip & Finish" : "Skip now"}
            </Text>
          </Pressable>
        </View>
        <Text className="text-center text-xs text-neutral-500">
          This information is confidential and used only for medical care.
        </Text>
      </View>
    </View>
  );
}

function DetailLabel({ text }: { text: string }) {
  return (
    <Text className="text-sm text-neutral-600">
      {text} <Text className="text-red-500">*</Text>
    </Text>
  );
}

/** Numbered yes/no question with a required detail box on "Yes". */
function YesNoQuestion({
  title,
  value,
  onChange,
  detailLabel,
  detail,
  onDetail,
  placeholder,
  error,
}: {
  title: string;
  value: Step1Data["hasSurgeries"];
  onChange: (v: Step1Data["hasSurgeries"]) => void;
  detailLabel: string;
  detail: string;
  onDetail: (v: string) => void;
  placeholder: string;
  error?: string;
}) {
  return (
    <View className="gap-2">
      <Question>{title}</Question>
      <YesNoRadio value={value} onChange={onChange} />
      {value === "yes" ? (
        <View className="gap-1.5">
          <DetailLabel text={detailLabel} />
          <Input value={detail} onChangeText={onDetail} placeholder={placeholder} error={!!error} />
          <FieldError message={error} />
        </View>
      ) : null}
    </View>
  );
}
