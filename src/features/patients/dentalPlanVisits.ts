/**
 * Dental plan visits for the patient-page Appointments card (Practice's "Plan"
 * column and its Treat button).
 *
 * Specialty-specific: the chart a consult shows is decided by the visit's
 * doctor (then the clinic), via `resolveConsultSpecialty` — the same rule the
 * consult screen uses. Only visits that resolve to the DENTAL chart are looked
 * up; a general or eye visit never fetches dental data, and a clinic with no
 * dental visits makes no extra request at all.
 *
 * Practice loads up to 500 consults and then one dental request per consult.
 * Here: one consult search for this patient (bounded), then dental data only
 * for the dental visits, newest first, capped.
 */
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import { getDental } from "@/lib/api/endpoints/dental";
import type { FacilityAppointment } from "@/lib/api/endpoints/appointments";
import { useActiveFacility } from "@/lib/auth/store";
import { resolveConsultSpecialty } from "@/features/consult/specialties";
import type {
  DentalTreatmentPlanRow,
  DiagnosisDetailsEntry,
} from "@/features/dental/types";

/** Most recent dental visits to check for a plan. */
const MAX_DENTAL_VISITS = 15;
const CONSULT_SEARCH_PAGE_SIZE = 50;

export type DentalPlanVisit = {
  consultationId: string;
  appointmentId: string;
  treatmentEntries: DiagnosisDetailsEntry[];
  treatmentPlanItems: DentalTreatmentPlanRow[];
};

type AppointmentRow = FacilityAppointment & {
  doctor?: { specialization?: string | null } | null;
};

const BLOCKED = new Set(["CANCELLED", "NO_SHOW"]);

export function isConsultBlockedStatus(status: unknown): boolean {
  return BLOCKED.has(String(status ?? "").trim().toUpperCase());
}

/** Does this visit open the dental chart? */
export function useIsDentalVisit() {
  const facility = useActiveFacility();
  return (row: AppointmentRow) =>
    resolveConsultSpecialty({
      doctorSpecialization: row.doctor?.specialization ?? null,
      facilityConsultationType: facility?.consultationType ?? null,
    }).chartKind === "dental";
}

type ConsultSearchRow = { id?: string; appointment?: { id?: string } | null };

export function useDentalPlanVisits(
  mongoPatientId: string | undefined,
  rows: AppointmentRow[],
  enabled: boolean
) {
  const facility = useActiveFacility();
  const isDental = useIsDentalVisit();
  const dentalAppointmentIds = rows
    .filter((r) => r.id && !isConsultBlockedStatus(r.status) && isDental(r))
    .map((r) => r.id as string);

  return useQuery({
    queryKey: [
      "patient-dental-plan-visits",
      mongoPatientId,
      facility?.id,
      dentalAppointmentIds.join(","),
    ],
    enabled:
      enabled &&
      !!mongoPatientId &&
      !!facility?.id &&
      dentalAppointmentIds.length > 0,
    queryFn: async (): Promise<Map<string, DentalPlanVisit>> => {
      const wanted = new Set(dentalAppointmentIds);
      const res = await api<{ consultations?: ConsultSearchRow[] }>({
        path: "/api/consult/search",
        method: "POST",
        body: {
          facilityId: facility!.id,
          filters: { patientId: mongoPatientId },
          page: 1,
          pageSize: CONSULT_SEARCH_PAGE_SIZE,
          sortBy: "startTime",
          sortOrder: "desc",
        },
      });
      const pairs = (res.consultations ?? [])
        .filter(
          (c): c is { id: string; appointment: { id: string } } =>
            !!c.id && !!c.appointment?.id && wanted.has(c.appointment.id)
        )
        .slice(0, MAX_DENTAL_VISITS);

      const visits = await Promise.all(
        pairs.map(async (c) => {
          try {
            const d = await getDental(c.id);
            return {
              consultationId: c.id,
              appointmentId: c.appointment.id,
              treatmentEntries: d.treatmentEntries,
              treatmentPlanItems: d.treatmentPlanItems,
            } satisfies DentalPlanVisit;
          } catch {
            // One unreadable visit must not hide the plan on the others.
            return null;
          }
        })
      );

      const map = new Map<string, DentalPlanVisit>();
      for (const v of visits) {
        // Practice lists a visit in the Plan column only with BOTH findings
        // and a treatment plan.
        if (!v || v.treatmentEntries.length === 0) continue;
        if (v.treatmentPlanItems.length === 0) continue;
        map.set(v.appointmentId, v);
      }
      return map;
    },
  });
}

/** Practice disables Treat once every finding is marked done. */
export function isDentalPlanDone(visit: DentalPlanVisit): boolean {
  return (
    visit.treatmentEntries.length > 0 &&
    visit.treatmentEntries.every(
      (e) => String(e.treatmentStatus ?? "").trim().toLowerCase() === "done"
    )
  );
}
