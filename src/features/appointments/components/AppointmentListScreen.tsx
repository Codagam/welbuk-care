import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { userDisplayName } from "@/lib/auth/roles";
import { useActiveFacility, useAuthUser, useFacilityId } from "@/lib/auth/store";
import { HeaderActions } from "@/features/header";
import { AppointmentCard } from "./AppointmentCard";
import { AppointmentSearchBar } from "./AppointmentSearchBar";
import {
  useAppointmentList,
  useAppointmentListState,
  useOpenConsult,
  useReadyForNext,
} from "../hooks/useAppointmentList";
import { canOpenAppointmentFromList } from "../lib/appointmentGates";
import type { Appointment } from "../types";

function doctorWelcomeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return /^dr\.?\s/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
}

export function AppointmentListScreen() {
  const router = useRouter();
  const facility = useActiveFacility();
  const facilityId = useFacilityId();
  const user = useAuthUser();
  const [openingId, setOpeningId] = useState<string | null>(null);

  const {
    search,
    setSearch,
    filters,
    setFilters,
    debouncedSearch,
    debouncedFilters,
    filtersOpen,
    setFiltersOpen,
    clearFilters,
  } = useAppointmentListState();

  const q = useAppointmentList(debouncedSearch, debouncedFilters);
  const open = useOpenConsult();
  const readyForNext = useReadyForNext();

  /** Same gate as Practice consult list — linked doctor account only. */
  const isDoctorLogin = Boolean(user?.doctorId);

  const appointments = useMemo(
    () => q.data?.pages.flatMap((p) => p.data ?? []) ?? [],
    [q.data]
  );
  const totalCount = q.data?.pages[0]?.totalCount ?? 0;

  const greetName = userDisplayName(user);
  const welcomeTitle = greetName
    ? `Welcome, ${doctorWelcomeName(greetName)}`
    : "Welcome";

  const onReadyForNext = async () => {
    if (!facilityId) {
      Alert.alert("Select a facility", "Choose a facility before notifying reception.");
      return;
    }
    try {
      await readyForNext.mutateAsync();
      Alert.alert("Front desk notified", "Reception has been told you are ready for the next patient.");
    } catch (err) {
      Alert.alert("Could not notify front desk", describeError(err));
    }
  };

  const onOpen = async (appt: Appointment) => {
    if (!canOpenAppointmentFromList(appt)) {
      Alert.alert(
        "Consult unavailable",
        "Only today's appointments can be opened. Scheduled visits become available on the day of the visit; follow-up fees and time slots must be completed first."
      );
      return;
    }
    setOpeningId(appt.id);
    try {
      const consult = await open.mutateAsync(appt.id);
      router.push({
        pathname: "/consult/[id]",
        params: {
          id: consult.id,
          appointmentId: appt.id,
          patientId: appt.patient?.id ?? consult.patientId ?? "",
        },
      });
    } catch (err) {
      Alert.alert("Could not open consult", describeError(err));
    } finally {
      setOpeningId(null);
    }
  };

  const permissionDenied =
    q.isError &&
    /permission|access denied|appointment\.read/i.test(describeError(q.error));

  const appointmentMeta =
    totalCount > 0
      ? `${totalCount} appointment${totalCount === 1 ? "" : "s"} today`
      : "Today's schedule";

  return (
    <Screen edges={["left", "right", "bottom"]}>
      <View className="bg-brand pt-3">
        {/* Utility row — facility + tools */}
        <View className="flex-row items-center justify-between gap-3 px-5 pb-3 pt-2">
          <View className="min-w-0 flex-1 flex-row items-center gap-2">
            {facility?.name ? (
              <>
                <Ionicons name="business-outline" size={16} color="rgba(255,255,255,0.85)" />
                <Text
                  className="min-w-0 flex-1 text-sm font-medium text-white/90"
                  numberOfLines={1}
                >
                  {facility.name}
                </Text>
              </>
            ) : (
              <Text className="text-sm text-white/70">No facility selected</Text>
            )}
          </View>
          <HeaderActions light />
        </View>

        <View className="mx-5 h-px bg-white/20" />

        {/* Primary row — greeting + Next Patient */}
        <View className="flex-row items-start justify-between gap-4 px-5 py-4">
          <View className="min-w-0 flex-1 gap-1">
            <Text
              className="text-[22px] font-semibold leading-7 text-brand-foreground"
              numberOfLines={2}
            >
              {welcomeTitle}
            </Text>
            <Text className="text-sm text-white/80" numberOfLines={1}>
              {appointmentMeta}
            </Text>
          </View>

          {isDoctorLogin ? (
            <View className="shrink-0 items-end gap-1.5 pt-0.5">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next Patient"
                accessibilityHint="Notify reception you are ready for the next patient"
                disabled={!facilityId || readyForNext.isPending}
                onPress={() => void onReadyForNext()}
                className={`h-10 min-w-[132px] flex-row items-center justify-center gap-2 rounded-lg bg-white px-4 shadow-sm active:bg-white/90 ${
                  !facilityId || readyForNext.isPending ? "opacity-50" : ""
                }`}
              >
                {readyForNext.isPending ? (
                  <ActivityIndicator color="#FD006A" size="small" />
                ) : null}
                <Text className="text-sm font-semibold tracking-wide text-brand">
                  Next Patient
                </Text>
              </Pressable>
              <Text
                className="text-right text-[11px] leading-4 text-white/65"
                numberOfLines={1}
              >
                Notify reception when ready
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <AppointmentSearchBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFiltersChange={setFilters}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((o) => !o)}
        onClearFilters={clearFilters}
      />

      {q.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FD006A" />
        </View>
      ) : q.isError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base font-medium text-red-500">
            {permissionDenied
              ? "You don’t have permission to view appointments."
              : "Error loading appointments"}
          </Text>
          <Text className="mt-2 text-center text-sm text-neutral-500">
            {permissionDenied
              ? "Ask an admin for appointment.read access."
              : describeError(q.error)}
          </Text>
        </View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
          renderItem={({ item }) => (
            <AppointmentCard
              appointment={item}
              opening={openingId === item.id}
              onPress={() => onOpen(item)}
            />
          )}
          ListEmptyComponent={
            <Text className="mt-10 text-center text-sm text-neutral-500">
              No appointments found
            </Text>
          }
          ListFooterComponent={
            q.isFetchingNextPage ? (
              <ActivityIndicator className="my-4" color="#FD006A" />
            ) : null
          }
          refreshing={q.isRefetching && !q.isFetchingNextPage}
          onRefresh={() => q.refetch()}
          onEndReached={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) {
              void q.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
        />
      )}
    </Screen>
  );
}
