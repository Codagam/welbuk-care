/**
 * Which reschedule / change-doctor / cancel / delete actions an appointment row offers.
 *
 * Two inputs, both required: what the person may do (permission keys from
 * Practice `/api/permissions`) and what the appointment still allows (its
 * status). Either one alone is wrong — a receptionist must not move a visit
 * the doctor has started, and a completed visit must not offer anyone a
 * Delete it cannot have.
 *
 * Status rules are ported from Practice so the tablet and the desk agree:
 * @see practice/Welbuk_/lib/appointments/appointment-status.ts (isAppointmentMovable)
 * @see practice/Welbuk_/components/appointments/list.tsx (row ⋮ menu)
 */

import type { Appointment } from "../types";
import {
  isFollowUpAwaitingTimeSlot,
  normalizeStatusToken,
} from "./appointmentGates";

/** Once a visit is underway or void it can no longer be moved or reassigned. */
const NON_MOVABLE_STATUSES = new Set([
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "DROPS",
]);

export function isAppointmentMovable(status?: string | null): boolean {
  return !NON_MOVABLE_STATUSES.has(normalizeStatusToken(status));
}

export interface AppointmentActionPermissions {
  /** `appointment.update` — reschedule, change doctor. */
  canUpdate: boolean;
  /** `appointment.update` or `action.appointment.cancel`. */
  canCancel: boolean;
  /** `appointment.delete`. */
  canDelete: boolean;
}

export interface AppointmentActions {
  reschedule: boolean;
  changeDoctor: boolean;
  cancel: boolean;
  delete: boolean;
}

export function resolveAppointmentActions(
  appointment: Appointment,
  perms: AppointmentActionPermissions
): AppointmentActions {
  const status = normalizeStatusToken(appointment.status);
  const done = status === "COMPLETED";
  const cancelled = status === "CANCELLED";
  const movable = isAppointmentMovable(status);
  // A follow-up still waiting for its first time slot is given one through
  // Practice's "Set time slot", which also clears `awaitingFollowUpSlot` and
  // needs `appointment.follow_up_manage`. A plain reschedule here would set a
  // time and leave the flag claiming there is none.
  const awaitingSlot = isFollowUpAwaitingTimeSlot(appointment);

  return {
    reschedule: perms.canUpdate && movable && !awaitingSlot,
    // A no-show's slot is already spent: changing the doctor re-sends that
    // slot as a live booking. It needs a new time first (Reschedule).
    changeDoctor:
      perms.canUpdate && movable && !awaitingSlot && status !== "NO_SHOW",
    cancel: perms.canCancel && !done && !cancelled,
    delete: perms.canDelete && !done,
  };
}

export function hasAnyAppointmentAction(actions: AppointmentActions): boolean {
  return Object.values(actions).some(Boolean);
}
