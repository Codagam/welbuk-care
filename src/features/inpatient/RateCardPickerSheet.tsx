import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";

import { TextField } from "@/ui";
import { useInpatientRateCard } from "./hooks";
import type { RateCardItem } from "./types";
import {
  billLineCategoryLabel,
  formatInr,
} from "./utils";

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (row: RateCardItem) => void;
};

export function RateCardPickerSheet({ visible, onClose, onPick }: Props) {
  const q = useInpatientRateCard();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const rows = q.data ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const cat = billLineCategoryLabel(r.categoryId ?? "").toLowerCase();
      return (
        r.name.toLowerCase().includes(needle) ||
        cat.includes(needle) ||
        (r.categoryId ?? "").toLowerCase().includes(needle)
      );
    });
  }, [q.data, search]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between border-b border-neutral-200 px-4 py-3">
          <Text className="text-lg font-semibold text-neutral-900">
            Add service
          </Text>
          <Pressable onPress={onClose} hitSlop={10} className="px-2 py-1">
            <Text className="text-base font-semibold text-brand">Close</Text>
          </Pressable>
        </View>

        <View className="px-4 pt-3">
          <TextField
            placeholder="Search rate card…"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {q.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#FD006A" />
          </View>
        ) : q.isError ? (
          <View className="flex-1 items-center justify-center px-4">
            <Text className="text-center text-sm text-red-500">
              Could not load rate card.
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(r) => r.id}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 32,
              gap: 8,
            }}
            ListEmptyComponent={
              <Text className="mt-10 text-center text-sm text-neutral-500">
                No rate card items.
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onPick(item);
                  onClose();
                }}
                className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 active:bg-neutral-50"
              >
                <Text className="text-base font-semibold text-neutral-900">
                  {item.name}
                </Text>
                <Text className="mt-0.5 text-xs text-neutral-500">
                  {billLineCategoryLabel(item.categoryId ?? "")}
                  {item.unit ? ` · ${item.unit}` : ""}
                </Text>
                <Text className="mt-1 font-mono text-sm font-semibold text-neutral-900">
                  {formatInr(item.rate)}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}
