import * as DocumentPicker from "expo-document-picker";
import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { useQueryClient } from "@tanstack/react-query";

import { useCardFocusHighlight } from "@/features/consult/useCardFocusHighlight";
import type { DrugCatalogItem } from "@/lib/api/endpoints/drugs";
import { ApiError, describeError, isConsultCompletedLock } from "@/lib/api/errors";
import { useFacilityId } from "@/lib/auth/store";
import { AppModal, Button, Segmented, TextField } from "@/ui";

import { formatAllergyMatchSummaryLine } from "../allergy";
import {
  filterDrugCatalog,
  useAttachPrescription,
  usePatchRxAttachments,
  usePrescriptionTemplates,
  useSaveTemplate,
} from "../hooks/usePrescriptionDraft";
import type {
  AllergyWarning,
  AttachedRxImage,
  PlanPrescription,
} from "../types";
import {
  dosePatternAfterCatalogDrugPick,
  validatePrescriptionItem,
} from "../validation";
import { QuickAddDrugDialog } from "./QuickAddDrugDialog";

const TIMING = ["BF", "AF"] as const;

export function PrescriptionCard({
  consultationId,
  prescriptions,
  onAdd,
  onRemove,
  onApplyTemplate,
  attachedImages,
  onAttachedImagesChange,
  allergyWarnings,
  allergyOverrideAck,
  onAllergyOverrideChange,
  drugs,
  tabletLayout = false,
  locked = false,
}: {
  consultationId: string;
  prescriptions: PlanPrescription[];
  onAdd: (item: Omit<PlanPrescription, "id"> & { id?: string }) => void;
  onRemove: (id: string) => void;
  onApplyTemplate: (
    meds: Array<{
      name: string;
      dosePattern: string;
      foodTiming: string;
      duration: string;
    }>
  ) => void;
  attachedImages: AttachedRxImage[];
  onAttachedImagesChange: (images: AttachedRxImage[]) => void;
  allergyWarnings: AllergyWarning[];
  allergyOverrideAck: boolean;
  onAllergyOverrideChange: (ack: boolean) => void;
  drugs: DrugCatalogItem[];
  /** Wider table / toolbar layout for tablets */
  tabletLayout?: boolean;
  locked?: boolean;
}) {
  const { highlighted, onFocus, onBlur } = useCardFocusHighlight();
  const facilityId = useFacilityId();
  const qc = useQueryClient();
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  return (
    <View
      className={`w-full gap-4 rounded-2xl border bg-white p-5 ${
        highlighted ? "border-brand" : "border-neutral-200"
      }`}
    >
      <View
        className={
          tabletLayout
            ? "flex-row flex-wrap items-start justify-between gap-3"
            : "gap-3"
        }
      >
        <View className="gap-0.5">
          <Text className="text-lg font-semibold text-brand">
            Prescription
          </Text>
          <Text className="text-xs text-neutral-500">
            {prescriptions.length === 0
              ? "Add medicines for this visit"
              : `${prescriptions.length} medicine${prescriptions.length === 1 ? "" : "s"}`}
          </Text>
        </View>

        <View
          className={
            tabletLayout
              ? "max-w-full flex-1 flex-row flex-wrap items-center justify-end gap-2"
              : "gap-2"
          }
        >
          <TemplateBar
            consultationId={consultationId}
            prescriptions={prescriptions}
            hasAttachments={attachedImages.length > 0}
            onApply={onApplyTemplate}
            compact={tabletLayout}
            locked={locked}
          />
          {facilityId ? (
            <Button
              label="+ Add medicine"
              variant="outline"
              size="md"
              disabled={locked}
              onPress={() => setQuickAddOpen(true)}
              className="h-12 justify-center"
            />
          ) : null}
          <AttachBar
            consultationId={consultationId}
            attachedImages={attachedImages}
            onAttachedImagesChange={onAttachedImagesChange}
            compact={tabletLayout}
            locked={locked}
          />
        </View>
      </View>

      {facilityId ? (
        <QuickAddDrugDialog
          open={quickAddOpen}
          onClose={() => setQuickAddOpen(false)}
          onCreated={() => {
            void qc.invalidateQueries({ queryKey: ["drug-catalog"] });
          }}
        />
      ) : null}

      {allergyWarnings.length > 0 ? (
        <View className="gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <Text className="text-sm font-semibold text-amber-900">
            Allergy warnings
          </Text>
          {allergyWarnings.map((w, i) => (
            <Text key={`${w.drug}-${i}`} className="text-xs text-amber-800">
              {formatAllergyMatchSummaryLine(w)}
            </Text>
          ))}
          <Pressable
            onPress={() => onAllergyOverrideChange(!allergyOverrideAck)}
            disabled={locked}
            className="mt-1 flex-row items-center gap-2"
          >
            <View
              className={`h-5 w-5 items-center justify-center rounded border ${
                allergyOverrideAck
                  ? "border-brand bg-brand"
                  : "border-neutral-400 bg-white"
              }`}
            >
              {allergyOverrideAck ? (
                <Text className="text-[10px] font-bold text-white">✓</Text>
              ) : null}
            </View>
            <Text className="flex-1 text-xs text-amber-900">
              I acknowledge these allergies and want to proceed
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Medicine table */}
      <View className="overflow-hidden rounded-xl border border-neutral-200">
        {tabletLayout ? (
          <View className="flex-row border-b border-neutral-200 bg-neutral-50 px-3 py-2.5">
            <Text className="flex-[2.2] text-xs font-semibold uppercase tracking-wide text-brand">
              Medicine
            </Text>
            <Text className="flex-[1.1] text-xs font-semibold uppercase tracking-wide text-brand">
              Dose
            </Text>
            <Text className="w-14 text-xs font-semibold uppercase tracking-wide text-brand">
              Food
            </Text>
            <Text className="w-14 text-xs font-semibold uppercase tracking-wide text-brand">
              Days
            </Text>
            <View className="w-9" />
          </View>
        ) : null}

        {prescriptions.length === 0 ? (
          <View className="px-4 py-8">
            <Text className="text-center text-sm text-neutral-400">
              No medicines added yet.
            </Text>
          </View>
        ) : (
          <View>
            {prescriptions.map((l, idx) =>
              tabletLayout ? (
                <View
                  key={l.id}
                  className={`flex-row items-center px-3 py-3 ${
                    idx < prescriptions.length - 1
                      ? "border-b border-neutral-100"
                      : ""
                  }`}
                >
                  <Text
                    className="flex-[2.2] pr-2 text-sm font-semibold text-neutral-900"
                    numberOfLines={2}
                  >
                    {l.name}
                  </Text>
                  <Text className="flex-[1.1] text-sm text-neutral-700">
                    {l.dosePattern}
                  </Text>
                  <Text className="w-14 text-sm text-neutral-700">
                    {l.foodTiming}
                  </Text>
                  <Text className="w-14 text-sm text-neutral-700">
                    {l.duration}
                  </Text>
                  <Pressable
                    onPress={() => onRemove(l.id)}
                    disabled={locked}
                    className={`h-9 w-9 items-center justify-center rounded-full ${
                      locked ? "opacity-40" : "active:bg-neutral-100"
                    }`}
                  >
                    <Text className="text-red-500">✕</Text>
                  </Pressable>
                </View>
              ) : (
                <View
                  key={l.id}
                  className={`flex-row items-center gap-3 px-3 py-2.5 ${
                    idx < prescriptions.length - 1
                      ? "border-b border-neutral-100"
                      : ""
                  }`}
                >
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-neutral-900">
                      {l.name}
                    </Text>
                    <Text className="text-xs text-neutral-500">
                      {[
                        l.dosePattern,
                        l.foodTiming,
                        l.duration ? `${l.duration} days` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => onRemove(l.id)}
                    disabled={locked}
                    className={`h-8 w-8 items-center justify-center rounded-full ${
                      locked ? "opacity-40" : "active:bg-neutral-100"
                    }`}
                  >
                    <Text className="text-red-500">✕</Text>
                  </Pressable>
                </View>
              )
            )}
          </View>
        )}
      </View>

      <AddMedicineForm
        existingNames={prescriptions.map((p) => p.name)}
        onAdd={onAdd}
        drugs={drugs}
        tabletLayout={tabletLayout}
        onFieldFocus={() => onFocus(undefined as never)}
        onFieldBlur={() => onBlur(undefined as never)}
        locked={locked}
      />
    </View>
  );
}

function AddMedicineForm({
  existingNames,
  onAdd,
  drugs,
  tabletLayout = false,
  onFieldFocus,
  onFieldBlur,
  locked = false,
}: {
  existingNames: string[];
  onAdd: (item: Omit<PlanPrescription, "id"> & { id?: string }) => void;
  drugs: DrugCatalogItem[];
  tabletLayout?: boolean;
  onFieldFocus?: () => void;
  onFieldBlur?: () => void;
  locked?: boolean;
}) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("1-0-1");
  const [timing, setTiming] = useState<(typeof TIMING)[number]>("AF");
  const [duration, setDuration] = useState("5");
  const [drugId, setDrugId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [showHints, setShowHints] = useState(false);

  const hints = useMemo(
    () => filterDrugCatalog(drugs, name),
    [drugs, name]
  );

  const canAdd = name.trim().length > 0;

  const pickDrug = (d: DrugCatalogItem) => {
    const brand = (d.brandName ?? "").trim() || (d.genericName ?? "").trim();
    setName(brand);
    setDrugId(d.id);
    setDose(dosePatternAfterCatalogDrugPick(dose, d.dosageForm));
    setShowHints(false);
    setError(null);
  };

  const onSave = () => {
    if (locked || !canAdd) return;
    setError(null);
    const duplicate = existingNames.some(
      (n) => n.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (duplicate) {
      setError("This medicine is already on the prescription.");
      return;
    }
    const err = validatePrescriptionItem({
      name: name.trim(),
      dosePattern: dose.trim(),
      foodTiming: timing,
      duration: duration.trim(),
    });
    if (err) {
      setError(err);
      return;
    }
    onAdd({
      name: name.trim(),
      dosePattern: dose.trim(),
      foodTiming: timing,
      duration: duration.trim(),
      drugId,
    });
    setName("");
    setDose("1-0-1");
    setTiming("AF");
    setDuration("5");
    setDrugId(undefined);
    setShowHints(false);
  };

  const medicineHints = showHints && hints.length > 0 ? (
    <View className="mt-1 max-h-40 overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        {hints.map((d) => (
          <Pressable
            key={d.id}
            onPress={() => pickDrug(d)}
            className="border-b border-neutral-100 px-3 py-2 active:bg-neutral-50"
          >
            <Text className="text-sm font-medium text-neutral-900">
              {d.brandName || d.genericName}
            </Text>
            <Text className="text-xs text-neutral-500">
              {[d.genericName, d.dosageForm, d.strength]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  ) : null;

  const medicineField = (
    <TextField
      label="Medicine"
      labelClassName="text-brand"
      value={name}
      onChangeText={(v) => {
        setName(v);
        setDrugId(undefined);
        setShowHints(true);
      }}
      onFocus={() => {
        setShowHints(true);
        onFieldFocus?.();
      }}
      onBlur={onFieldBlur}
      onPressIn={() => setShowHints(true)}
      placeholder="Tap to pick medicine"
    />
  );

  const addButton = (
    <Button
      label={tabletLayout ? "Add" : "Add to prescription"}
      size="md"
      variant="primary"
      onPress={onSave}
      disabled={!canAdd || locked}
      className="h-12 min-h-[48px] justify-center py-0"
      style={{ height: 48 }}
    />
  );

  return (
    <View
      className={`gap-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/80 p-4 ${
        locked ? "opacity-50" : ""
      }`}
      pointerEvents={locked ? "none" : "auto"}
    >
      <Text className="text-sm font-semibold text-brand">
        Add medicine
      </Text>

      {tabletLayout ? (
        <View className="gap-1">
          <View className="flex-row items-end gap-3">
            <View className="min-w-0 flex-[2] gap-1.5">
              <Text className="text-sm font-medium text-brand">
                Medicine
              </Text>
              <TextField
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  setDrugId(undefined);
                  setShowHints(true);
                }}
                onFocus={() => {
                  setShowHints(true);
                  onFieldFocus?.();
                }}
                onBlur={onFieldBlur}
                onPressIn={() => setShowHints(true)}
                placeholder="Tap to pick medicine"
              />
            </View>
            <View className="w-28 gap-1.5">
              <Text className="text-sm font-medium text-brand">Dose</Text>
              <TextField
                value={dose}
                onChangeText={setDose}
                placeholder="1-0-1"
                onFocus={onFieldFocus}
                onBlur={onFieldBlur}
              />
            </View>
            <View className="w-36 gap-1.5">
              <Text className="text-sm font-medium text-brand">Food</Text>
              <Segmented options={TIMING} value={timing} onChange={setTiming} />
            </View>
            <View className="w-20 gap-1.5">
              <Text className="text-sm font-medium text-brand">Days</Text>
              <TextField
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
                placeholder="5"
                onFocus={onFieldFocus}
                onBlur={onFieldBlur}
              />
            </View>
            <View className="gap-1.5">
              <Text className="text-sm font-medium text-transparent">Add</Text>
              {addButton}
            </View>
          </View>
          {medicineHints}
        </View>
      ) : (
        <>
          <View>
            {medicineField}
            {medicineHints}
          </View>

          <View className="flex-row gap-3">
            <TextField
              containerClassName="flex-1"
              label="Dose (M-A-N)"
              labelClassName="text-brand"
              value={dose}
              onChangeText={setDose}
              placeholder="1-0-1"
              onFocus={onFieldFocus}
              onBlur={onFieldBlur}
            />
            <TextField
              containerClassName="flex-1"
              label="Duration (days)"
              labelClassName="text-brand"
              value={duration}
              onChangeText={setDuration}
              keyboardType="number-pad"
              placeholder="5"
              onFocus={onFieldFocus}
              onBlur={onFieldBlur}
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-brand">Food</Text>
            <Segmented options={TIMING} value={timing} onChange={setTiming} />
          </View>

          {addButton}
        </>
      )}

      {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
    </View>
  );
}

function TemplateBar({
  consultationId,
  prescriptions,
  hasAttachments,
  onApply,
  compact = false,
  locked = false,
}: {
  consultationId: string;
  prescriptions: PlanPrescription[];
  hasAttachments: boolean;
  onApply: (
    meds: Array<{
      name: string;
      dosePattern: string;
      foodTiming: string;
      duration: string;
    }>
  ) => void;
  compact?: boolean;
  locked?: boolean;
}) {
  const templatesQ = usePrescriptionTemplates(consultationId);
  const saveTpl = useSaveTemplate(consultationId);
  const [selected, setSelected] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [mode, setMode] = useState<"create" | "update">("create");
  const [error, setError] = useState<string | null>(null);

  const templates = templatesQ.data ?? [];
  const disabled = locked || hasAttachments || prescriptions.length === 0;

  const medsPayload = () =>
    prescriptions.map((p) => ({
      name: p.name,
      dosePattern: p.dosePattern,
      foodTiming: String(p.foodTiming),
      duration: String(p.duration),
    }));

  const applySelected = (name: string) => {
    if (locked) return;
    setSelected(name);
    setPickerOpen(false);
    if (!name) return;
    const tpl = templates.find((t) => t.templateName === name);
    if (tpl?.medications?.length) {
      onApply(tpl.medications);
    }
  };

  const runSave = async () => {
    setError(null);
    const name = templateName.trim();
    if (!name) {
      setError("Template name is required.");
      return;
    }
    if (name.startsWith("__dx__")) {
      setError("Invalid template name.");
      return;
    }
    try {
      await saveTpl.mutateAsync({
        templateName: name,
        medications: medsPayload(),
        mode,
      });
      setNameOpen(false);
      setSelected(name);
    } catch (e) {
      if (isConsultCompletedLock(e)) {
        setError(describeError(e));
        return;
      }
      if (e instanceof ApiError && e.status === 409) {
        Alert.alert(
          "Template exists",
          "A template with this name already exists. Update it?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Update",
              onPress: () => {
                setMode("update");
                void (async () => {
                  try {
                    await saveTpl.mutateAsync({
                      templateName: name,
                      medications: medsPayload(),
                      mode: "update",
                    });
                    setNameOpen(false);
                    setSelected(name);
                  } catch (err) {
                    setError(describeError(err));
                  }
                })();
              },
            },
          ]
        );
        return;
      }
      setError(describeError(e));
    }
  };

  return (
    <View className={compact ? "flex-row flex-wrap items-center gap-2" : "gap-2"}>
      <Pressable
        onPress={() => setPickerOpen(true)}
        disabled={locked}
        className={`h-12 justify-center rounded-xl border border-neutral-300 bg-white px-3 ${
          compact ? "min-w-[160px]" : "flex-1"
        } ${locked ? "opacity-50" : ""}`}
      >
        <Text className="text-sm text-neutral-700" numberOfLines={1}>
          {selected || "No template selected"}
        </Text>
      </Pressable>
      <Pressable
        disabled={disabled}
        onPress={() => {
          setMode("create");
          setTemplateName(selected);
          setNameOpen(true);
        }}
        className={`h-12 justify-center rounded-xl px-3 ${
          disabled
            ? "bg-brand opacity-40"
            : "bg-brand active:bg-brand-600"
        }`}
      >
        <Text className="text-sm font-semibold text-white">
          Save template
        </Text>
      </Pressable>
      {selected ? (
        <Pressable
          disabled={disabled}
          onPress={() => {
            setMode("update");
            setTemplateName(selected);
            setNameOpen(true);
          }}
          className={`h-12 justify-center rounded-xl px-3 ${
            disabled
              ? "bg-brand opacity-40"
              : "bg-brand active:bg-brand-600"
          }`}
        >
          <Text className="text-sm font-semibold text-white">Update</Text>
        </Pressable>
      ) : null}
      {!compact && hasAttachments ? (
        <Text className="text-xs text-neutral-500">
          Templates disabled while prescription images are attached.
        </Text>
      ) : null}

      <AppModal
        visible={pickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View className="flex-1 bg-white px-5 pt-4">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-semibold">Templates</Text>
            <Pressable onPress={() => setPickerOpen(false)}>
              <Text className="text-brand">Close</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => applySelected("")}
            className="border-b border-neutral-100 py-3"
          >
            <Text className="text-sm text-neutral-500">
              No template selected
            </Text>
          </Pressable>
          <ScrollView>
            {templates.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => applySelected(t.templateName)}
                className="border-b border-neutral-100 py-3"
              >
                <Text className="text-sm font-medium text-neutral-900">
                  {t.templateName}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </AppModal>

      <AppModal
        visible={nameOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setNameOpen(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full max-w-md gap-3 rounded-2xl bg-white p-5">
            <Text className="text-base font-semibold text-neutral-900">
              {mode === "create" ? "Save template" : "Update template"}
            </Text>
            <TextField
              label="Template name"
              value={templateName}
              onChangeText={setTemplateName}
              placeholder="e.g. Common fever"
            />
            {error ? (
              <Text className="text-sm text-red-500">{error}</Text>
            ) : null}
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button
                  label="Cancel"
                  variant="primary"
                  size="md"
                  onPress={() => setNameOpen(false)}
                />
              </View>
              <View className="flex-1">
                <Button
                  label={mode === "create" ? "Save" : "Update"}
                  size="md"
                  loading={saveTpl.isPending}
                  onPress={runSave}
                />
              </View>
            </View>
          </View>
        </View>
      </AppModal>
    </View>
  );
}

function AttachBar({
  consultationId,
  attachedImages,
  onAttachedImagesChange,
  compact = false,
  locked = false,
}: {
  consultationId: string;
  attachedImages: AttachedRxImage[];
  onAttachedImagesChange: (images: AttachedRxImage[]) => void;
  compact?: boolean;
  locked?: boolean;
}) {
  const upload = useAttachPrescription(consultationId);
  const patch = usePatchRxAttachments(consultationId);
  const [error, setError] = useState<string | null>(null);

  const onPick = async () => {
    if (locked) return;
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*"],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const files = result.assets.map((a) => ({
        uri: a.uri,
        name: a.name || "prescription.jpg",
        mimeType: a.mimeType || "image/jpeg",
      }));
      const urls = await upload.mutateAsync(files);
      const merged = [...attachedImages.map((i) => i.url), ...urls].filter(
        Boolean
      );
      await patch.mutateAsync(merged);
      onAttachedImagesChange(
        merged.map((url, i) => ({
          id: `att-${i}-${url.slice(-12)}`,
          url,
        }))
      );
    } catch (e) {
      setError(describeError(e));
    }
  };

  const onRemove = async (id: string) => {
    setError(null);
    try {
      const next = attachedImages.filter((i) => i.id !== id);
      const urls = next.map((i) => i.url).filter(Boolean);
      await patch.mutateAsync(urls);
      onAttachedImagesChange(next);
    } catch (e) {
      setError(describeError(e));
    }
  };

  return (
    <View className={compact ? "flex-row flex-wrap items-center gap-2" : "gap-2"}>
      <Button
        label="Attach"
        variant="primary"
        size="md"
        onPress={onPick}
        loading={upload.isPending || patch.isPending}
        disabled={locked}
        className="h-12 justify-center"
      />
      {attachedImages.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {attachedImages.map((img) => (
            <View
              key={img.id}
              className="flex-row items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1"
            >
              <Text
                className="max-w-[120px] text-xs text-neutral-600"
                numberOfLines={1}
              >
                {img.url.split("/").pop() || "image"}
              </Text>
              <Pressable
                onPress={() => void onRemove(img.id)}
                disabled={locked}
              >
                <Text className="text-red-500">✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
    </View>
  );
}
