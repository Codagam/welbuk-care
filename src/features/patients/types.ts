export interface Patient {
  id: string;
  patientId: number | string;
  firstName: string;
  lastName?: string | null;
  dob?: string | null; // ISO date string
  gender?: string | null; // API enum: MALE | FEMALE | OTHER
  phone?: string | null;
  email?: string | null;
  abhaNumber?: string | null;
  isPhoneVerified?: boolean;
  isWhatsAppNumber?: boolean;
  address?: string | null;
  bloodGroup?: string | null;
  parentOrGuardianName?: string | null;
  primaryPatientId?: string | null;
  relationshipToPrimary?: string | null;
  isLinkedToFacility?: boolean;
}

export interface PatientSearchParams {
  facilityId: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PatientSearchResult {
  patients: Patient[];
  externalPatients?: Patient[];
  count: number;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

/** Body for POST/PUT /api/patient/crud. */
export interface PatientWriteInput {
  id?: string; // present on update
  facilityId: string;
  firstName: string;
  lastName?: string;
  dob?: string | null;
  gender?: string; // API enum
  mobile?: string;
  email?: string;
  abhaNumber?: string;
  address?: string;
  isWhatsAppNumber?: boolean;
  parentOrGuardianName?: string;
  consentGiven: true;
}
