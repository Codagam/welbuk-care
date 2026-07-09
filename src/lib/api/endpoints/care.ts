import { api } from "@/lib/api/client";
import type { Assignment, PatientCall } from "@/features/care/types";

// ---- Assignments --------------------------------------------------------

export async function listMyAssignments(facilityId: string): Promise<Assignment[]> {
  const res = await api<{ assignments: Assignment[] }>({
    path: "/api/patient/assignment",
    query: { facilityId, assignedToMe: 1, status: "ACTIVE", pageSize: 100 },
  });
  return res.assignments ?? [];
}

export function assignStaff(body: {
  facilityId: string;
  patientId: string;
  staffUserId: string;
  scope?: "VISIT" | "STANDING";
  appointmentId?: string;
  role?: string;
}): Promise<{ assignment: Assignment }> {
  return api({ path: "/api/patient/assignment", method: "POST", body });
}

export function endAssignment(id: string, facilityId: string): Promise<unknown> {
  return api({
    path: `/api/patient/assignment/${id}`,
    method: "PATCH",
    body: { facilityId, status: "ENDED" },
  });
}

// ---- Calls --------------------------------------------------------------

export async function listCalls(
  facilityId: string,
  assignedToMe = false
): Promise<PatientCall[]> {
  const res = await api<{ calls: PatientCall[] }>({
    path: "/api/patient/call",
    query: {
      facilityId,
      status: "ACTIVE",
      pageSize: 100,
      ...(assignedToMe ? { assignedToMe: 1 } : {}),
    },
  });
  return res.calls ?? [];
}

export function raiseCall(body: {
  facilityId: string;
  patientId: string;
  type?: string;
  priority?: string;
  note?: string;
  appointmentId?: string;
}): Promise<{ call: PatientCall }> {
  return api({ path: "/api/patient/call", method: "POST", body });
}

export function updateCall(
  id: string,
  facilityId: string,
  action: "acknowledge" | "start" | "resolve" | "cancel"
): Promise<{ call: PatientCall }> {
  return api({
    path: `/api/patient/call/${id}`,
    method: "PATCH",
    body: { facilityId, action },
  });
}
