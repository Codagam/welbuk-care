import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";

import { fetchAllDiagnosisTypes } from "@/lib/api/endpoints/dental";
import type { DiagnosisOption } from "../types";
import { slugFromLabel, uniqueValueFromSlug } from "../utils";

type Props = {
  selectedValues: string[];
  selectedLabels?: string[];
  onSelect: (option: DiagnosisOption) => void;
  consultationType?: string;
  placeholder?: string;
  disabled?: boolean;
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * Mirrors Practice DiagnosisTypesAutocomplete: catalog search dropdown +
 * local-only custom add when no match (never POSTs diagnosis-types).
 */
export function DiagnosisTypesAutocomplete({
  selectedValues,
  selectedLabels,
  onSelect,
  consultationType = "dental",
  placeholder = "Search or type…",
  disabled = false,
}: Props) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const debouncedSearch = useDebounce(inputValue, 300);
  const trimmedDebounced = debouncedSearch.trim();
  const trimmedInput = inputValue.trim();
  const isTypingAhead =
    !disabled && trimmedInput.length > 0 && trimmedInput !== trimmedDebounced;

  const { data: suggestions = [], isFetching, isPending } = useQuery({
    queryKey: [
      "diagnosis-types-autocomplete",
      trimmedDebounced,
      consultationType,
    ],
    queryFn: () => fetchAllDiagnosisTypes(trimmedDebounced, consultationType),
    enabled: !disabled && isOpen,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const filtered = useMemo(() => {
    const qLower = trimmedInput.toLowerCase();
    if (!qLower) return suggestions;
    return suggestions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(qLower) ||
        opt.value.toLowerCase().includes(qLower)
    );
  }, [suggestions, trimmedInput]);

  const selectedSet = useMemo(
    () => new Set(selectedValues),
    [selectedValues]
  );

  const showFullPanelLoading =
    isOpen &&
    filtered.length === 0 &&
    (isPending || isTypingAhead || (isFetching && suggestions.length === 0));

  const showNoCatalogMatch =
    trimmedInput.length > 0 &&
    !showFullPanelLoading &&
    !isFetching &&
    !isTypingAhead &&
    filtered.filter((opt) => !selectedSet.has(opt.value)).length === 0 &&
    !filtered.some(
      (opt) => opt.label.trim().toLowerCase() === trimmedInput.toLowerCase()
    );

  const showListUpdatingHint =
    filtered.length > 0 && isFetching && !isPending;

  const handleSelect = (opt: DiagnosisOption) => {
    if (!selectedValues.includes(opt.value)) onSelect(opt);
    setInputValue("");
    setHighlightedIndex(-1);
    setIsOpen(true);
  };

  const handleSelectCustomTyped = (trimmed: string) => {
    const lower = trimmed.toLowerCase();
    if (selectedLabels?.some((l) => l.trim().toLowerCase() === lower)) {
      setInputValue("");
      setHighlightedIndex(-1);
      setIsOpen(true);
      return;
    }
    const listMatch = filtered.find(
      (opt) => opt.label.trim().toLowerCase() === lower
    );
    if (listMatch) {
      handleSelect(listMatch);
      return;
    }
    const base = slugFromLabel(trimmed) || "diagnosis";
    const value = uniqueValueFromSlug(base, selectedValues);
    handleSelect({ value, label: trimmed });
  };

  const onSubmit = () => {
    const trimmed = inputValue.trim();
    if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
      handleSelect(filtered[highlightedIndex]);
    } else if (trimmed) {
      handleSelectCustomTyped(trimmed);
    }
  };

  return (
    <View className="relative z-10 flex-1">
      <TextInput
        value={inputValue}
        onChangeText={(v) => {
          setInputValue(v);
          if (v.length > 0) setIsOpen(true);
          setHighlightedIndex(-1);
        }}
        onFocus={() => {
          if (!disabled) setIsOpen(true);
        }}
        onBlur={() => {
          // Delay so press handlers on dropdown rows fire first
          setTimeout(() => setIsOpen(false), 180);
        }}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        editable={!disabled}
        autoCorrect={false}
        autoCapitalize="sentences"
        className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900"
        style={{
          borderColor: isOpen ? "#FD006A" : undefined,
          borderWidth: isOpen ? 1.5 : 1,
        }}
      />

      {isOpen && !disabled ? (
        <View
          className="mt-1 max-h-56 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg"
          style={{ elevation: 6 }}
        >
          {showFullPanelLoading ? (
            <View className="flex-row items-center justify-center gap-2 p-4">
              <ActivityIndicator size="small" color="#FD006A" />
              <Text className="text-sm text-neutral-500">
                {trimmedInput.length === 0
                  ? "Loading diagnoses…"
                  : "Searching…"}
              </Text>
            </View>
          ) : filtered.length > 0 ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              style={{ maxHeight: 220 }}
            >
              {showListUpdatingHint ? (
                <View className="flex-row items-center gap-2 border-b border-neutral-100 px-3 py-1.5">
                  <ActivityIndicator size="small" color="#9ca3af" />
                  <Text className="text-xs text-neutral-500">
                    Updating list…
                  </Text>
                </View>
              ) : null}
              {filtered.map((opt, index) => {
                const selected = selectedSet.has(opt.value);
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => handleSelect(opt)}
                    style={
                      selected
                        ? { backgroundColor: "rgba(253, 0, 106, 0.14)" }
                        : undefined
                    }
                    className={`flex-row items-center justify-between border-b border-neutral-50 px-3 py-2.5 ${
                      selected
                        ? ""
                        : highlightedIndex === index
                          ? "bg-neutral-50"
                          : "active:bg-neutral-50"
                    }`}
                  >
                    <Text
                      className={`flex-1 text-sm ${
                        selected
                          ? "font-semibold text-brand"
                          : "text-neutral-900"
                      }`}
                    >
                      {opt.label}
                    </Text>
                    {selected ? (
                      <Text className="ml-2 text-sm font-bold text-brand">
                        ✓
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : showNoCatalogMatch ? (
            <View className="gap-2 p-3">
              <Text className="text-sm text-neutral-500">
                No diagnosis found in the list for &quot;{trimmedInput}&quot;.
              </Text>
              <Pressable
                onPress={() => handleSelectCustomTyped(trimmedInput)}
                className="rounded-md border border-brand/30 bg-brand/5 px-3 py-2.5 active:bg-brand/10"
              >
                <Text className="text-sm font-medium text-neutral-900">
                  Add &quot;{trimmedInput}&quot; as diagnosis
                </Text>
              </Pressable>
              <Text className="text-xs text-neutral-400">
                Or press Enter to add.
              </Text>
            </View>
          ) : trimmedInput.length === 0 ? (
            <View className="px-3 py-2">
              <Text className="text-sm text-neutral-500">
                No diagnosis types available.
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
