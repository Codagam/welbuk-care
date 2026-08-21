import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { DEFAULT_DOSAGE_TYPES, type QuickAddedDrug } from "@/lib/api/endpoints/drugs";
import { describeError } from "@/lib/api/errors";
import { AppModal, Button, TextField } from "@/ui";

import {
  useDrugCatalogOptions,
  useQuickAddDrug,
} from "../hooks/usePrescriptionDraft";

export function QuickAddDrugDialog({
  open,
  onClose,
  initialName = "",
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** Prefill brand from typeahead text when opened from search empty-state. */
  initialName?: string;
  onCreated: (drug: QuickAddedDrug, alreadyExisted?: boolean) => void;
}) {
  const optionsQ = useDrugCatalogOptions(open);
  const save = useQuickAddDrug();

  const [brandName, setBrandName] = useState("");
  const [genericName, setGenericName] = useState("");
  const [dosageForm, setDosageForm] = useState("");
  const [strength, setStrength] = useState("");
  const [category, setCategory] = useState("");
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBrandName(initialName.trim());
    setGenericName("");
    setDosageForm("");
    setStrength("");
    setCategory("");
    setError(null);
  }, [open, initialName]);

  const dosageOptions =
    optionsQ.data && optionsQ.data.length > 0
      ? optionsQ.data
      : [...DEFAULT_DOSAGE_TYPES];

  const ready =
    brandName.trim() &&
    genericName.trim() &&
    dosageForm.trim() &&
    strength.trim();

  const onSubmit = async () => {
    if (!ready || save.isPending) return;
    setError(null);
    try {
      const out = await save.mutateAsync({
        brandName,
        genericName,
        dosageForm,
        strength,
        category: category || undefined,
      });
      Alert.alert(
        out.alreadyExisted ? "Already in catalogue" : "Medicine added",
        out.alreadyExisted
          ? "Already in the catalogue — selected"
          : "Added — the pharmacy has been asked to stock it"
      );
      onCreated(out.drug, out.alreadyExisted);
      onClose();
    } catch (e) {
      setError(describeError(e));
    }
  };

  return (
    <>
      <AppModal
        visible={open}
        animationType="fade"
        transparent
        onRequestClose={onClose}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-5">
          <View className="w-full max-w-lg gap-3 rounded-2xl bg-white p-5">
            <Text className="text-lg font-semibold text-neutral-900">
              Add a medicine
            </Text>
            <Text className="text-sm text-neutral-500">
              Just enough to prescribe it. The pharmacy completes the record and
              stocks it.
            </Text>

            <View className="flex-row gap-3">
              <TextField
                containerClassName="flex-1"
                label="Brand name *"
                value={brandName}
                onChangeText={setBrandName}
                placeholder="e.g. Amoxil 500 Capsule"
                autoFocus
              />
              <TextField
                containerClassName="flex-1"
                label="Generic name *"
                value={genericName}
                onChangeText={setGenericName}
                placeholder="e.g. Amoxicillin"
              />
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1 gap-1.5">
                <Text className="text-sm font-medium text-neutral-700">
                  Type *
                </Text>
                <Pressable
                  onPress={() => setTypePickerOpen(true)}
                  className="h-12 justify-center rounded-xl border border-neutral-300 bg-white px-4"
                >
                  <Text
                    className={
                      dosageForm
                        ? "text-base text-neutral-900"
                        : "text-base text-neutral-400"
                    }
                    numberOfLines={1}
                  >
                    {dosageForm || "Tablet, Syrup…"}
                  </Text>
                </Pressable>
              </View>
              <TextField
                containerClassName="flex-1"
                label="Strength *"
                value={strength}
                onChangeText={setStrength}
                placeholder="e.g. 500mg"
              />
            </View>

            <TextField
              label="Category (optional)"
              value={category}
              onChangeText={setCategory}
              placeholder="e.g. Antibiotic"
            />

            <View className="rounded-lg bg-neutral-100 px-3 py-2">
              <Text className="text-xs text-neutral-600">
                This goes to the pharmacy to be stocked and completed — price,
                GST and pack size are added there. It can be prescribed straight
                away, but cannot be dispensed until stock is received.
              </Text>
            </View>

            {error ? (
              <Text className="text-sm text-red-500">{error}</Text>
            ) : null}

            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button
                  label={save.isPending ? "Adding…" : "Add and use"}
                  size="md"
                  loading={save.isPending}
                  disabled={!ready}
                  onPress={() => void onSubmit()}
                />
              </View>
              <View className="flex-1">
                <Button
                  label="Cancel"
                  variant="outline"
                  size="md"
                  onPress={onClose}
                />
              </View>
            </View>
          </View>
        </View>
      </AppModal>

      <AppModal
        visible={typePickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setTypePickerOpen(false)}
      >
        <View className="flex-1 bg-white px-5 pt-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-semibold">Dosage type</Text>
            <Pressable onPress={() => setTypePickerOpen(false)}>
              <Text className="text-brand">Close</Text>
            </Pressable>
          </View>
          <TextField
            label="Or type a custom form"
            value={dosageForm}
            onChangeText={setDosageForm}
            placeholder="e.g. Nebulizer"
          />
          <ScrollView className="mt-3" keyboardShouldPersistTaps="handled">
            {dosageOptions.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => {
                  setDosageForm(opt);
                  setTypePickerOpen(false);
                }}
                className="border-b border-neutral-100 py-3"
              >
                <Text className="text-sm text-neutral-900">{opt}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View className="pb-6 pt-2">
            <Button
              label="Use typed value"
              size="md"
              disabled={!dosageForm.trim()}
              onPress={() => setTypePickerOpen(false)}
            />
          </View>
        </View>
      </AppModal>
    </>
  );
}
