import * as DocumentPicker from "expo-document-picker";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useQueryClient } from "@tanstack/react-query";

import { ApiError, describeError, isConsultCompletedLock } from "@/lib/api/errors";
import { useFacilityId } from "@/lib/auth/store";
import { AppModal, Button, TextField } from "@/ui";

import {
  allergyWarningSubtitleParts,
  formatAllergyMatchSummaryLine,
} from "../allergy";
import {
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
import { QuickAddDrugDialog } from "./QuickAddDrugDialog";
import { PrescriptionEditor } from "./regimen/PrescriptionEditor";
import { AppAlert } from "@/ui/AppAlert";

export function PrescriptionCard({
  consultationId,
  prescriptions,
  onAdd,
  onRemove,
  onUpdate,
  onApplyTemplate,
  attachedImages,
  onAttachedImagesChange,
  allergyWarnings,
  allergyOverrideAck,
  onAllergyOverrideChange,
  patientAgeYears,
  tabletLayout = false,
  locked = false,
}: {
  consultationId: string;
  prescriptions: PlanPrescription[];
  onAdd: (item: Omit<PlanPrescription, "id"> & { id?: string }) => void;
  onRemove: (id: string) => void;
  onUpdate: (items: PlanPrescription[]) => void;
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
  /** Whole years, or null when unknown. Drives the child dose check. */
  patientAgeYears?: number | null;
  /** Wider toolbar layout for tablets */
  tabletLayout?: boolean;
  locked?: boolean;
}) {
  const facilityId = useFacilityId();
  const qc = useQueryClient();
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  return (
    <View className="w-full gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
      <View className="flex-row flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
        <View className="flex-row items-center gap-2">
          <Ionicons name="clipboard-outline" size={20} color="#FD006A" />
          <Text className="text-lg font-semibold text-brand">Prescription</Text>
        </View>
        <AttachBar
          consultationId={consultationId}
          attachedImages={attachedImages}
          onAttachedImagesChange={onAttachedImagesChange}
          compact={tabletLayout}
          locked={locked}
        />
      </View>

      {allergyWarnings.length > 0 ? (
        <View className="gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <View className="flex-row items-center gap-2">
            <Ionicons name="warning-outline" size={20} color="#dc2626" />
            <Text className="text-sm font-semibold text-neutral-900">
              Allergy Detected
            </Text>
          </View>
          {allergyWarnings.map((w, i) => (
            <View
              key={`${w.drug}-${w.allergenName}-${i}`}
              className="gap-1 rounded-lg border border-red-100 bg-white px-2.5 py-2"
            >
              <Text className="text-sm font-medium text-neutral-900">
                {formatAllergyMatchSummaryLine(w)}
              </Text>
              {allergyWarningSubtitleParts(w).length > 0 ? (
                <View className="flex-row flex-wrap gap-x-3 gap-y-1">
                  {allergyWarningSubtitleParts(w).map((d) => (
                    <Text key={d.label} className="text-xs text-neutral-500">
                      <Text className="font-medium text-neutral-700">
                        {d.label}:
                      </Text>{" "}
                      {d.value}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
          <Pressable
            onPress={() => onAllergyOverrideChange(!allergyOverrideAck)}
            disabled={locked}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allergyOverrideAck }}
            className="flex-row items-center gap-2 border-t border-red-100 pt-2.5"
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
            <Text className="flex-1 text-sm font-medium text-neutral-900">
              Acknowledge
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* A locked consult keeps the list readable and withdraws this toolbar:
          applying a template replaces the medicines. */}
      {!locked ? (
        <View className="flex-row flex-wrap items-center justify-end gap-2 rounded-xl bg-brand-50 p-3">
          <TemplateBar
            consultationId={consultationId}
            prescriptions={prescriptions}
            hasAttachments={attachedImages.length > 0}
            onApply={onApplyTemplate}
            compact={tabletLayout}
            beforeSave={
              facilityId ? (
                <Pressable
                  onPress={() => setQuickAddOpen(true)}
                  style={{ flexShrink: 0 }}
                  className="h-12 flex-row items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3 active:bg-neutral-50"
                >
                  <Ionicons name="add" size={16} color="#111827" />
                  <Text
                    numberOfLines={1}
                    className="text-sm font-semibold text-neutral-900"
                  >
                    Add medicine
                  </Text>
                </Pressable>
              ) : null
            }
          />
        </View>
      ) : null}

      {facilityId ? (
        <QuickAddDrugDialog
          open={quickAddOpen}
          onClose={() => setQuickAddOpen(false)}
          onCreated={() => {
            // Findable in the picker at once. Not auto-added, as on the web: from
            // here the doctor has not started a row yet.
            void qc.invalidateQueries({ queryKey: ["drug-catalog"] });
          }}
        />
      ) : null}

      <PrescriptionEditor
        prescriptions={prescriptions}
        onAdd={onAdd}
        onRemove={onRemove}
        onUpdate={onUpdate}
        facilityId={facilityId ?? ""}
        consultationId={consultationId}
        readOnly={locked}
        patientAgeYears={patientAgeYears}
      />
    </View>
  );
}

function TemplateBar({
  consultationId,
  prescriptions,
  hasAttachments,
  onApply,
  compact = false,
  beforeSave,
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
  /** Sits between the template picker and Save Template, as on the web. */
  beforeSave?: ReactNode;
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
  const disabled = hasAttachments || prescriptions.length === 0;

  const medsPayload = () =>
    prescriptions.map((p) => ({
      name: p.name,
      dosePattern: p.dosePattern,
      foodTiming: String(p.foodTiming),
      duration: String(p.duration),
    }));

  const applySelected = (name: string) => {
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
        AppAlert.alert(
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
        disabled={hasAttachments}
        className={`h-12 flex-row items-center justify-between gap-2 rounded-xl border border-neutral-300 bg-white px-3 ${
          compact ? "min-w-[280px]" : "flex-1"
        } ${hasAttachments ? "opacity-50" : ""}`}
      >
        <Text className="shrink text-sm text-neutral-700" numberOfLines={1}>
          {selected || "Select template to auto-fill medications"}
        </Text>
        <Ionicons name="swap-vertical" size={14} color="#9ca3af" />
      </Pressable>
      {beforeSave}
      <Pressable
        disabled={disabled}
        style={{ flexShrink: 0 }}
        onPress={() => {
          setMode(selected ? "update" : "create");
          setTemplateName(selected);
          setNameOpen(true);
        }}
        className={`h-12 flex-row items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3 ${
          disabled ? "opacity-40" : "active:bg-neutral-50"
        }`}
      >
        <Ionicons name="save-outline" size={16} color="#111827" />
        <Text
          numberOfLines={1}
          className="text-sm font-semibold text-neutral-900"
        >
          {selected ? "Update Template" : "Save Template"}
        </Text>
      </Pressable>
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
      {!locked ? (
        <Pressable
          onPress={onPick}
          disabled={upload.isPending || patch.isPending}
          style={{ flexShrink: 0 }}
          className="h-11 flex-row items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3 active:bg-brand-50"
        >
          {upload.isPending || patch.isPending ? (
            <ActivityIndicator size="small" color="#FD006A" />
          ) : (
            <Ionicons name="attach-outline" size={18} color="#FD006A" />
          )}
          <Text numberOfLines={1} className="text-sm font-semibold text-brand">
            Attach Prescription
          </Text>
        </Pressable>
      ) : null}
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
