import { useCallback, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useLocalSearchParams } from "expo-router";

import { Screen, TopBar } from "@/ui";
import { useActiveFacility, useAuthUser } from "@/lib/auth/store";
import { ConsultSectionCard } from "@/features/consult/components/ConsultSectionCard";
import { PatientHeaderCard } from "@/features/consult/components/PatientHeaderCard";
import { SectionNavigator } from "@/features/consult/components/SectionNavigator";
import {
  CONSULT_SECTION_IDS,
  type SectionNavItem,
} from "@/features/consult/sectionIds";
import { useConsultPatientHeader } from "@/features/consult/useConsultPatientHeader";
import { VitalsSection } from "@/features/consult/sections/VitalsSection";
import { NotesSection } from "@/features/consult/sections/NotesSection";
import { PrescriptionsSection } from "@/features/consult/sections/PrescriptionsSection";
import { HistorySection } from "@/features/consult/sections/HistorySection";
import { RecordingSection } from "@/features/consult/sections/RecordingSection";
import { DentalConsultProvider } from "@/features/dental/DentalConsultContext";
import { DentalDiagnosisPanel } from "@/features/dental/sections/DentalDiagnosisPanel";
import { EyeSection } from "@/features/eye/sections/EyeSection";

const SCROLL_MARGIN = 12;
/** Must match ScrollView contentContainerStyle.paddingTop */
const CONTENT_PAD_TOP = 16;

function isDentalType(consultationType?: string | null): boolean {
  const t = (consultationType ?? "").toLowerCase();
  return t.includes("dent");
}

function isEyeType(consultationType?: string | null): boolean {
  const t = (consultationType ?? "").toLowerCase();
  return (
    t.includes("eye") || t.includes("ophthal") || t.includes("optom")
  );
}

/** Practice-aligned nav rail (not Chart/Findings/Plan chips). */
function buildNavItems(consultationType?: string | null): SectionNavItem[] {
  const items: SectionNavItem[] = [
    {
      id: CONSULT_SECTION_IDS.consultation,
      label: "Patient details",
    },
  ];
  if (isDentalType(consultationType)) {
    items.push({
      id: CONSULT_SECTION_IDS.dental,
      label: "Diagnosis Panel",
    });
  } else if (isEyeType(consultationType)) {
    items.push({
      id: CONSULT_SECTION_IDS.eye,
      label: "Diagnosis Panel",
    });
  }
  items.push(
    { id: CONSULT_SECTION_IDS.clinical, label: "Clinical notes" },
    { id: CONSULT_SECTION_IDS.recordings, label: "Audio" },
    { id: CONSULT_SECTION_IDS.plan, label: "Plan of care" }
  );
  return items;
}

export default function ConsultScreen() {
  const { id, patientId, appointmentId } = useLocalSearchParams<{
    id: string;
    patientId?: string;
    appointmentId?: string;
  }>();
  const facility = useActiveFacility();
  const user = useAuthUser();
  const {
    header,
    isLoading: headerLoading,
    isError: headerError,
    error: headerErr,
  } = useConsultPatientHeader(id);
  const headerName = header?.name || "Consultation";
  const dental = isDentalType(facility?.consultationType);
  const eye = isEyeType(facility?.consultationType);

  const navItems = useMemo(
    () => buildNavItems(facility?.consultationType),
    [facility?.consultationType]
  );

  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string>(
    () => navItems[0]?.id ?? CONSULT_SECTION_IDS.consultation
  );
  const scrollingToRef = useRef<string | null>(null);

  const onSectionLayout = useCallback((sectionId: string, y: number) => {
    sectionY.current[sectionId] = y;
  }, []);

  const scrollToSection = useCallback((sectionId: string) => {
    const y = sectionY.current[sectionId];
    if (y == null) return;
    scrollingToRef.current = sectionId;
    setActiveId(sectionId);
    scrollRef.current?.scrollTo({
      y: Math.max(0, CONTENT_PAD_TOP + y - SCROLL_MARGIN),
      animated: true,
    });
    setTimeout(() => {
      if (scrollingToRef.current === sectionId) {
        scrollingToRef.current = null;
      }
    }, 450);
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (scrollingToRef.current) return;
      const y = e.nativeEvent.contentOffset.y;
      const marker = y + 80 - CONTENT_PAD_TOP;
      let next = navItems[0]?.id ?? "";
      for (const item of navItems) {
        const top = sectionY.current[item.id];
        if (top != null && top <= marker) next = item.id;
      }
      if (next) {
        setActiveId((prev) => (prev === next ? prev : next));
      }
    },
    [navItems]
  );

  const content = (
    <View
      className="mx-auto w-full max-w-3xl gap-8"
      collapsable={false}
    >
      <ConsultSectionCard
        id={CONSULT_SECTION_IDS.consultation}
        title="Patient details"
        subtitle="Demographics, vitals, and history"
        onLayoutY={onSectionLayout}
      >
        <View className="gap-4">
          <PatientHeaderCard
            header={header}
            loading={headerLoading}
            error={headerError ? headerErr : null}
          />
          <VitalsSection consultationId={id} />
          <HistorySection consultationId={id} patientId={patientId} />
        </View>
      </ConsultSectionCard>

      {dental ? (
        <ConsultSectionCard
          id={CONSULT_SECTION_IDS.dental}
          title="Diagnosis Panel"
          subtitle="Dental chart, findings, and treatment plan"
          onLayoutY={onSectionLayout}
        >
          <DentalDiagnosisPanel />
        </ConsultSectionCard>
      ) : null}

      {eye && !dental ? (
        <ConsultSectionCard
          id={CONSULT_SECTION_IDS.eye}
          title="Diagnosis Panel"
          subtitle="Eye exam and findings"
          onLayoutY={onSectionLayout}
        >
          <EyeSection consultationId={id} appointmentId={appointmentId} />
        </ConsultSectionCard>
      ) : null}

      <ConsultSectionCard
        id={CONSULT_SECTION_IDS.clinical}
        title="Clinical notes"
        subtitle="SOAP notes and diagnosis codes"
        onLayoutY={onSectionLayout}
      >
        <NotesSection consultationId={id} />
      </ConsultSectionCard>

      <ConsultSectionCard
        id={CONSULT_SECTION_IDS.recordings}
        title="Audio"
        subtitle="Consult recordings"
        onLayoutY={onSectionLayout}
      >
        <RecordingSection
          consultationId={id}
          patientId={patientId}
          appointmentId={appointmentId}
        />
      </ConsultSectionCard>

      <ConsultSectionCard
        id={CONSULT_SECTION_IDS.plan}
        title="Plan of care"
        subtitle="Prescriptions and complete visit"
        onLayoutY={onSectionLayout}
      >
        <PrescriptionsSection
          consultationId={id}
          appointmentId={appointmentId}
          patientId={patientId}
        />
      </ConsultSectionCard>
    </View>
  );

  return (
    <Screen>
      <TopBar title={headerName} subtitle="Consultation" />

      <SectionNavigator
        sections={navItems}
        activeId={activeId}
        onSelect={scrollToSection}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
        keyboardVerticalOffset={90}
      >
        {dental ? (
          <DentalConsultProvider
            consultationId={id}
            appointmentId={appointmentId}
            facilityId={facility?.id}
            defaultDoctorId={user?.id ?? ""}
          >
            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              onScroll={onScroll}
              scrollEventThrottle={16}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 112,
              }}
            >
              {content}
            </ScrollView>
          </DentalConsultProvider>
        ) : (
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            onScroll={onScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 112,
            }}
          >
            {content}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
