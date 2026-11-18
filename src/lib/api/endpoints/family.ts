/**
 * Patient family — Practice `GET|POST|DELETE /api/patient/family`
 * (docs/MOTHER_AND_CHILD_PLAN.md §3 in Practice).
 *
 *   GET    ?patientId=&facilityId=
 *   POST   { facilityId, childPatientId, guardianPatientId, relation }
 *   DELETE { facilityId, linkId, reason }
 *
 * Reads need `patient.read`, writes `patient.write`, and the patient must be
 * linked to the facility. The head-of-house link is NOT written here; it stays
 * on the patient form with its same-phone rule.
 */
import { api } from "@/lib/api/client";

export const GUARDIAN_RELATIONS = ["MOTHER", "FATHER", "GUARDIAN"] as const;
export type GuardianRelation = (typeof GUARDIAN_RELATIONS)[number];

export type FamilyPerson = {
  /** Mongo id — only when visible here. */
  id: string | null;
  /** Numeric display id — only when visible here. */
  patientId: number | null;
  name: string | null;
  ageLabel: string | null;
  gender: string | null;
  visibleHere: boolean;
};

export type FamilyView = {
  household: {
    head: (FamilyPerson & { isThisPatient: boolean }) | null;
    relationToHead: string | null;
    members: (FamilyPerson & { relationToHead: string | null })[];
  };
  parents: (FamilyPerson & {
    linkId: string;
    relation: string;
    active: boolean;
  })[];
  children: (FamilyPerson & {
    linkId: string;
    relation: string;
    active: boolean;
    endsOn: string | null;
  })[];
  suggestions: {
    father: FamilyPerson | null;
    headAsGuardian: FamilyPerson | null;
  };
};

export function getFamily(
  patientId: string,
  facilityId: string
): Promise<FamilyView> {
  return api<FamilyView>({
    path: "/api/patient/family",
    query: { patientId, facilityId },
  });
}

export function linkGuardian(body: {
  facilityId: string;
  childPatientId: string;
  guardianPatientId: string;
  relation: GuardianRelation;
}): Promise<{ id: string; askFather: boolean }> {
  return api({ path: "/api/patient/family", method: "POST", body });
}

export function unlinkGuardian(body: {
  facilityId: string;
  linkId: string;
  reason: string;
}): Promise<unknown> {
  return api({ path: "/api/patient/family", method: "DELETE", body });
}

export type FacilityPatientOption = {
  id: string;
  patientId?: number;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
};

/** Facility patient picker (`GET /api/facility/patients`, DB-paginated). */
export async function listFacilityPatients(params: {
  facilityId: string;
  search: string;
  pageSize?: number;
}): Promise<FacilityPatientOption[]> {
  const res = await api<{ patients?: FacilityPatientOption[] }>({
    path: "/api/facility/patients",
    query: {
      facilityId: params.facilityId,
      search: params.search,
      page: 1,
      pageSize: params.pageSize ?? 10,
    },
  });
  return res.patients ?? [];
}
