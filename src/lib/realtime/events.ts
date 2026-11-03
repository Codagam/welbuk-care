/** Welbuk facility WS event names (mirror Practice `WelbukEventType`). */
export type WelbukEventType =
  | "APPOINTMENT_CREATED"
  | "APPOINTMENT_FOLLOW_UP_CREATED"
  | "APPOINTMENT_CONFIRMED"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_COMPLETED"
  | "APPOINTMENT_TENTATIVE_CREATED"
  | "APPOINTMENT_VITALS_RECORDED"
  | "APPOINTMENT_DOCTOR_CHANGED"
  | "APPOINTMENT_DOCTOR_LANE_TRANSFERRED"
  | "LAB_ORDER_RAISED"
  | "LAB_RESULT_READY"
  | "PRESCRIPTION_ISSUED"
  | "REFERRAL_CREATED"
  | "REFERRAL_ACCEPTED"
  | "REFERRAL_COMPLETED"
  | "PAYMENT_RECEIVED"
  | "PATIENT_FACILITY_QR_SCANNED"
  | "PATIENT_QR_SCANNED_AT_FACILITY"
  | "PATIENT_ONBOARDED"
  | "PATIENT_WALKED_IN"
  | "PATIENT_CHECK_IN_REQUESTED"
  | "CHECK_IN_QUEUE_UPDATED"
  | "PATIENT_ASSIGNED"
  | "PATIENT_CALL_RAISED"
  | "PATIENT_CALL_ACKNOWLEDGED"
  | "PATIENT_CALL_RESOLVED"
  | "DOCTOR_READY_FOR_NEXT"
  | "PLAN_CHANGE_REQUESTED"
  | string;

export type RealtimeToastTone = "info" | "success" | "warning" | "error";

export type RealtimeToast = {
  id: string;
  title: string;
  body?: string;
  tone: RealtimeToastTone;
};

/** Sticky ward page — distinct from auto-dismiss appointment toasts. */
export type IpdPageAlarm = {
  id: string;
  title: string;
  room: string;
  patientName: string;
  detail: string;
  urgent: boolean;
  admissionId: string;
  who: string;
};

/** Socket.io may send the envelope `{ payload }` or a flat payload object. */
export function unwrapRealtimePayload(
  raw: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const inner = raw.payload;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  return raw;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * IPD page vs Care coordination call — same WS event `PATIENT_CALL_RAISED`.
 * IPD has `admissionId` / `who` / `urgent` / `ward`; Care calls have `callType` / `priority`.
 */
export function isIpdPagePayload(payload: Record<string, unknown>): boolean {
  const admissionId = str(payload.admissionId);
  if (!admissionId) return false;
  if (str(payload.callType) || str(payload.priority)) return false;
  const who = str(payload.who).toUpperCase();
  return (
    who === "NURSE" ||
    who === "DOCTOR" ||
    str(payload.ward).length > 0 ||
    str(payload.urgent).length > 0
  );
}

export function formatIpdPageAlarm(
  payload: Record<string, unknown>
): IpdPageAlarm | null {
  const admissionId = str(payload.admissionId);
  if (!admissionId) return null;
  const whoRaw = str(payload.who).toUpperCase() === "DOCTOR" ? "DOCTOR" : "NURSE";
  const who = whoRaw === "DOCTOR" ? "Doctor" : "Nurse";
  const urgent = str(payload.urgent) === "true";
  const room = [str(payload.ward), str(payload.roomNumber)]
    .filter(Boolean)
    .join(" ");
  const patientName = str(payload.patientName) || "A patient";
  const detail = [str(payload.reason), str(payload.admissionRef)]
    .filter(Boolean)
    .join(" · ");
  return {
    id: `page-${admissionId}-${whoRaw}`,
    title: `${urgent ? "URGENT — " : ""}${who} needed`,
    room,
    patientName,
    detail,
    urgent,
    admissionId,
    who: whoRaw,
  };
}

/** Single "Dr." prefix — matches Practice `formatNotificationDoctorLabel`. */
function doctorLabel(name: unknown): string {
  const raw = str(name);
  if (!raw) return "the doctor";
  const without = raw.replace(/^(?:dr\.?\s*)+/i, "").trim();
  return without ? `Dr. ${without}` : "the doctor";
}

export function isDoctorTransferEvent(event: string): boolean {
  return (
    event === "APPOINTMENT_DOCTOR_CHANGED" ||
    event === "APPOINTMENT_DOCTOR_LANE_TRANSFERRED"
  );
}

function normalizeDoctorName(name: string): string {
  return name
    .replace(/^(?:dr\.?\s*)+/i, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Clinical / care-flow events a doctor-home user may toast on.
 * Mirrors Practice `DOCTOR_CLINICAL_EVENTS` (+ live call ACK/RESOLVED).
 * Excludes payment / QR / check-in / onboard / DOCTOR_READY_FOR_NEXT.
 */
function isDoctorClinicalEvent(event: string): boolean {
  if (event.startsWith("APPOINTMENT")) return true;
  if (event.startsWith("LAB_")) return true;
  if (event.startsWith("REFERRAL_")) return true;
  if (event === "PRESCRIPTION_ISSUED") return true;
  if (event === "PATIENT_ASSIGNED") return true;
  if (event.startsWith("PATIENT_CALL")) return true;
  return false;
}

function payloadTargetsUser(
  payload: Record<string, unknown>,
  userId: string | null
): boolean {
  if (!userId) return false;
  const keys = [
    "targetUserId",
    "assignedToUserId",
    "staffUserId",
    "doctorUserId",
  ] as const;
  for (const key of keys) {
    const v = str(payload[key]);
    if (v && v === userId) return true;
  }
  return false;
}

/**
 * Doctor login: only events clearly for this doctor.
 * Staff/admin: facility-wide (same as Practice web).
 */
export function isEventRelevantToViewer(args: {
  event: string;
  payload: Record<string, unknown>;
  isDoctorLogin: boolean;
  doctorId: string | null;
  userId: string | null;
  userName: string | null;
}): boolean {
  const { event, payload, isDoctorLogin, doctorId, userId, userName } = args;

  if (event === "PATIENT_CALL_RAISED" && isIpdPagePayload(payload)) {
    return true;
  }

  if (!isDoctorLogin) {
    // Front desk / staff — skip noisy pharma-only if needed later; show facility feed.
    return true;
  }

  if (!isDoctorClinicalEvent(event)) return false;

  // CareLane / doctor-of-care swap: only outgoing or incoming doctor.
  // Must run before `payload.doctorId` — that field is always the NEW doctor.
  if (isDoctorTransferEvent(event)) {
    if (!doctorId) return false;
    const fromId = str(payload.fromDoctorId);
    const toId = str(payload.toDoctorId);
    return doctorId === fromId || doctorId === toId;
  }

  const payloadDoctorId = str(payload.doctorId);
  const payloadDoctorUserId = str(payload.doctorUserId);
  const payloadDoctorName = str(payload.doctorName);

  // Explicit ids win
  if (payloadDoctorId && doctorId) {
    return payloadDoctorId === doctorId;
  }
  if (payloadDoctorUserId && userId) {
    return payloadDoctorUserId === userId;
  }

  // Appointment booked payloads often only include doctorName
  if (payloadDoctorName && userName) {
    const a = normalizeDoctorName(payloadDoctorName);
    const b = normalizeDoctorName(userName);
    if (a && b && (a === b || a.includes(b) || b.includes(a))) return true;
  }

  // Care coordination: only when clearly user-targeted — never facility-broadcast noise
  if (event.startsWith("PATIENT_CALL") || event === "PATIENT_ASSIGNED") {
    return payloadTargetsUser(payload, userId);
  }

  // No way to attribute to this doctor → drop (avoid other doctors' noise)
  return false;
}

export function formatRealtimeToast(
  event: string,
  payload: Record<string, unknown>
): RealtimeToast | null {
  const who = str(payload.patientName) || "Patient";
  const id = `${event}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  switch (event) {
    case "APPOINTMENT_VITALS_RECORDED":
      return {
        id,
        title: "Vitals recorded",
        body: `${who} — waiting`,
        tone: "success",
      };
    case "APPOINTMENT_CREATED":
      return {
        id,
        title: "New appointment",
        body: who,
        tone: "info",
      };
    case "APPOINTMENT_FOLLOW_UP_CREATED":
      return {
        id,
        title: "New follow-up",
        body: who,
        tone: "info",
      };
    case "APPOINTMENT_CONFIRMED":
      return {
        id,
        title: "Appointment confirmed",
        body: who,
        tone: "success",
      };
    case "APPOINTMENT_CANCELLED":
      return {
        id,
        title: "Appointment cancelled",
        body: who,
        tone: "error",
      };
    case "APPOINTMENT_COMPLETED":
      return {
        id,
        title: "Appointment completed",
        body: who,
        tone: "success",
      };
    case "APPOINTMENT_TENTATIVE_CREATED":
      return {
        id,
        title: "Tentative booking",
        body: who,
        tone: "warning",
      };
    case "APPOINTMENT_DOCTOR_CHANGED":
      return {
        id,
        title: "Doctor changed",
        body: `${who} — appointment moved from ${doctorLabel(payload.fromDoctorName)} to ${doctorLabel(payload.toDoctorName)}`,
        tone: "info",
      };
    case "APPOINTMENT_DOCTOR_LANE_TRANSFERRED": {
      const count = Number(payload.movedCount ?? 0);
      const n = Number.isFinite(count) ? count : 0;
      return {
        id,
        title: "CareLane transferred",
        body: `${n} appointment(s) moved from ${doctorLabel(payload.fromDoctorName)} to ${doctorLabel(payload.toDoctorName)}`,
        tone: "info",
      };
    }
    case "PRESCRIPTION_ISSUED":
      return {
        id,
        title: "Prescription issued",
        body: who,
        tone: "info",
      };
    case "DOCTOR_READY_FOR_NEXT": {
      const raw = str(payload.doctorName);
      const without = raw.replace(/^(?:dr\.?\s*)+/i, "").trim();
      const label = without ? `Dr. ${without}` : "Doctor";
      return {
        id,
        title: "Next patient ready",
        body: `${label} finished — call the next patient`,
        tone: "info",
      };
    }
    case "PATIENT_CALL_RAISED":
      if (isIpdPagePayload(payload)) return null;
      return {
        id,
        title: "Patient call",
        body: who,
        tone: "warning",
      };
    case "PATIENT_ASSIGNED":
      return {
        id,
        title: "Patient assigned",
        body: who,
        tone: "info",
      };
    case "LAB_RESULT_READY":
      return {
        id,
        title: "Lab result ready",
        body: who,
        tone: "success",
      };
    case "LAB_ORDER_RAISED":
      return {
        id,
        title: "Lab order raised",
        body: who,
        tone: "info",
      };
    default:
      if (event.startsWith("APPOINTMENT")) {
        return { id, title: "Appointment update", body: who, tone: "info" };
      }
      if (event.startsWith("PATIENT_CALL")) {
        return { id, title: "Patient call update", body: who, tone: "info" };
      }
      return null;
  }
}

export function queriesToInvalidate(event: string): string[][] {
  if (event.startsWith("PATIENT_CALL")) return [["calls"]];
  if (event === "PATIENT_ASSIGNED") return [["assignments"]];
  if (
    event.startsWith("APPOINTMENT") ||
    event.startsWith("CHECK_IN") ||
    event.startsWith("PATIENT_WALKED") ||
    event.startsWith("PATIENT_ONBOARD") ||
    event.startsWith("PATIENT_QR") ||
    event === "PATIENT_CHECK_IN_REQUESTED" ||
    event === "CHECK_IN_QUEUE_UPDATED"
  ) {
    return [["queue"], ["appointments"], ["patient-appointments"]];
  }
  if (event === "PRESCRIPTION_ISSUED") {
    return [["prescriptions"], ["summary"]];
  }
  if (event === "APPOINTMENT_VITALS_RECORDED") {
    return [["queue"], ["appointments"], ["vitals"], ["patient-appointments"]];
  }
  if (event.startsWith("LAB_") || event.startsWith("REFERRAL_")) {
    return [["patient-referrals"], ["patient-lab-reports"]];
  }
  if (event === "DOCTOR_READY_FOR_NEXT") {
    return [["queue"], ["appointments"]];
  }
  return [];
}
