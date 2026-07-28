/** Patient object from GET /api/consult/:id (and appointment/create consult paths). */
export type ConsultPatient = {
  id: string;
  /** Facility-facing numeric id shown as "# 88095" */
  patientId?: number | string | null;
  /** Server often sends pre-joined "First Last" */
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  dob?: string | Date | null;
  /** Server-computed; prefer recalculating from dob when present */
  age?: number | null;
  phone?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
};

export type ConsultAppointment = {
  id?: string;
  reason?: string | null;
  symptoms?: string[] | string | null;
  appointmentType?: string | null;
  followUpSourceConsultationId?: string | null;
  isFollowUp?: boolean;
};

export type ConsultLoadResponse = {
  consultation?: {
    id: string;
    facilityId?: string | null;
    doctorId?: string | null;
    patientId?: string | null;
    appointmentId?: string | null;
    status?: string | null;
    prescriptionId?: string | null;
    consultationNumber?: string | null;
    height?: string | null;
    weight?: string | null;
    bloodPressure?: string | null;
    spO2?: string | null;
    bloodSugar?: string | null;
    temperature?: string | null;
  };
  patient?: ConsultPatient | null;
  appointment?: ConsultAppointment | null;
  doctor?: { id?: string; name?: string | null } | null;
  facility?: { id?: string; name?: string | null } | null;
  patientId?: string;
  doctorId?: string;
  facilityId?: string;
};
