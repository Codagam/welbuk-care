import { useLocalSearchParams } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import { ConsultSectionCard } from "@/features/consult/components/ConsultSectionCard";
import { SectionNavigator } from "@/features/consult/components/SectionNavigator";
import { PlanOfCareSection } from "@/features/consult/plan-of-care/PlanOfCareSection";
import {
  CONSULT_SECTION_IDS,
  type SectionNavItem,
} from "@/features/consult/sectionIds";
import { NotesSection } from "@/features/consult/sections/NotesSection";
import { PatientDetailsSection } from "@/features/consult/sections/PatientDetailsSection";
import { useConsultPatientHeader } from "@/features/consult/useConsultPatientHeader";
import { DentalConsultProvider } from "@/features/dental/DentalConsultContext";
import { DentalDiagnosisPanel } from "@/features/dental/sections/DentalDiagnosisPanel";
import { EyeSection } from "@/features/eye/sections/EyeSection";
import { useActiveFacility, useAuthUser } from "@/lib/auth/store";
import { NotificationQueue } from "@/features/notifications/NotificationQueue";
import { Screen, TopBar } from "@/ui";

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

/** Practice-aligned nav rail — audio lives inside Patient details (Live Conversation). */
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
    { id: CONSULT_SECTION_IDS.plan, label: "Plan of care" }
  );
  return items;
}

export default function ConsultScreen() {
  const { id, patientId: patientIdParam, appointmentId } = useLocalSearchParams<{
    id: string;
    patientId?: string;
    appointmentId?: string;
  }>();
  const facility = useActiveFacility();
  const user = useAuthUser();
  const {
    header,
    patient,
    isLoading: headerLoading,
    isError: headerError,
    error: headerErr,
    consultation,
    appointment,
    doctorId: consultDoctorId,
  } = useConsultPatientHeader(id);
  const headerName = header?.name || "Consultation";
  const dental = isDentalType(facility?.consultationType);
  const eye = isEyeType(facility?.consultationType);

  const resolvedPatientId =
    patientIdParam ||
    patient?.id ||
    consultation?.patientId ||
    undefined;

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
  const [stickyFooter, setStickyFooter] = useState<ReactNode>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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
      style={{ width: "100%", maxWidth: 1152, alignSelf: "center", flexDirection: "column", gap: 32 }}
      className="mx-auto w-full max-w-6xl flex-col gap-8"
      collapsable={false}
    >
      <ConsultSectionCard
        id={CONSULT_SECTION_IDS.consultation}
        title="Patient details"
        subtitle="Identity, vitals, intake, records, conversation, and reports"
        onLayoutY={onSectionLayout}
      >
        <PatientDetailsSection
          consultationId={id}
          patientId={resolvedPatientId}
          header={header}
          headerLoading={headerLoading}
          headerError={headerError ? headerErr : null}
          appointment={appointment}
        />
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
        id={CONSULT_SECTION_IDS.plan}
        title="Plan of care"
        subtitle="Prescription, labs, notes, and follow-up"
        onLayoutY={onSectionLayout}
      >
        <PlanOfCareSection
          consultationId={id}
          appointmentId={appointmentId}
          patientId={resolvedPatientId}
          patientName={header?.name}
          patientAge={header?.age ?? patient?.age ?? undefined}
          patientPhone={header?.phone ?? patient?.phone ?? undefined}
          doctorId={consultDoctorId ?? user?.id}
          doctorName={user?.name ?? user?.email}
          onStickyFooter={setStickyFooter}
        />
      </ConsultSectionCard>
    </View>
  );

  return (
    <Screen>
      <TopBar
        variant="brand"
        backLabel="Back"
        titleCentered
        title={`Consulting for ${headerName}`}
        right={<NotificationQueue light />}
      />

      <SectionNavigator
        sections={navItems}
        activeId={activeId}
        onSelect={scrollToSection}
      />

      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {dental ? (
          <DentalConsultProvider
            consultationId={id}
            appointmentId={appointmentId}
            facilityId={facility?.id}
            defaultDoctorId={consultDoctorId ?? user?.id ?? ""}
          >
            <View className="flex-1">
              <ScrollView
                ref={scrollRef}
                className="flex-1"
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                automaticallyAdjustKeyboardInsets
                onScroll={onScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingTop: 16,
                  paddingBottom: keyboardOpen ? 40 : 32,
                }}
              >
                {content}
              </ScrollView>
              {!keyboardOpen ? stickyFooter : null}
            </View>
          </DentalConsultProvider>
        ) : (
          <View className="flex-1">
            <ScrollView
              ref={scrollRef}
              className="flex-1"
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              automaticallyAdjustKeyboardInsets
              onScroll={onScroll}
              scrollEventThrottle={16}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: keyboardOpen ? 40 : 32,
              }}
            >
              {content}
            </ScrollView>
            {!keyboardOpen ? stickyFooter : null}
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
