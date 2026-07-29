import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";

import { AppModal, Button, TextField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { useFacilityId } from "@/lib/auth/store";
import { uploadQuestionnaireDocument } from "@/lib/api/endpoints/questionnaire";
import {
  usePatientQuestionnaire,
  useSavePatientQuestionnaire,
} from "./hooks";
import type { QuestionnaireField } from "./types";

const CONDITIONS = [
  "Diabetes",
  "High Blood Pressure",
  "Heart Disease",
  "Asthma",
  "Tuberculosis",
  "Thyroid Problems",
  "Kidney Disease",
  "Cancer",
  "Mental Health Issues",
] as const;

const STEP_TITLES = [
  "Past medical history",
  "Medications & allergies",
  "Insurance",
] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Mongo or display id — questionnaire GET resolves both. */
  patientId: string;
  /** Mongo id required for insurance document upload. */
  mongoPatientId: string;
  onSaved?: () => void;
};

function asField(v: unknown): QuestionnaireField {
  if (v && typeof v === "object") return v as QuestionnaireField;
  return { selectedValue: "", inputValue: "" };
}

/**
 * 3-step PatientQuestionnaire sheet — mirrors Practice questionnaire-sheet.
 * Does NOT call unused /api/patient/medical-history or /medications.
 */
export function QuestionnaireSheet({
  open,
  onOpenChange,
  patientId,
  mongoPatientId,
  onSaved,
}: Props) {
  const facilityId = useFacilityId();
  const existing = usePatientQuestionnaire(patientId);
  const save = useSavePatientQuestionnaire(mongoPatientId || patientId);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Step 1
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [otherCondition, setOtherCondition] = useState("");
  const [surgeries, setSurgeries] = useState("");
  const [hospitalizations, setHospitalizations] = useState("");

  // Step 2
  const [takingMeds, setTakingMeds] = useState(false);
  const [medsText, setMedsText] = useState("");
  const [herbal, setHerbal] = useState(false);
  const [herbalText, setHerbalText] = useState("");
  const [medAllergy, setMedAllergy] = useState(false);
  const [medAllergyText, setMedAllergyText] = useState("");
  const [foodAllergy, setFoodAllergy] = useState(false);
  const [foodAllergyText, setFoodAllergyText] = useState("");

  // Step 3
  const [hasInsurance, setHasInsurance] = useState(false);
  const [insuranceType, setInsuranceType] = useState("");
  const [insuranceName, setInsuranceName] = useState("");
  const [validTill, setValidTill] = useState("");
  const [docUri, setDocUri] = useState<string | null>(null);
  const [docName, setDocName] = useState<string | null>(null);
  const [docMime, setDocMime] = useState("application/pdf");

  const hydrated = useMemo(() => existing.data, [existing.data]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setError(null);
    setBusy(false);

    const mh = hydrated?.medicalHistory as Record<string, unknown> | undefined;
    const past = asField(mh?.pastConditions);
    const sel = past.selectedValue;
    setSelectedConditions(
      Array.isArray(sel) ? sel.map(String) : sel ? [String(sel)] : []
    );
    setOtherCondition(String(past.inputValue ?? ""));
    setSurgeries(String(asField(mh?.surgeries).inputValue ?? ""));
    setHospitalizations(
      String(asField(mh?.hospitalizations).inputValue ?? "")
    );

    const meds = asField(hydrated?.CurrentMedications?.medications);
    const herbalF = asField(hydrated?.CurrentMedications?.["herbal&ayurvedic"]);
    setMedsText(String(meds.inputValue ?? ""));
    setTakingMeds(!!meds.inputValue || String(meds.selectedValue) === "Yes");
    setHerbalText(String(herbalF.inputValue ?? ""));
    setHerbal(!!herbalF.inputValue || String(herbalF.selectedValue) === "Yes");

    const medA = asField(hydrated?.allergies?.medicineAllergies);
    const foodA = asField(hydrated?.allergies?.foodAllergies);
    setMedAllergyText(String(medA.inputValue ?? ""));
    setMedAllergy(!!medA.inputValue || String(medA.selectedValue) === "Yes");
    setFoodAllergyText(String(foodA.inputValue ?? ""));
    setFoodAllergy(!!foodA.inputValue || String(foodA.selectedValue) === "Yes");

    const insurance = (mh?.insurance ?? null) as
      | Record<string, unknown>
      | null
      | undefined;
    setHasInsurance(String(insurance?.hasInsurance ?? "") === "Yes");
    setInsuranceType(String(insurance?.type ?? ""));
    setInsuranceName(String(insurance?.insuranceName ?? ""));
    setValidTill(String(insurance?.validTill ?? ""));
    setDocUri(null);
    setDocName(null);
  }, [open, hydrated]);

  const close = () => onOpenChange(false);

  const toggleCondition = (c: string) => {
    setSelectedConditions((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const pickInsuranceDoc = async () => {
    setError(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: ["image/jpeg", "image/png", "image/gif", "application/pdf"],
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const a = picked.assets[0];
      setDocUri(a.uri);
      setDocName(a.name || "insurance");
      setDocMime(a.mimeType || "application/pdf");
    } catch (e) {
      setError(describeError(e));
    }
  };

  const saveStep = async () => {
    setError(null);
    setBusy(true);
    try {
      if (step === 1) {
        await save.mutateAsync({
          stepNumber: 1,
          stepData: {
            pastConditions: {
              selectedValue: selectedConditions,
              inputValue: otherCondition.trim(),
              conditionDates: {},
              otherConditionDate: "",
            },
            surgeries: {
              selectedValue: surgeries.trim() ? "Yes" : "No",
              inputValue: surgeries.trim(),
            },
            hospitalizations: {
              selectedValue: hospitalizations.trim() ? "Yes" : "No",
              inputValue: hospitalizations.trim(),
            },
          },
        });
        setStep(2);
      } else if (step === 2) {
        await save.mutateAsync({
          stepNumber: 2,
          stepData: {
            allergies: {
              medicineAllergies: {
                selectedValue: medAllergy ? "Yes" : "No",
                inputValue: medAllergyText.trim(),
              },
              foodAllergies: {
                selectedValue: foodAllergy ? "Yes" : "No",
                inputValue: foodAllergyText.trim(),
              },
              otherAllergies: { selectedValue: "No", inputValue: "" },
            },
            CurrentMedications: {
              medications: {
                selectedValue: takingMeds ? "Yes" : "No",
                inputValue: medsText.trim(),
              },
              "herbal&ayurvedic": {
                selectedValue: herbal ? "Yes" : "No",
                inputValue: herbalText.trim(),
              },
              otherMedicationsDetails: {
                selectedValue: "No",
                inputValue: "",
              },
            },
          },
        });
        setStep(3);
      } else {
        let document:
          | { uri: string; name: string; size: number }
          | undefined;
        if (docUri && docName) {
          const uploaded = await uploadQuestionnaireDocument({
            patientId: mongoPatientId,
            uri: docUri,
            fileName: docName,
            mimeType: docMime,
            facilityId: facilityId ?? undefined,
          });
          document = { uri: uploaded.url, name: docName, size: 0 };
        }

        const priorMh =
          (hydrated?.medicalHistory as Record<string, unknown> | null) ?? {};
        await save.mutateAsync({
          stepNumber: 3,
          completed: true,
          stepData: {
            ...priorMh,
            insurance: {
              hasInsurance: hasInsurance ? "Yes" : "No",
              type: insuranceType.trim(),
              insuranceName: insuranceName.trim(),
              insuranceNameOther: "",
              validTill: validTill.trim(),
              ...(document ? { document } : {}),
            },
          },
        });
        onSaved?.();
        close();
      }
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppModal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between border-b border-neutral-200 px-4 py-3">
          <View className="flex-1 pr-3">
            <Text className="text-lg font-semibold text-neutral-900">
              Medical questionnaire
            </Text>
            <Text className="text-xs text-neutral-500">
              Step {step} of 3 — {STEP_TITLES[step - 1]}
            </Text>
          </View>
          <Pressable onPress={close} hitSlop={12} disabled={busy}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        >
          {step === 1 ? (
            <>
              <Text className="text-sm font-medium text-neutral-800">
                Past conditions
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {CONDITIONS.map((c) => {
                  const on = selectedConditions.includes(c);
                  return (
                    <Pressable
                      key={c}
                      onPress={() => toggleCondition(c)}
                      className={`rounded-full px-3 py-1.5 ${
                        on ? "bg-brand" : "bg-neutral-100"
                      }`}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          on ? "text-white" : "text-neutral-700"
                        }`}
                      >
                        {c}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextField
                label="Other conditions"
                value={otherCondition}
                onChangeText={setOtherCondition}
              />
              <TextField
                label="Surgeries"
                value={surgeries}
                onChangeText={setSurgeries}
                placeholder="Details or leave blank"
              />
              <TextField
                label="Hospitalizations"
                value={hospitalizations}
                onChangeText={setHospitalizations}
                placeholder="Details or leave blank"
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <RowSwitch
                label="Currently taking medicines"
                value={takingMeds}
                onChange={setTakingMeds}
              />
              {takingMeds ? (
                <TextField
                  label="Medicines"
                  value={medsText}
                  onChangeText={setMedsText}
                  placeholder="Comma-separated"
                />
              ) : null}
              <RowSwitch
                label="Herbal / Ayurvedic"
                value={herbal}
                onChange={setHerbal}
              />
              {herbal ? (
                <TextField
                  label="Herbal details"
                  value={herbalText}
                  onChangeText={setHerbalText}
                />
              ) : null}
              <RowSwitch
                label="Medicine allergies"
                value={medAllergy}
                onChange={setMedAllergy}
              />
              {medAllergy ? (
                <TextField
                  label="Medicine allergy details"
                  value={medAllergyText}
                  onChangeText={setMedAllergyText}
                />
              ) : null}
              <RowSwitch
                label="Food allergies"
                value={foodAllergy}
                onChange={setFoodAllergy}
              />
              {foodAllergy ? (
                <TextField
                  label="Food allergy details"
                  value={foodAllergyText}
                  onChangeText={setFoodAllergyText}
                />
              ) : null}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <RowSwitch
                label="Has health insurance"
                value={hasInsurance}
                onChange={setHasInsurance}
              />
              {hasInsurance ? (
                <>
                  <TextField
                    label="Insurance type"
                    value={insuranceType}
                    onChangeText={setInsuranceType}
                    placeholder="Government / Private / Other"
                  />
                  <TextField
                    label="Insurance name"
                    value={insuranceName}
                    onChangeText={setInsuranceName}
                  />
                  <TextField
                    label="Valid till (YYYY-MM-DD)"
                    value={validTill}
                    onChangeText={setValidTill}
                    autoCapitalize="none"
                  />
                  <Pressable
                    onPress={() => void pickInsuranceDoc()}
                    className="flex-row items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-4"
                  >
                    <Ionicons
                      name="document-attach-outline"
                      size={22}
                      color="#FD006A"
                    />
                    <Text className="flex-1 text-sm text-neutral-800">
                      {docName || "Attach insurance document (optional)"}
                    </Text>
                  </Pressable>
                </>
              ) : null}
            </>
          ) : null}

          {error ? (
            <Text className="text-sm text-red-500">{error}</Text>
          ) : null}

          <View className="flex-row gap-3 pt-2">
            {step > 1 ? (
              <Button
                label="Back"
                variant="outline"
                className="flex-1"
                disabled={busy}
                onPress={() => setStep((s) => (s === 1 ? 1 : ((s - 1) as 1 | 2 | 3)))}
              />
            ) : null}
            <Button
              label={step === 3 ? "Save" : "Continue"}
              className="flex-1"
              loading={busy}
              disabled={busy}
              onPress={() => void saveStep()}
            />
          </View>
        </ScrollView>
      </View>
    </AppModal>
  );
}

function RowSwitch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3 py-1">
      <Text className="flex-1 text-sm text-neutral-800">{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#d4d4d8", true: "#FDA4C8" }}
        thumbColor={value ? "#FD006A" : "#f4f4f5"}
      />
    </View>
  );
}
