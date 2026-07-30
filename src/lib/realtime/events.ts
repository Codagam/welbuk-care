/** Welbuk facility WS event names (mirror Practice `WelbukEventType`). */
export type WelbukEventType =
  | "APPOINTMENT_CREATED"
  | "APPOINTMENT_FOLLOW_UP_CREATED"
  | "APPOINTMENT_CONFIRMED"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_COMPLETED"
  | "APPOINTMENT_TENTATIVE_CREATED"
  | "APPOINTMENT_VITALS_RECORDED"
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

function normalizeDoctorName(name: string): string {
  return name
    .replace(/^(?:dr\.?\s*)+/i, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
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

  if (!isDoctorLogin) {
    // Front desk / staff — skip noisy pharma-only if needed later; show facility feed.
    return true;
  }

  // Doctor-facing Care events only
  const doctorEvents =
    event.startsWith("APPOINTMENT") ||
    event.startsWith("PATIENT_CALL") ||
    event === "PATIENT_ASSIGNED";

  if (!doctorEvents) return false;

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

  // PATIENT_CALL / ASSIGNED are usually user-targeted; no doctor fields → allow
  if (event.startsWith("PATIENT_CALL") || event === "PATIENT_ASSIGNED") {
    return true;
  }

  // No way to attribute to this doctor → drop (avoid other doctors' noise)
  if (payloadDoctorId || payloadDoctorUserId || payloadDoctorName) {
    return false;
  }
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
