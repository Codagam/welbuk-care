import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useServicePickables } from "./hooks";
import type { BillItem, PickableService } from "./types";
import {
  addOrBumpBillItem,
  billLineCategoryLabel,
  categoryIcon,
  CAT_COLOR,
  formatInr,
} from "./utils";

type Props = {
  items: BillItem[];
  setItems: React.Dispatch<React.SetStateAction<BillItem[]>>;
  disabled?: boolean;
};

/**
 * IP bill service search — mirrors Practice `ServicePicker` with
 * `showCategoryBrowse={false}` (rate-card + drugs, client-side filter).
 */
export function ServicePicker({ items, setItems, disabled }: Props) {
  const catalog = useServicePickables();
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const results = useMemo(() => {
    if (!pickerOpen) return [] as PickableService[];
    const q = query.trim().toLowerCase();
    let list = catalog.pickables;
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          billLineCategoryLabel(s.catId).toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog.pickables, pickerOpen, query]);

  const addItem = (svc: PickableService) => {
    setItems((prev) => addOrBumpBillItem(prev, svc));
    setPickerOpen(false);
    setQuery("");
  };

  return (
    <View className="gap-2">
      <View
        className={`flex-row items-center gap-2 rounded-xl border bg-white px-3 ${
          pickerOpen ? "border-brand" : "border-neutral-300"
        }`}
        style={{ minHeight: 48 }}
      >
        <Ionicons name="search-outline" size={16} color="#9ca3af" />
        <TextInput
          value={query}
          editable={!disabled}
          onChangeText={(t) => {
            setQuery(t);
            setPickerOpen(true);
          }}
          onFocus={() => {
            if (!disabled) setPickerOpen(true);
          }}
          onBlur={() => {
            // Delay so row press can register (web uses 180ms).
            setTimeout(() => setPickerOpen(false), 300);
          }}
          placeholder="Click or type to search services, medicines, tests…"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoCorrect={false}
          className="min-w-0 flex-1 py-3 text-sm text-neutral-900"
        />
        {query ? (
          <Pressable
            onPress={() => {
              setQuery("");
              setPickerOpen(true);
            }}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </Pressable>
        ) : null}
      </View>

      {pickerOpen && !disabled ? (
        <View className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          {catalog.isLoading ? (
            <View className="items-center py-6">
              <ActivityIndicator color="#FD006A" />
            </View>
          ) : catalog.isError ? (
            <Text className="px-3 py-4 text-center text-sm text-red-500">
              Could not load services.
            </Text>
          ) : results.length === 0 ? (
            <Text className="px-3 py-4 text-center text-sm text-neutral-500">
              {catalog.pickables.length === 0
                ? "No rate card or pharmacy items."
                : "No matches."}
            </Text>
          ) : (
            <ScrollView
              style={{ maxHeight: 208 }}
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled
            >
              {results.map((svc, index) => {
                const color = CAT_COLOR[svc.catId] ?? "#2563EB";
                const catLabel = billLineCategoryLabel(svc.catId);
                return (
                  <Pressable
                    key={svc.id}
                    onPressIn={() => addItem(svc)}
                    style={{ minHeight: 44 }}
                    className={`flex-row items-center gap-2.5 px-3 py-2.5 active:bg-neutral-100 ${
                      index > 0 ? "border-t border-neutral-100" : ""
                    }`}
                  >
                    <Text className="w-5 text-center text-base">
                      {categoryIcon(svc.catId)}
                    </Text>
                    <View className="min-w-0 flex-1">
                      <Text
                        className="text-xs font-semibold text-neutral-900"
                        numberOfLines={1}
                      >
                        {svc.name}
                      </Text>
                      <Text className="text-[10px]" style={{ color }}>
                        {catLabel} · per {svc.unit}
                      </Text>
                    </View>
                    <Text className="shrink-0 font-mono text-xs font-semibold text-neutral-900">
                      {formatInr(svc.rate)}
                    </Text>
                    <View className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5">
                      <Text className="text-[10px] font-semibold text-neutral-600">
                        + Add
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}
