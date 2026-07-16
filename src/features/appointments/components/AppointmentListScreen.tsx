import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Screen } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { userDisplayName } from "@/lib/auth/roles";
import { useActiveFacility, useAuthUser } from "@/lib/auth/store";
import { HeaderActions } from "@/features/header";
import { AppointmentCard } from "./AppointmentCard";
import { AppointmentSearchBar } from "./AppointmentSearchBar";
import {
  useAppointmentList,
  useAppointmentListState,
  useOpenConsult,
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
  const insets = useSafeAreaInsets();
  const facility = useActiveFacility();
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

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle("dark");
    }, [])
  );

  const appointments = useMemo(
    () => q.data?.pages.flatMap((p) => p.data ?? []) ?? [],
    [q.data]
  );
  const totalCount = q.data?.pages[0]?.totalCount ?? 0;

  const greetName = userDisplayName(user);
  const welcomeTitle = greetName
    ? `Welcome, ${doctorWelcomeName(greetName)}`
    : "Welcome";

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

  return (
    <Screen edges={["left", "right", "bottom"]}>
      <View
        className="bg-brand px-6 pb-5"
        style={{ paddingTop: Math.max(insets.top, 12) + 12 }}
      >
        <View className="flex-row items-start justify-between gap-4">
          <View className="min-w-0 flex-1 gap-1">
            <Text
              className="text-2xl font-bold text-brand-foreground"
              numberOfLines={1}
            >
              {welcomeTitle}
            </Text>
            <Text className="text-sm text-white/90">
              Here is your appointment list for today.
            </Text>
            {totalCount > 0 ? (
              <Text className="text-xs text-white/75">
                {totalCount} appointment{totalCount === 1 ? "" : "s"}
              </Text>
            ) : null}
          </View>

          <View className="max-w-[48%] shrink-0 items-end gap-2 pt-0.5">
            <HeaderActions light />
            {facility?.name ? (
              <View className="flex-row items-center justify-end gap-2">
                <Ionicons name="business-outline" size={18} color="#FFFFFF" />
                <Text
                  className="shrink text-right text-sm font-medium text-brand-foreground"
                  numberOfLines={2}
                >
                  {facility.name}
                </Text>
              </View>
            ) : null}
          </View>
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
