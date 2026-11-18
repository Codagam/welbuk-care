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
  /** DOB derived from an age the desk typed, not a real birth date. */
  isDobEstimated?: boolean;
  parentOrGuardianName?: string | null;
  primaryPatientId?: string | null;
  relationshipToPrimary?: string | null;
  isLinkedToFacility?: boolean;
  /** Facility file number (MRD), when this facility has numbered the link. */
  mrdNumber?: string | number | null;
  /** Set when an admin opens a patient unlinked from the selected facility. */
  removedFromFacility?: boolean;
  /** Server-decided name/DOB lock (Practice docs/PATIENT_IDENTITY_LOCK.md). */
  identityLock?: PatientIdentityLock | null;
}

export interface PatientIdentityLock {
  locked: boolean;
  reason: string | null;
  graceExpiresAt: string | null;
  detail: string | null;
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
  bloodGroup?: string | null;
  isDobEstimated?: boolean;
  /** Family: the adult who owns this shared mobile, and how this patient relates. */
  primaryPatientId?: string | null;
  relationshipToPrimary?: string | null;
  /** Edit only — Practice requires ≥3 words when name, DOB or mobile moves. */
  changeReason?: string;
  /** Create only — set after the mobile passed OTP at the desk. */
  isPhoneVerified?: boolean;
  /**
   * Create only — set after a human was shown the 409 `PATIENT_DUPLICATE`
   * matches and said this is a different person (twins share a phone and DOB).
   */
  confirmedNotDuplicate?: boolean;
  consentGiven: true;
}

/** One match from Practice's 409 `PATIENT_DUPLICATE` refusal. */
export interface DuplicatePatientCandidate {
  id: string;
  patientId: number;
  firstName: string;
  lastName: string;
  dob: string | null;
  gender: string | null;
  phone: string | null;
  nameMatches: boolean;
  phoneMatches: boolean;
  /** false → the person exists elsewhere; onboard that record, don't mint another. */
  isLinkedToFacility: boolean;
}

/** Questionnaire JSON stored on PatientQuestionnaire (chart medical history). */
export interface QuestionnaireField {
  selectedValue?: string | string[];
  inputValue?: string;
  conditionDates?: Record<string, string>;
  otherConditionDate?: string;
}

export interface PatientQuestionnaire {
  id?: string;
  patientId?: string;
  medicalHistory?: Record<string, unknown> | null;
  allergies?: Record<string, QuestionnaireField> | null;
  CurrentMedications?: Record<string, QuestionnaireField> | null;
  lifestyle?: unknown;
  currentStep?: number | null;
  completed?: boolean | null;
}

export type QuestionnaireStepPayload =
  | Record<string, unknown>
  | {
      allergies?: Record<string, QuestionnaireField>;
      CurrentMedications?: Record<string, QuestionnaireField>;
    };
