import { api } from "@/lib/api/client";

export interface ReferralRow {
  id?: string;
  patientName?: string;
  referralType?: string;
  tests?: string[] | string;
  priority?: string;
  status?: string;
  createdAt?: string;
  fromFacilityName?: string;
  toFacilityName?: string;
  doctorName?: string;
  toDoctorName?: string;
}

export async function listReferrals(params: {
  facilityId: string;
  patientId: string;
  mode: "incoming" | "outgoing";
}): Promise<ReferralRow[]> {
  const res = await api<{
    referrals?: ReferralRow[];
    items?: ReferralRow[];
  }>({
    path: "/api/referral",
    query: {
      facilityId: params.facilityId,
      patientId: params.patientId,
      mode: params.mode,
    },
  });
  return res.referrals ?? res.items ?? [];
}

export type ReferralFacility = {
  id: string;
  facilityId?: number;
  name: string;
  address?: string | null;
};

export type ReceivingDoctor = {
  id: string;
  name?: string | null;
  specialization?: string | null;
};

/** Facilities to refer to: searched and paged on the server. */
export async function listReferralFacilities(params: {
  search: string;
  page: number;
  pageSize: number;
}): Promise<{ items: ReferralFacility[]; hasMore: boolean }> {
  const res = await api<{
    facilities?: ReferralFacility[];
    hasMore?: boolean;
  }>({ path: "/api/facility/list", query: params });
  const items = res.facilities ?? [];
  return {
    items,
    hasMore:
      typeof res.hasMore === "boolean"
        ? res.hasMore
        : items.length >= params.pageSize,
  };
}

/** Doctors at the receiving facility, for a specialist referral. */
export async function listReceivingDoctors(params: {
  fromFacilityId: string;
  toFacilityId: string;
  search: string;
  page: number;
  pageSize: number;
}): Promise<{ items: ReceivingDoctor[]; hasMore: boolean }> {
  const res = await api<{ doctors?: ReceivingDoctor[]; hasMore?: boolean }>({
    path: "/api/referral/receiving-doctors",
    query: params,
  });
  const items = res.doctors ?? [];
  return {
    items,
    hasMore:
      typeof res.hasMore === "boolean"
        ? res.hasMore
        : items.length >= params.pageSize,
  };
}

export function createReferral(body: {
  patientName: string;
  patientAge: number | string;
  patientGender?: string;
  patientPhone?: string;
  patientId?: string;
  referralType: string;
  tests?: string[];
  priority: string;
  notes?: string;
  doctorName?: string;
  doctorReg?: string;
  doctorId?: string;
  toDoctorId?: string;
  toDoctorName?: string;
  fromFacilityId: string;
  toFacilityId: string;
  fromFacilityName?: string;
  toFacilityName?: string;
}): Promise<unknown> {
  return api({
    path: "/api/referral",
    method: "POST",
    body,
  });
}
