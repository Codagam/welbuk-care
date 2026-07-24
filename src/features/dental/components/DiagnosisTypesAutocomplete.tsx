import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
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
  /** Tap a selected option again to remove it */
  onDeselect?: (option: DiagnosisOption) => void;
  consultationType?: string;
  placeholder?: string;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
 * Catalog search dropdown + local-only custom add.
 * Re-tap a selected option to deselect; tap outside to close.
 */
export function DiagnosisTypesAutocomplete({
  selectedValues,
  selectedLabels,
  onSelect,
  onDeselect,
  consultationType = "dental",
  placeholder = "Search or type…",
  disabled = false,
  open: openControlled,
  onOpenChange,
}: Props) {
  const triggerRef = useRef<View>(null);
  const triggerInputRef = useRef<TextInput>(null);
  const [inputValue, setInputValue] = useState("");
  const [isOpenUncontrolled, setIsOpenUncontrolled] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [anchor, setAnchor] = useState({ x: 16, y: 80, width: 280, height: 40 });

  const isControlled = openControlled !== undefined;
  const isOpen = isControlled ? !!openControlled : isOpenUncontrolled;

  const setOpen = (next: boolean) => {
    if (!isControlled) setIsOpenUncontrolled(next);
    onOpenChange?.(next);
  };

  const openDropdown = () => {
    if (disabled) return;
    // Open immediately — measureInWindow can fail/hang after a nested Modal closes
    setOpen(true);
    triggerRef.current?.measureInWindow?.((x, y, width, height) => {
      if (width > 0 && height > 0) {
        setAnchor({
          x,
          y,
          width: Math.max(width, 240),
          height,
        });
      }
    });
  };

  const close = () => {
    setOpen(false);
    setHighlightedIndex(-1);
    // Blur so the next tap can focus/open again
    triggerInputRef.current?.blur();
  };

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

  const handleToggle = (opt: DiagnosisOption) => {
    if (selectedSet.has(opt.value)) {
      onDeselect?.(opt);
    } else {
      onSelect(opt);
    }
    setInputValue("");
    setHighlightedIndex(-1);
  };

  const handleSelectCustomTyped = (trimmed: string) => {
    const lower = trimmed.toLowerCase();
    if (selectedLabels?.some((l) => l.trim().toLowerCase() === lower)) {
      const idx = selectedLabels.findIndex(
        (l) => l.trim().toLowerCase() === lower
      );
      if (idx >= 0 && selectedValues[idx]) {
        onDeselect?.({ value: selectedValues[idx], label: trimmed });
      }
      setInputValue("");
      setHighlightedIndex(-1);
      return;
    }
    const listMatch = filtered.find(
      (opt) => opt.label.trim().toLowerCase() === lower
    );
    if (listMatch) {
      handleToggle(listMatch);
      return;
    }
    const base = slugFromLabel(trimmed) || "diagnosis";
    const value = uniqueValueFromSlug(base, selectedValues);
    handleToggle({ value, label: trimmed });
  };

  const onSubmit = () => {
    const trimmed = inputValue.trim();
    if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
      handleToggle(filtered[highlightedIndex]);
    } else if (trimmed) {
      handleSelectCustomTyped(trimmed);
    }
  };

  const inputStyle = {
    borderColor: isOpen ? "#FD006A" : ("#e5e7eb" as string),
    borderWidth: isOpen ? 1.5 : 1,
  };

  const listBody = (
    <>
      {showFullPanelLoading ? (
        <View className="flex-row items-center justify-center gap-2 p-4">
          <ActivityIndicator size="small" color="#FD006A" />
          <Text className="text-sm text-neutral-500">
            {trimmedInput.length === 0 ? "Loading diagnoses…" : "Searching…"}
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
              <Text className="text-xs text-neutral-500">Updating list…</Text>
            </View>
          ) : null}
          {filtered.map((opt, index) => {
            const selected = selectedSet.has(opt.value);
            return (
              <Pressable
                key={opt.value}
                onPress={() => handleToggle(opt)}
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
                  <Text className="ml-2 text-sm font-bold text-brand">✓</Text>
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
          <Text className="text-xs text-neutral-400">Or press Enter to add.</Text>
        </View>
      ) : trimmedInput.length === 0 ? (
        <View className="px-3 py-2">
          <Text className="text-sm text-neutral-500">
            No diagnosis types available.
          </Text>
        </View>
      ) : null}
    </>
  );

  return (
    <View className="relative z-10 flex-1">
      <View ref={triggerRef} collapsable={false}>
        <TextInput
          ref={triggerInputRef}
          value={inputValue}
          onChangeText={(v) => {
            setInputValue(v);
            if (!isOpen) openDropdown();
            setHighlightedIndex(-1);
          }}
          onFocus={openDropdown}
          onPressIn={openDropdown}
          onSubmitEditing={onSubmit}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          editable={!disabled}
          showSoftInputOnFocus
          autoCorrect={false}
          autoCapitalize="sentences"
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900"
          style={inputStyle}
        />
      </View>

      <Modal
        visible={isOpen && !disabled}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityLabel="Close diagnosis dropdown"
          />
          <View
            style={[
              styles.panel,
              {
                top: Math.max(8, anchor.y),
                left: Math.max(8, anchor.x),
                width: Math.min(Math.max(anchor.width, 240), 420),
              },
            ]}
          >
            <TextInput
              value={inputValue}
              onChangeText={(v) => {
                setInputValue(v);
                setHighlightedIndex(-1);
              }}
              onSubmitEditing={onSubmit}
              placeholder={placeholder}
              placeholderTextColor="#9ca3af"
              autoFocus
              autoCorrect={false}
              autoCapitalize="sentences"
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900"
              style={inputStyle}
            />
            <View
              className="mt-1 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg"
              style={{ elevation: 8, maxHeight: 240 }}
            >
              {listBody}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  panel: {
    position: "absolute",
    zIndex: 2,
  },
});
