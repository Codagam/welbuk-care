import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { DateField, TextField } from "@/ui";
import {
  APPOINTMENT_STATUS_OPTIONS,
  type AppointmentListFilters,
} from "../types";
import { formatEnumValue } from "../lib/appointmentGates";

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  filters: AppointmentListFilters;
  onFiltersChange: (next: AppointmentListFilters) => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  onClearFilters: () => void;
};

export function AppointmentSearchBar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  filtersOpen,
  onToggleFilters,
  onClearFilters,
}: Props) {
  const activeFilterCount = [
    filters.patient,
    filters.doctor,
    filters.reason,
    filters.status,
    filters.filtersCleared ? "" : filters.date !== todayYmd() ? filters.date : "",
  ].filter(Boolean).length;

  return (
    <View className="gap-3 border-b border-neutral-200 bg-white px-4 py-3">
      <View className="flex-row items-center gap-2">
        <View className="min-w-0 flex-1">
          <TextField
            value={search}
            onChangeText={onSearchChange}
            placeholder="Search appointments…"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
        <Pressable
          onPress={onToggleFilters}
          className={`h-12 flex-row items-center gap-1.5 rounded-xl border px-3 ${
            filtersOpen || activeFilterCount
              ? "border-brand bg-brand-50"
              : "border-neutral-300 bg-white"
          }`}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={filtersOpen || activeFilterCount ? "#FD006A" : "#374151"}
          />
          <Text
            className={`text-sm font-medium ${
              filtersOpen || activeFilterCount
                ? "text-brand"
                : "text-neutral-700"
            }`}
          >
            Filters
            {activeFilterCount ? ` (${activeFilterCount})` : ""}
          </Text>
        </Pressable>
      </View>

      {filtersOpen ? (
        <View className="gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
          <DateField
            label="Date"
            value={filters.date}
            onChange={(ymd) =>
              onFiltersChange({
                ...filters,
                date: ymd,
                filtersCleared: false,
              })
            }
            placeholder="Select date"
          />
          <TextField
            label="Patient"
            value={filters.patient}
            onChangeText={(patient) =>
              onFiltersChange({ ...filters, patient, filtersCleared: false })
            }
            placeholder="Patient name"
          />
          <TextField
            label="Doctor"
            value={filters.doctor}
            onChangeText={(doctor) =>
              onFiltersChange({ ...filters, doctor, filtersCleared: false })
            }
            placeholder="Doctor name"
          />
          <TextField
            label="Reason"
            value={filters.reason}
            onChangeText={(reason) =>
              onFiltersChange({ ...filters, reason, filtersCleared: false })
            }
            placeholder="Reason"
          />

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-neutral-700">Status</Text>
            <View className="flex-row flex-wrap gap-2">
              <StatusChip
                label="All"
                active={!filters.status}
                onPress={() =>
                  onFiltersChange({
                    ...filters,
                    status: "",
                    filtersCleared: false,
                  })
                }
              />
              {APPOINTMENT_STATUS_OPTIONS.map((st) => (
                <StatusChip
                  key={st}
                  label={formatEnumValue(st)}
                  active={filters.status === st}
                  onPress={() =>
                    onFiltersChange({
                      ...filters,
                      status: st,
                      filtersCleared: false,
                    })
                  }
                />
              ))}
            </View>
          </View>

          <Pressable
            onPress={onClearFilters}
            className="h-11 items-center justify-center rounded-xl border border-neutral-300 bg-white active:bg-neutral-100"
          >
            <Text className="text-sm font-semibold text-neutral-700">
              Clear filters
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function StatusChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-3 py-1.5 ${
        active
          ? "border-brand bg-brand"
          : "border-neutral-300 bg-white"
      }`}
    >
      <Text
        className={`text-xs font-medium ${
          active ? "text-white" : "text-neutral-700"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
