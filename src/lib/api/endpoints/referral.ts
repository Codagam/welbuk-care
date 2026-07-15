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
