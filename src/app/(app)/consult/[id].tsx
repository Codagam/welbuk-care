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
import { ConsultLockBanner } from "@/features/consult/components/ConsultLockBanner";
import { SectionNavigator } from "@/features/consult/components/SectionNavigator";
import { PlanOfCareSection } from "@/features/consult/plan-of-care/PlanOfCareSection";
import {
  CONSULT_SECTION_IDS,
  type SectionNavItem,
} from "@/features/consult/sectionIds";
import { NotesSection } from "@/features/consult/sections/NotesSection";
import { PatientDetailsSection } from "@/features/consult/sections/PatientDetailsSection";
import { calculateAge } from "@/features/consult/patientHeader";
import {
  resolveConsultSpecialty,
  type SpecialtyDef,
} from "@/features/consult/specialties";
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
/** Must match the section stack `gap` on the consult column. */
const SECTION_GAP = 32;
/** Line below the top of the scroll viewport used to pick the active chip. */
const ACTIVE_LINE = 80;
const BOTTOM_SNAP = 48;

/** Practice-aligned nav rail — audio lives inside Patient details (Live Conversation). */
function buildNavItems(chartKind: SpecialtyDef["chartKind"]): SectionNavItem[] {
  const items: SectionNavItem[] = [
    {
      id: CONSULT_SECTION_IDS.consultation,
      label: "Patient details",
    },
  ];
  if (chartKind === "dental") {
    items.push({
      id: CONSULT_SECTION_IDS.dental,
      label: "Diagnosis Panel",
    });
  } else if (chartKind === "eye") {
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
    doctor: consultDoctor,
    doctorId: consultDoctorId,
    lock,
    isLocked,
  } = useConsultPatientHeader(id);
  const headerName = header?.name || "Consultation";
  // Not header.age: that reads 0 when the age is unknown, and 0 here is a newborn.
  const patientAgeYears: number | null = patient?.dob
    ? calculateAge(patient.dob)
    : typeof patient?.age === "number" && patient.age >= 0
      ? patient.age
      : null;
  // Nothing until the consult loads: its doctor decides which chart this is.
  const chartKind = consultation
    ? resolveConsultSpecialty({
        doctorSpecialization: consultDoctor?.specialization,
        facilityConsultationType: facility?.consultationType,
      }).chartKind
    : null;
  const dental = chartKind === "dental";
  const eye = chartKind === "eye";

  const resolvedPatientId =
    patientIdParam ||
    patient?.id ||
    consultation?.patientId ||
    undefined;

  const navItems = useMemo(() => buildNavItems(chartKind), [chartKind]);

  const notesFlushRef = useRef<(() => Promise<boolean>) | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const sectionY =useRef<Record<string, number>>({});
  const sectionH = useRef<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string>(
    () => navItems[0]?.id ?? CONSULT_SECTION_IDS.consultation
  );
  const scrollingToRef = useRef<string | null>(null);
  const [stickyFooter, setStickyFooter] = useState<ReactNode>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const recomputeSectionTops = useCallback(() => {
    let y = 0;
    let known = true;
    for (const item of navItems) {
      if (!known) {
        delete sectionY.current[item.id];
        continue;
      }
      sectionY.current[item.id] = y;
      const h = sectionH.current[item.id];
      if (h == null) {
        known = false;
      } else {
        y += h + SECTION_GAP;
      }
    }
  }, [navItems]);

  const lastScrollRef = useRef({ y: 0, viewportH: 0, contentH: 0 });

  const syncActiveFromScroll = useCallback(() => {
    if (scrollingToRef.current) return;
    const { y, viewportH, contentH } = lastScrollRef.current;
    const marker = y + ACTIVE_LINE - CONTENT_PAD_TOP;
    let next = navItems[0]?.id ?? "";
    for (const item of navItems) {
      const top = sectionY.current[item.id];
      if (top != null && top <= marker) next = item.id;
    }
    const lastId = navItems[navItems.length - 1]?.id;
    const canScroll = contentH > viewportH + 8;
    if (
      lastId &&
      canScroll &&
      y + viewportH >= contentH - BOTTOM_SNAP
    ) {
      next = lastId;
    }
    if (next) {
      setActiveId((prev) => (prev === next ? prev : next));
    }
  }, [navItems]);

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

  const onSectionLayout = useCallback(
    (sectionId: string, _y: number, height: number) => {
      sectionH.current[sectionId] = height;
      recomputeSectionTops();
      syncActiveFromScroll();
    },
    [recomputeSectionTops, syncActiveFromScroll]
  );

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
      const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
      lastScrollRef.current = {
        y: contentOffset.y,
        viewportH: layoutMeasurement.height,
        contentH: contentSize.height,
      };
      syncActiveFromScroll();
    },
    [syncActiveFromScroll]
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
        {(open) => (
          <PatientDetailsSection
            consultationId={id}
            patientId={resolvedPatientId}
            header={header}
            headerLoading={headerLoading}
            headerError={headerError ? headerErr : null}
            appointment={appointment}
            showExtended={open}
            locked={isLocked}
          />
        )}
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
          <EyeSection
            consultationId={id}
            appointmentId={appointmentId}
            locked={isLocked}
          />
        </ConsultSectionCard>
      ) : null}

      <ConsultSectionCard
        id={CONSULT_SECTION_IDS.clinical}
        title="Clinical notes"
        subtitle="SOAP notes and diagnosis codes"
        onLayoutY={onSectionLayout}
      >
        <NotesSection
          key={id}
          consultationId={id}
          locked={isLocked}
          flushRef={notesFlushRef}
        />
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
          patientAgeYears={patientAgeYears}
          patientPhone={header?.phone ?? patient?.phone ?? undefined}
          doctorId={consultDoctorId ?? user?.id}
          doctorName={consultDoctor?.name ?? user?.name ?? user?.email}
          onStickyFooter={setStickyFooter}
          locked={isLocked}
          flushNotes={() => notesFlushRef.current?.() ?? Promise.resolve(true)}
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

      {isLocked ? (
        <ConsultLockBanner consultationId={id} lock={lock} />
      ) : null}

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
            locked={isLocked}
            enabled={dental}
          >
            <View className="flex-1">
              <ScrollView
                ref={scrollRef}
                className="flex-1"
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                automaticallyAdjustKeyboardInsets
                onScroll={onScroll}
                onContentSizeChange={(_w, h) => {
                  lastScrollRef.current.contentH = h;
                  syncActiveFromScroll();
                }}
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
              onContentSizeChange={(_w, h) => {
                lastScrollRef.current.contentH = h;
                syncActiveFromScroll();
              }}
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
