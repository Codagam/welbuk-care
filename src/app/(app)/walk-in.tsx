import { Redirect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Screen, TopBar } from "@/ui";
import { isReceptionistRole } from "@/lib/auth/roles";
import { useAuthUser, useFacilityId } from "@/lib/auth/store";
import { WalkInBookingPanel } from "@/features/walk-in";

/** Receptionist walk-in booking — opened from the Queue header button. */
export default function WalkInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthUser();
  const facilityId = useFacilityId();

  if (!isReceptionistRole(user, facilityId)) return <Redirect href="/queue" />;

  return (
    <Screen bgClassName="bg-white">
      <TopBar
        title={t("walkIn.title")}
        subtitle={t("walkIn.subtitle")}
        variant="brand"
        backLabel="Back"
      />
      <WalkInBookingPanel
        showTitle={false}
        onBooked={() =>
          router.canGoBack() ? router.back() : router.replace("/queue")
        }
      />
    </Screen>
  );
}
