export type {
  Appointment,
  AppointmentListFilters,
  AppointmentSearchParams,
  AppointmentSearchResult,
} from "./types";
export { AppointmentListScreen } from "./components/AppointmentListScreen";
export { AppointmentCard } from "./components/AppointmentCard";
export {
  useAppointmentList,
  useAppointmentListState,
  useCheckInAppointment,
  useLateArrivalAppointment,
  useOpenConsult,
  useReadyForNext,
} from "./hooks/useAppointmentList";
export {
  useAppointmentActionPermissions,
  useCancelAppointment,
  useDeleteAppointment,
  useDoctorDaySlots,
  useUpdateAppointment,
} from "./hooks/useAppointmentActions";
export {
  hasAnyAppointmentAction,
  isAppointmentMovable,
  resolveAppointmentActions,
} from "./lib/appointmentActions";
export type {
  AppointmentActionPermissions,
  AppointmentActions,
} from "./lib/appointmentActions";
export { buildSearchParams, defaultListFilters } from "./lib/buildSearchParams";
export {
  canOpenAppointmentFromList,
  canOpenConsultFromMenu,
  isAppointmentFollowUp,
  isFollowUpAwaitingTimeSlot,
  isTreatAsNoShow,
  isWaitlistVisit,
  shouldShowCheckIn,
} from "./lib/appointmentGates";
