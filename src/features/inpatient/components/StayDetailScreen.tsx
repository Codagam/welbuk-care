import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button, Screen, TopBar } from "@/ui";
import { SectionChrome } from "@/features/consult/components/SectionChrome";
import { useCanAccessInpatient } from "@/features/permissions/hooks";
import { describeError } from "@/lib/api/errors";
import { useInpatientAdmission, useInpatientAudit } from "../hooks";
import {
  formatPersonNameTitleCase,
  inpatientRouteSegment,
  patientDisplayName,
} from "../utils";
import { MedicationChartPanel } from "./MedicationChartPanel";
import { StayIdentityCard } from "./StayIdentityCard";
import { WardRecordPanel } from "./WardRecordPanel";

const SECTIONS = [
  { id: "ip-ward", label: "Vitals and notes" },
  { id: "ip-medication", label: "Medication" },
] as const;

export function StayDetailScreen() {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const admissionId = typeof routeId === "string" ? routeId : routeId?.[0];
  const router = useRouter();
  const { canAccess, isLoading: accessLoading } = useCanAccessInpatient();
  const admissionQ = useInpatientAdmission(admissionId);
  const admission = admissionQ.data;
  const mongoId = admission?.id;
  const auditQ = useInpatientAudit(mongoId);

  const [activeId, setActiveId] = useState<(typeof SECTIONS)[number]["id"]>(
    "ip-ward"
  );
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});
  const skipScrollSync = useRef(false);

  useEffect(() => {
    if (!admission || !admissionId) return;
    const preferred = inpatientRouteSegment(admission);
    if (preferred !== admissionId) {
      router.replace({
        pathname: "/inpatient/[id]",
        params: { id: preferred },
      });
    }
  }, [admission, admissionId, router]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (skipScrollSync.current) return;
    const y = e.nativeEvent.contentOffset.y;
    let current: (typeof SECTIONS)[number]["id"] = SECTIONS[0].id;
    for (const s of SECTIONS) {
      const top = offsets.current[s.id] ?? 0;
      if (y + 24 >= top) current = s.id;
    }
    if (current !== activeId) setActiveId(current);
  };

  const jumpTo = (id: (typeof SECTIONS)[number]["id"]) => {
    setActiveId(id);
    skipScrollSync.current = true;
    const y = Math.max(0, (offsets.current[id] ?? 0) - 8);
    scrollRef.current?.scrollTo({ y, animated: true });
    setTimeout(() => {
      skipScrollSync.current = false;
    }, 400);
  };

  if (accessLoading) {
    return (
      <Screen>
        <TopBar title="Inpatient" variant="brand" titleCentered backLabel="Back" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FD006A" />
        </View>
      </Screen>
    );
  }

  if (!canAccess) {
    return (
      <Screen>
        <TopBar title="Inpatient" variant="brand" titleCentered backLabel="Back" />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-neutral-600">
            You do not have permission to view inpatient admissions.
          </Text>
        </View>
      </Screen>
    );
  }

  if (admissionQ.isLoading) {
    return (
      <Screen>
        <TopBar title="Inpatient" variant="brand" titleCentered backLabel="Back" />
        <View className="flex-1 items-center justify-center gap-2">
          <ActivityIndicator color="#FD006A" />
          <Text className="text-xs text-neutral-500">Loading stay…</Text>
        </View>
      </Screen>
    );
  }

  if (admissionQ.isError || !admission) {
    return (
      <Screen>
        <TopBar title="Inpatient" variant="brand" titleCentered backLabel="Back" />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm font-medium text-neutral-900">
            Admission not found
          </Text>
          <Text className="mt-1 text-center text-sm text-neutral-500">
            {admissionQ.isError
              ? describeError(admissionQ.error)
              : "Check the link or return to the inpatient list."}
          </Text>
          <View className="mt-4">
            <Button
              label="Back to Inpatients"
              variant="outline"
              size="md"
              onPress={() => router.replace("/inpatient")}
            />
          </View>
        </View>
      </Screen>
    );
  }

  const patientName = formatPersonNameTitleCase(patientDisplayName(admission));

  return (
    <Screen>
      <TopBar
        title="Inpatient"
        subtitle={patientName}
        variant="brand"
        titleCentered
        backLabel="Back"
        right={
          <Pressable
            onPress={() => router.replace("/inpatient")}
            hitSlop={8}
            className="rounded-full px-2 py-1 active:bg-white/15"
          >
            <Text className="text-sm font-semibold text-white">List</Text>
          </Pressable>
        }
      />

      <View className="border-b border-neutral-200 bg-white">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 12,
            paddingVertical: 10,
            gap: 8,
            alignItems: "center",
          }}
        >
          {SECTIONS.map((s) => {
            const isActive = s.id === activeId;
            return (
              <Pressable
                key={s.id}
                onPress={() => jumpTo(s.id)}
                className={`rounded-full px-4 py-2.5 ${
                  isActive ? "bg-brand" : "bg-neutral-100"
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    isActive ? "text-brand-foreground" : "text-neutral-600"
                  }`}
                >
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 32,
          gap: 12,
        }}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <StayIdentityCard admission={admission} />

        <View
          onLayout={(e) => {
            offsets.current["ip-ward"] = e.nativeEvent.layout.y;
          }}
        >
          <SectionChrome
            title="Vitals and notes"
            icon="pulse-outline"
          >
            <Text className="mb-3 text-xs text-neutral-500">
              Observations and what the clinicians made of them.
            </Text>
            <WardRecordPanel
              admissionId={admission.id}
              editors={auditQ.data}
            />
          </SectionChrome>
        </View>

        <View
          onLayout={(e) => {
            offsets.current["ip-medication"] = e.nativeEvent.layout.y;
          }}
        >
          <SectionChrome title="Medication" icon="medkit-outline">
            <Text className="mb-3 text-xs text-neutral-500">
              Doses given, and units still to account for.
            </Text>
            <MedicationChartPanel
              admissionId={admission.id}
              editors={auditQ.data}
            />
          </SectionChrome>
        </View>
      </ScrollView>
    </Screen>
  );
}
