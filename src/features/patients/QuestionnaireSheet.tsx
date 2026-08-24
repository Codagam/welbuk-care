import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";

import { AppModal, Button, DateField, Segmented, TextField } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { fetchProxiedFileToCache } from "@/lib/api/fetchProxiedFile";
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

const GOVERNMENT_INSURANCE_NAMES = [
  "CMCHIS (Chief Minister's Comprehensive Health Insurance Scheme)",
  "ESI (Employees' State Insurance)",
  "CGHS (Central Government Health Scheme)",
  "ECHS (Ex-Servicemen Contributory Health Scheme)",
  "Arogya Karnataka",
  "Ayushman Bharat - Pradhan Mantri Jan Arogya Yojana (PM-JAY)",
  "Other",
] as const;

const PRIVATE_INSURANCE_NAMES = [
  "Bharati AXA General Insurance",
  "Bajaj Allianz General Insurance",
  "HDFC ERGO General Insurance",
  "ICICI Lombard General Insurance",
  "New India Assurance",
  "Oriental Insurance",
  "Reliance General Insurance",
  "Star Health and Allied Insurance",
  "United India Insurance",
  "Other",
] as const;

const STEP_TITLES = [
  "Past medical history",
  "Medications & allergies",
  "Insurance",
] as const;

const YES_NO = ["Yes", "No"] as const;
const INSURANCE_TYPES = ["Government", "Private", "Other"] as const;

type InsuranceTypeUi = (typeof INSURANCE_TYPES)[number];
type YesNo = (typeof YES_NO)[number];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Mongo or display id — questionnaire GET resolves both. */
  patientId: string;
  /** Mongo id required for insurance document upload. */
  mongoPatientId: string;
  onSaved?: () => void;
};

type StoredDocument = { uri: string; name: string; size: number };

function asField(v: unknown): QuestionnaireField {
  if (v && typeof v === "object") return v as QuestionnaireField;
  return { selectedValue: "", inputValue: "" };
}

function toYesNo(v: unknown): YesNo | "" {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "yes") return "Yes";
  if (s === "no") return "No";
  return "";
}

function parseInsuranceType(stored: string): InsuranceTypeUi | "" {
  const s = stored.trim().toLowerCase();
  if (s.includes("government")) return "Government";
  if (s.includes("private")) return "Private";
  if (s) return "Other";
  return "";
}

function typeLabel(
  ui: InsuranceTypeUi | "",
  otherType: string
): string {
  if (ui === "Government") return "Government Insurance";
  if (ui === "Private") return "Private Insurance";
  if (ui === "Other") return otherType.trim() || "Other";
  return "";
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
  const [openingDoc, setOpeningDoc] = useState(false);

  // Step 1
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [otherCondition, setOtherCondition] = useState("");
  const [hasSurgeries, setHasSurgeries] = useState<YesNo | "">("");
  const [surgeries, setSurgeries] = useState("");
  const [hasHospitalizations, setHasHospitalizations] = useState<YesNo | "">(
    ""
  );
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
  const [hasInsurance, setHasInsurance] = useState<YesNo | "">("");
  const [insuranceType, setInsuranceType] = useState<InsuranceTypeUi | "">("");
  const [otherInsuranceType, setOtherInsuranceType] = useState("");
  const [insuranceName, setInsuranceName] = useState("");
  const [insuranceNameOther, setInsuranceNameOther] = useState("");
  const [validTill, setValidTill] = useState("");
  /** Newly picked local file (upload on save). */
  const [localDocUri, setLocalDocUri] = useState<string | null>(null);
  const [localDocName, setLocalDocName] = useState<string | null>(null);
  const [localDocMime, setLocalDocMime] = useState("application/pdf");
  /** Already-persisted Spaces document from questionnaire JSON. */
  const [storedDocument, setStoredDocument] = useState<StoredDocument | null>(
    null
  );

  const hydrated = useMemo(() => existing.data, [existing.data]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setError(null);
    setBusy(false);
    setOpeningDoc(false);

    const mh = hydrated?.medicalHistory as Record<string, unknown> | undefined;
    const past = asField(mh?.pastConditions);
    const sel = past.selectedValue;
    setSelectedConditions(
      Array.isArray(sel) ? sel.map(String) : sel ? [String(sel)] : []
    );
    setOtherCondition(String(past.inputValue ?? ""));

    const surg = asField(mh?.surgeries);
    setHasSurgeries(toYesNo(surg.selectedValue));
    setSurgeries(String(surg.inputValue ?? ""));
    const hosp = asField(mh?.hospitalizations);
    setHasHospitalizations(toYesNo(hosp.selectedValue));
    setHospitalizations(String(hosp.inputValue ?? ""));

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
    setHasInsurance(toYesNo(insurance?.hasInsurance));
    const storedType = String(insurance?.type ?? "");
    const uiType = parseInsuranceType(storedType);
    setInsuranceType(uiType);
    setOtherInsuranceType(
      uiType === "Other"
        ? storedType === "Other"
          ? ""
          : storedType
        : String(insurance?.insuranceNameOther ?? "")
    );
    const name = String(insurance?.insuranceName ?? "");
    setInsuranceName(name);
    setInsuranceNameOther(
      name === "Other" ? String(insurance?.insuranceNameOther ?? "") : ""
    );
    const vt = insurance?.validTill;
    setValidTill(vt ? String(vt).slice(0, 10) : "");

    const doc = insurance?.document as Record<string, unknown> | undefined;
    const docUri = String(doc?.uri ?? "").trim();
    if (docUri) {
      setStoredDocument({
        uri: docUri,
        name: String(doc?.name ?? "insurance"),
        size: Number(doc?.size ?? 0) || 0,
      });
    } else {
      setStoredDocument(null);
    }
    setLocalDocUri(null);
    setLocalDocName(null);
  }, [open, hydrated]);

  const close = () => onOpenChange(false);

  const toggleCondition = (c: string) => {
    setSelectedConditions((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const insuranceNameOptions =
    insuranceType === "Government"
      ? GOVERNMENT_INSURANCE_NAMES
      : insuranceType === "Private"
        ? PRIVATE_INSURANCE_NAMES
        : null;

  const effectiveDocName =
    localDocName || storedDocument?.name || null;
  const hasAnyDocument = !!(localDocUri || storedDocument?.uri);

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
      setLocalDocUri(a.uri);
      setLocalDocName(a.name || "insurance");
      setLocalDocMime(a.mimeType || "application/pdf");
    } catch (e) {
      setError(describeError(e));
    }
  };

  const clearInsuranceDoc = () => {
    setLocalDocUri(null);
    setLocalDocName(null);
    setStoredDocument(null);
  };

  const viewInsuranceDoc = async () => {
    const url = storedDocument?.uri;
    if (!url || localDocUri) return;
    setError(null);
    setOpeningDoc(true);
    try {
      const { localUri } = await fetchProxiedFileToCache(url);
      await Linking.openURL(localUri);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setOpeningDoc(false);
    }
  };

  const saveStep = async () => {
    setError(null);
    if (!facilityId) {
      setError("Select a facility before saving the questionnaire.");
      return;
    }

    if (step === 3 && !hasInsurance) {
      setError("Please select whether the patient has health insurance.");
      return;
    }

    if (step === 3 && hasInsurance === "Yes") {
      if (!insuranceType) {
        setError("Insurance type is required when Yes is selected.");
        return;
      }
      if (!insuranceName.trim()) {
        setError("Insurance name is required when Yes is selected.");
        return;
      }
      if (insuranceName === "Other" && !insuranceNameOther.trim()) {
        setError("Please specify the other insurance name.");
        return;
      }
      if (!hasAnyDocument) {
        setError("Insurance document is required when Yes is selected.");
        return;
      }
    }

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
              selectedValue: hasSurgeries || (surgeries.trim() ? "Yes" : "No"),
              inputValue: surgeries.trim(),
            },
            hospitalizations: {
              selectedValue:
                hasHospitalizations ||
                (hospitalizations.trim() ? "Yes" : "No"),
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
        let document: StoredDocument | undefined;
        if (localDocUri && localDocName) {
          const uploaded = await uploadQuestionnaireDocument({
            patientId: mongoPatientId,
            uri: localDocUri,
            fileName: localDocName,
            mimeType: localDocMime,
            facilityId,
          });
          document = {
            uri: uploaded.url,
            name: uploaded.fileName || localDocName,
            size: 0,
          };
        } else if (storedDocument?.uri) {
          document = storedDocument;
        }

        const priorMh =
          (hydrated?.medicalHistory as Record<string, unknown> | null) ?? {};
        const nameValue =
          insuranceName === "Other"
            ? insuranceNameOther.trim() || "Other"
            : insuranceName.trim();

        await save.mutateAsync({
          stepNumber: 3,
          completed: true,
          stepData: {
            ...priorMh,
            pastConditions: {
              selectedValue: selectedConditions,
              inputValue: otherCondition.trim(),
              conditionDates:
                (asField(priorMh.pastConditions).conditionDates as
                  | Record<string, string>
                  | undefined) ?? {},
              otherConditionDate:
                String(asField(priorMh.pastConditions).otherConditionDate ?? ""),
            },
            surgeries: {
              selectedValue: hasSurgeries || (surgeries.trim() ? "Yes" : "No"),
              inputValue: surgeries.trim(),
            },
            hospitalizations: {
              selectedValue:
                hasHospitalizations ||
                (hospitalizations.trim() ? "Yes" : "No"),
              inputValue: hospitalizations.trim(),
            },
            insurance: {
              hasInsurance: hasInsurance === "Yes" ? "Yes" : "No",
              type:
                hasInsurance === "Yes"
                  ? typeLabel(insuranceType, otherInsuranceType)
                  : "",
              insuranceName: hasInsurance === "Yes" ? nameValue : "",
              insuranceNameOther:
                hasInsurance === "Yes" && insuranceName === "Other"
                  ? insuranceNameOther.trim()
                  : otherInsuranceType.trim(),
              validTill:
                hasInsurance === "Yes" && validTill.trim()
                  ? validTill.trim()
                  : null,
              ...(hasInsurance === "Yes" && document ? { document } : {}),
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
              <Text className="text-sm font-medium text-neutral-800">
                Surgeries
              </Text>
              <Segmented
                options={YES_NO}
                value={hasSurgeries}
                onChange={setHasSurgeries}
              />
              {hasSurgeries === "Yes" ? (
                <TextField
                  label="Surgery details"
                  value={surgeries}
                  onChangeText={setSurgeries}
                  placeholder="Details"
                />
              ) : null}
              <Text className="text-sm font-medium text-neutral-800">
                Hospitalizations
              </Text>
              <Segmented
                options={YES_NO}
                value={hasHospitalizations}
                onChange={setHasHospitalizations}
              />
              {hasHospitalizations === "Yes" ? (
                <TextField
                  label="Hospitalization details"
                  value={hospitalizations}
                  onChangeText={setHospitalizations}
                  placeholder="Details"
                />
              ) : null}
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
              <Text className="text-sm font-medium text-neutral-800">
                Do you have health insurance?
              </Text>
              <Segmented
                options={YES_NO}
                value={hasInsurance}
                onChange={(v) => {
                  setHasInsurance(v);
                  if (v === "No") {
                    setInsuranceType("");
                    setInsuranceName("");
                    setInsuranceNameOther("");
                    setOtherInsuranceType("");
                    setValidTill("");
                  }
                }}
              />
              {hasInsurance === "Yes" ? (
                <>
                  <Text className="text-sm font-medium text-neutral-800">
                    Type of insurance
                  </Text>
                  <Segmented
                    options={INSURANCE_TYPES}
                    value={insuranceType}
                    onChange={(v) => {
                      setInsuranceType(v);
                      setInsuranceName("");
                      setInsuranceNameOther("");
                    }}
                  />
                  {insuranceType === "Other" ? (
                    <TextField
                      label="Other type"
                      value={otherInsuranceType}
                      onChangeText={setOtherInsuranceType}
                    />
                  ) : null}
                  {insuranceNameOptions ? (
                    <>
                      <Text className="text-sm font-medium text-neutral-800">
                        Insurance name
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        {insuranceNameOptions.map((n) => {
                          const on = insuranceName === n;
                          return (
                            <Pressable
                              key={n}
                              onPress={() => setInsuranceName(n)}
                              className={`rounded-full px-3 py-1.5 ${
                                on ? "bg-brand" : "bg-neutral-100"
                              }`}
                            >
                              <Text
                                className={`text-xs font-medium ${
                                  on ? "text-white" : "text-neutral-700"
                                }`}
                              >
                                {n}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      {insuranceName === "Other" ? (
                        <TextField
                          label="Specify insurance name"
                          value={insuranceNameOther}
                          onChangeText={setInsuranceNameOther}
                        />
                      ) : null}
                    </>
                  ) : insuranceType === "Other" ? (
                    <TextField
                      label="Insurance name"
                      value={insuranceName}
                      onChangeText={setInsuranceName}
                    />
                  ) : null}
                  <DateField
                    label="Valid till"
                    value={validTill}
                    onChange={setValidTill}
                    placeholder="Select date"
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
                      {effectiveDocName ||
                        "Attach insurance document (required)"}
                    </Text>
                  </Pressable>
                  {hasAnyDocument ? (
                    <View className="flex-row gap-2">
                      {storedDocument?.uri && !localDocUri ? (
                        <Button
                          label={openingDoc ? "Opening…" : "View"}
                          variant="outline"
                          className="flex-1"
                          disabled={openingDoc || busy}
                          onPress={() => void viewInsuranceDoc()}
                        />
                      ) : null}
                      <Button
                        label="Remove"
                        variant="outline"
                        className="flex-1"
                        disabled={busy}
                        onPress={clearInsuranceDoc}
                      />
                    </View>
                  ) : null}
                  {openingDoc ? (
                    <ActivityIndicator color="#FD006A" />
                  ) : null}
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
                onPress={() =>
                  setStep((s) => (s === 1 ? 1 : ((s - 1) as 1 | 2 | 3)))
                }
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
